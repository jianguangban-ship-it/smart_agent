import { ref, computed } from 'vue'
import type { CoachHistoryRecord, CoachChannel } from '@/types/api'

const LS_KEY = 'coach-history'
const MAX_RECORDS = 200
const WARN_THRESHOLD = 180

// ─── Hash generation ────────────────────────────────────────────────────────

function generateHashId(existingIds: Set<string>): string {
  let id: string
  do {
    const bytes = new Uint8Array(4)
    crypto.getRandomValues(bytes)
    id = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  } while (existingIds.has(id))
  return id
}

// ─── Time formatting ────────────────────────────────────────────────────────

export function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// ─── Storage ────────────────────────────────────────────────────────────────

function loadFromStorage(): CoachHistoryRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as CoachHistoryRecord[]) : []
  } catch {
    return []
  }
}

function saveToStorage(records: CoachHistoryRecord[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(records))
}

// ─── Singleton state (module-level ref) ─────────────────────────────────────

export const coachHistory = ref<CoachHistoryRecord[]>(loadFromStorage())

export const recordCount = computed(() => coachHistory.value.length)
export const isNearCap = computed(() => coachHistory.value.length >= WARN_THRESHOLD)

// ─── Session tracking (per channel) ─────────────────────────────────────────
const sessionByChannel = ref<Record<CoachChannel, string | null>>({ task: null, explore: null })

// Back-compat single ref used elsewhere (task-channel session).
export const currentSessionId = ref<string | null>(null)

export function startNewSession(channel: CoachChannel = 'task'): void {
  const existingIds = new Set(
    coachHistory.value.map(r => r.sessionId).filter(Boolean) as string[]
  )
  const id = generateHashId(existingIds)
  sessionByChannel.value[channel] = id
  if (channel === 'task') currentSessionId.value = id
}

export function setSessionId(channel: CoachChannel, id: string | null): void {
  sessionByChannel.value[channel] = id
  if (channel === 'task') currentSessionId.value = id
}

export interface SessionGroup {
  sessionId: string
  records: CoachHistoryRecord[]       // chronological (oldest first)
  firstTimestamp: number
  lastTimestamp: number
}

export function getSessionGroups(records: CoachHistoryRecord[]): { grouped: SessionGroup[]; ungrouped: CoachHistoryRecord[] } {
  const map = new Map<string, CoachHistoryRecord[]>()
  const ungrouped: CoachHistoryRecord[] = []

  for (const r of records) {
    if (r.sessionId) {
      let arr = map.get(r.sessionId)
      if (!arr) { arr = []; map.set(r.sessionId, arr) }
      arr.push(r)
    } else {
      ungrouped.push(r)
    }
  }

  const grouped: SessionGroup[] = []
  for (const [sessionId, recs] of map) {
    // Sort chronological within session (oldest first)
    recs.sort((a, b) => a.timestamp - b.timestamp)
    grouped.push({
      sessionId,
      records: recs,
      firstTimestamp: recs[0].timestamp,
      lastTimestamp: recs[recs.length - 1].timestamp
    })
  }
  // Sort sessions newest-first
  grouped.sort((a, b) => b.lastTimestamp - a.lastTimestamp)

  return { grouped, ungrouped }
}

export function getSessionRecords(sessionId: string): CoachHistoryRecord[] {
  return coachHistory.value
    .filter(r => r.sessionId === sessionId)
    .sort((a, b) => a.timestamp - b.timestamp)
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export function addRecord(
  role: 'user' | 'assistant',
  content: string,
  channel: CoachChannel = 'task'
): CoachHistoryRecord {
  if (!sessionByChannel.value[channel]) startNewSession(channel)
  const existingIds = new Set(coachHistory.value.map(r => r.id))
  const record: CoachHistoryRecord = {
    id: generateHashId(existingIds),
    role, content,
    timestamp: Date.now(),
    sessionId: sessionByChannel.value[channel]!,
    channel,
  }
  // Prepend (newest first), enforce cap
  coachHistory.value = [record, ...coachHistory.value].slice(0, MAX_RECORDS)
  saveToStorage(coachHistory.value)
  return record
}

/** Records belonging to a channel; legacy untagged === 'task'. */
export function recordsForChannel(channel: CoachChannel): CoachHistoryRecord[] {
  return coachHistory.value.filter(r => (r.channel ?? 'task') === channel)
}

export function deleteRecords(ids: Set<string>): void {
  coachHistory.value = coachHistory.value.filter(r => !ids.has(r.id))
  saveToStorage(coachHistory.value)
}

export function clearHistory(): void {
  coachHistory.value = []
  localStorage.removeItem(LS_KEY)
  sessionByChannel.value = { task: null, explore: null }
  currentSessionId.value = null
}

// ─── Search & Filter ────────────────────────────────────────────────────────

export function searchRecords(
  query: string,
  roleFilter: 'all' | 'user' | 'assistant'
): CoachHistoryRecord[] {
  let results = coachHistory.value
  if (roleFilter !== 'all') {
    results = results.filter(r => r.role === roleFilter)
  }
  if (query.trim()) {
    const q = query.toLowerCase()
    results = results.filter(r => r.content.toLowerCase().includes(q))
  }
  return results
}

// ─── Export ─────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function todayStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function exportAsJson(records: CoachHistoryRecord[]): void {
  const json = JSON.stringify(records, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  downloadBlob(blob, `coach-history-${todayStr()}.json`)
}

export function exportAsMarkdown(records: CoachHistoryRecord[]): void {
  const lines = records.map(r => {
    const roleLabel = r.role === 'user' ? 'USER' : 'COACH'
    return `### ${roleLabel} — ${formatTime(r.timestamp)} (#${r.id})\n\n${r.content}\n\n<!-- ====== RECORD BOUNDARY ====== -->`
  })
  const md = lines.join('\n\n')
  const blob = new Blob([md], { type: 'text/markdown' })
  downloadBlob(blob, `coach-history-${todayStr()}.md`)
}

export function exportRecords(records: CoachHistoryRecord[], format: 'json' | 'markdown' | 'both'): void {
  if (format === 'json' || format === 'both') exportAsJson(records)
  if (format === 'markdown' || format === 'both') exportAsMarkdown(records)
}
