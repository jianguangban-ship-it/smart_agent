import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { refDebounced } from '@vueuse/core'
import type { QualityTicket } from '@/types/quality'
import { range, buckets, type PhaseBucket } from '@/composables/useTimingPhase'
import { bucketBounds, bucketIndexOf } from '@/utils/bucketIndex'

const tickets = ref<QualityTicket[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const lastFetched = ref<number>(0)

export const filterTeam = ref<string>('')
export const filterStatus = ref<string>('')
export const searchText = ref<string>('')
// Search filtering lags typing by 250ms so the O(n) scan in filteredTickets
// doesn't run per keystroke; the input itself stays bound to searchText and
// remains instant. Team/status selects are discrete picks — no debounce.
const debouncedSearch = refDebounced(searchText, 250)

// A "refresh" is a fetch happening while stale rows are still on screen —
// the grid keeps showing them (stale-while-revalidate) and only dims.
const isRefreshing = computed(() => loading.value && tickets.value.length > 0)

async function fetchTickets() {
  loading.value = true
  error.value = null
  try {
    // Date range is applied server-side (indexed event_time); team/status/search
    // stay client-side filters over the returned set.
    const qs = new URLSearchParams({
      from: range.value.from.toISOString(),
      to: range.value.to.toISOString(),
    })
    const res = await fetch(`/api/tickets?${qs}`, { credentials: 'same-origin' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as QualityTicket[]
    tickets.value = data
    lastFetched.value = Date.now()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

const filteredTickets = computed(() => {
  const q = debouncedSearch.value.trim().toLowerCase()
  return tickets.value.filter(t => {
    if (filterTeam.value && t.team_key !== filterTeam.value) return false
    if (filterStatus.value && t.status !== filterStatus.value) return false
    if (q) {
      const hay = `${t.summary} ${t.displayName} ${t.issueKey}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})

// Unique team_keys present in the dataset (for the filter dropdown).
// `team_key` is the stable identifier; we map it to the most recent `team`
// display name observed in the data so the dropdown shows friendly labels.
const teamOptions = computed(() => {
  const m = new Map<string, string>()
  for (const t of tickets.value) {
    if (!m.has(t.team_key)) m.set(t.team_key, t.team || t.team_key)
  }
  return Array.from(m, ([key, name]) => ({ key, name }))
    .sort((a, b) => a.key.localeCompare(b.key))
})

// --- period summary + per-team trend matrix ------------------------------

export type StatusCounts = Record<string, number>
export interface TeamSummary {
  team_key: string
  team: string
  counts: StatusCounts
  total: number
}
export interface MatrixCell {
  bucketLabel: string
  counts: StatusCounts
  total: number
}
export interface MatrixRow {
  team_key: string
  team: string
  cells: MatrixCell[]
  total: number
}
export interface PeriodSummary {
  total: number
  periodCounts: StatusCounts
  byTeam: TeamSummary[]
  matrix: MatrixRow[]
  bucketLabels: string[]
}

function tally(target: StatusCounts, status: string): void {
  target[status] = (target[status] ?? 0) + 1
}

/**
 * Pure aggregation over a (already date-filtered) ticket set. Called twice:
 * once on the full period (chips bar) and once on the filtered set (trend
 * matrix). A ticket is assigned to the first bucket whose [from, to] window
 * contains its `timestamp` (event_time / latest verdict — snapshot model).
 */
export function summarize(list: QualityTicket[], bkts: PhaseBucket[]): PeriodSummary {
  const periodCounts: StatusCounts = {}
  const teamMap = new Map<string, TeamSummary>()
  const matrixMap = new Map<string, MatrixRow>()
  const bucketLabels = bkts.map(b => b.label)
  const bounds = bucketBounds(bkts)

  for (const tk of list) {
    const status = tk.status
    tally(periodCounts, status)

    let team = teamMap.get(tk.team_key)
    if (!team) {
      team = { team_key: tk.team_key, team: tk.team || tk.team_key, counts: {}, total: 0 }
      teamMap.set(tk.team_key, team)
    }
    tally(team.counts, status)
    team.total++

    let row = matrixMap.get(tk.team_key)
    if (!row) {
      row = { team_key: tk.team_key, team: tk.team || tk.team_key, cells: bkts.map(b => ({ bucketLabel: b.label, counts: {}, total: 0 })), total: 0 }
      matrixMap.set(tk.team_key, row)
    }
    // Binary-search the containing bucket; row.cells is built from the same
    // ordered `bkts`, so the cell index equals the bucket index (no .find).
    const idx = bucketIndexOf(new Date(tk.timestamp).getTime(), bounds)
    if (idx !== -1) {
      const cell = row.cells[idx]
      tally(cell.counts, status)
      cell.total++
      row.total++
    }
  }

  const byTeam = Array.from(teamMap.values()).sort((a, b) => a.team_key.localeCompare(b.team_key))
  const matrix = Array.from(matrixMap.values()).sort((a, b) => a.team_key.localeCompare(b.team_key))
  return {
    total: list.length,
    periodCounts,
    byTeam,
    matrix,
    bucketLabels,
  }
}

// v10.189: ONE summary, over the filtered set — the Mission Quality chips,
// the per-team trend, and the ticket list all describe the same tickets.
// (v10.187 briefly kept a second whole-period summary for the chips; the raw
// period total still reaches the bar via its totalCount prop.)
const filteredSummary = computed<PeriodSummary>(() => summarize(filteredTickets.value, buckets.value))

// v10.194: the panel is kept mounted across mode switches (v-show in App.vue,
// same pattern as Task mode) so leaving View never pays the virtual-scroller
// pool unmount at production row counts. While another mode is on screen the
// grid is "inactive": tab-focus refresh is suppressed, and returning to
// View always refetches.
const gridActive = ref(true)

export function setGridActive(active: boolean): void {
  const wasActive = gridActive.value
  gridActive.value = active
  // lastFetched === 0 means the onMounted fetch hasn't happened yet;
  // that fetch owns the initial load — avoid a double call.
  if (active && !wasActive && lastFetched.value > 0) {
    fetchTickets()
  }
}

// Refetch whenever the user returns to this browser tab (alt-tab, tab switch,
// window restore). No staleness gate — tab focus signals intent to see fresh data.
function onVisibilityChange() {
  if (!gridActive.value) return
  if (document.visibilityState === 'visible') fetchTickets()
}

let _wired = 0
let _stopRangeWatch: (() => void) | null = null
export function useQualityGrid() {
  onMounted(() => {
    _wired++
    if (_wired === 1) {
      document.addEventListener('visibilitychange', onVisibilityChange)
      // Re-fetch only when the timing window's start/end actually change (preset
      // switch, sprint boundary, day rollover). MUST be an array of getters, not
      // a single getter returning an array: a getter returning a fresh [a,b] is
      // never Object.is-equal to the previous array, so it would fire on every
      // 60s `now` tick (the useSprint clock, which `range` depends on) and
      // silently re-poll the server. See v10.234.
      _stopRangeWatch = watch(
        [() => range.value.from.getTime(), () => range.value.to.getTime()],
        () => fetchTickets()
      )
    }
    // Only fetch on mount if the grid is the active view (with the async-mounted
    // panel this is true when entering View; avoids a cold-load fetch otherwise).
    if (gridActive.value) fetchTickets()
  })
  onUnmounted(() => {
    _wired--
    if (_wired === 0) {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      _stopRangeWatch?.()
      _stopRangeWatch = null
    }
  })

  return {
    tickets,
    filteredTickets,
    teamOptions,
    filteredSummary,
    loading,
    isRefreshing,
    lastFetched,
    error,
    filterTeam,
    filterStatus,
    searchText,
    refresh: fetchTickets
  }
}
