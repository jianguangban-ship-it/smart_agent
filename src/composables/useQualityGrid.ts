import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { QualityTicket } from '@/types/quality'
import { range, buckets, type PhaseBucket } from '@/composables/useTimingPhase'

const tickets = ref<QualityTicket[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const lastFetched = ref<number>(0)

export const filterTeam = ref<string>('')
export const filterStatus = ref<string>('')
export const searchText = ref<string>('')

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
  const q = searchText.value.trim().toLowerCase()
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
 * Pure aggregation over the (already date-filtered) ticket set.
 * Describes the whole period independent of the grid's team/status/search
 * filters. A ticket is assigned to the first bucket whose [from, to] window
 * contains its `timestamp` (event_time / latest verdict — snapshot model).
 */
export function summarize(list: QualityTicket[], bkts: PhaseBucket[]): PeriodSummary {
  const periodCounts: StatusCounts = {}
  const teamMap = new Map<string, TeamSummary>()
  const matrixMap = new Map<string, MatrixRow>()
  const bucketLabels = bkts.map(b => b.label)

  const cellFor = (row: MatrixRow, label: string): MatrixCell => {
    let c = row.cells.find(x => x.bucketLabel === label)
    if (!c) { c = { bucketLabel: label, counts: {}, total: 0 }; row.cells.push(c) }
    return c
  }

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
    const ts = new Date(tk.timestamp).getTime()
    const bucket = bkts.find(b => ts >= b.from.getTime() && ts <= b.to.getTime())
    if (bucket) {
      const cell = cellFor(row, bucket.label)
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

const summary = computed<PeriodSummary>(() => summarize(tickets.value, buckets.value))

// Auto-refresh when the tab becomes visible — keeps the grid fresh without
// the cost of websockets. Manual refresh button covers the focused-tab case.
function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    // Only refetch if it's been more than 30s since the last successful fetch
    // (avoids hammering when the user alt-tabs frequently).
    if (Date.now() - lastFetched.value > 30_000) fetchTickets()
  }
}

let _wired = 0
let _stopRangeWatch: (() => void) | null = null
export function useQualityGrid() {
  onMounted(() => {
    _wired++
    if (_wired === 1) {
      document.addEventListener('visibilitychange', onVisibilityChange)
      // Re-fetch whenever the timing phase window changes (server-side range).
      _stopRangeWatch = watch(
        () => [range.value.from.getTime(), range.value.to.getTime()],
        () => fetchTickets()
      )
    }
    fetchTickets()
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
    summary,
    loading,
    error,
    filterTeam,
    filterStatus,
    searchText,
    refresh: fetchTickets
  }
}
