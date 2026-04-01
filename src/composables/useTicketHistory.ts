import { ref, watch } from 'vue'
import { appMode } from '@/composables/useAppMode'

export interface TicketEntry {
  key: string
  summary: string
  project: string
  issueType: string
  date: string
}

const LS_KEY_DESIGN = 'ticket-history-design'
const LS_KEY_TASK = 'ticket-history-task'
const MAX_ENTRIES = 20

function lsKey(mode: 'design' | 'task'): string {
  return mode === 'design' ? LS_KEY_DESIGN : LS_KEY_TASK
}

function loadFromStorage(key: string): TicketEntry[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as TicketEntry[]) : []
  } catch {
    return []
  }
}

// Active history ref — switches with appMode
export const ticketHistory = ref<TicketEntry[]>(
  loadFromStorage(lsKey(appMode.value === 'task' ? 'task' : 'design'))
)

// Sync on mode switch
watch(appMode, (newMode) => {
  const mode = newMode === 'task' ? 'task' : 'design'
  ticketHistory.value = loadFromStorage(lsKey(mode))
}, { immediate: false })

export function addTicket(entry: TicketEntry): void {
  const mode = appMode.value === 'task' ? 'task' : 'design'
  const key = lsKey(mode)
  const list = [entry, ...loadFromStorage(key)].slice(0, MAX_ENTRIES)
  localStorage.setItem(key, JSON.stringify(list))
  ticketHistory.value = list
}

export function clearHistory(): void {
  const mode = appMode.value === 'task' ? 'task' : 'design'
  localStorage.removeItem(lsKey(mode))
  ticketHistory.value = []
}
