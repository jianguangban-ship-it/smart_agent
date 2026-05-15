import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { QualityTicket } from '@/types/quality'

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
    const res = await fetch('/api/tickets', { credentials: 'same-origin' })
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
export function useQualityGrid() {
  onMounted(() => {
    _wired++
    if (_wired === 1) {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
    fetchTickets()
  })
  onUnmounted(() => {
    _wired--
    if (_wired === 0) {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  })

  return {
    tickets,
    filteredTickets,
    teamOptions,
    loading,
    error,
    filterTeam,
    filterStatus,
    searchText,
    refresh: fetchTickets
  }
}
