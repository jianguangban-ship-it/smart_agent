import { ref, computed } from 'vue'
import { zipSync, strToU8 } from 'fflate'
import type { CoachHistoryRecord, CoachChannel, ToolEvent, Attachment } from '@/types/api'

const LS_KEY = 'coach-history'
/** Global chat-log buffer cap. Oldest records are evicted once exceeded (FIFO). */
export const MAX_RECORDS = 200
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

// ─── Custom session names (chat-log rename) ──────────────────────────────────
// User-assigned titles for session cards in the history list, keyed by the
// globally-unique sessionId. Falls back to the first-message auto-preview in the
// UI when a session has no custom name.

const LS_SESSION_NAMES = 'coach-session-names'

function loadNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LS_SESSION_NAMES)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export const sessionNames = ref<Record<string, string>>(loadNames())

function saveNames(): void {
  localStorage.setItem(LS_SESSION_NAMES, JSON.stringify(sessionNames.value))
}

export function getSessionName(id: string): string | undefined {
  return sessionNames.value[id]
}

/** Set (or clear, when `name` is empty/blank) a session's custom title. */
export function setSessionName(id: string, name: string): void {
  const trimmed = name.trim()
  const next = { ...sessionNames.value }
  if (trimmed) next[id] = trimmed
  else delete next[id]
  sessionNames.value = next
  saveNames()
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
  channel: CoachChannel = 'task',
  toolEvents?: ToolEvent[],
  attachments?: Attachment[]
): CoachHistoryRecord {
  if (!sessionByChannel.value[channel]) startNewSession(channel)
  const existingIds = new Set(coachHistory.value.map(r => r.id))
  const record: CoachHistoryRecord = {
    id: generateHashId(existingIds),
    role, content,
    timestamp: Date.now(),
    sessionId: sessionByChannel.value[channel]!,
    channel,
    // Only persist toolEvents when the caller passed a non-empty array — keeps
    // the localStorage payload identical to v10.133 for any record that didn't
    // invoke tools (most user records, all Task-mode records).
    ...(toolEvents && toolEvents.length > 0 ? { toolEvents } : {}),
    // Same conditional-spread for attachments: only user records that attached
    // files carry them, so non-attachment records stay byte-identical.
    ...(attachments && attachments.length > 0 ? { attachments } : {})
  }
  // Prepend (newest first), enforce cap
  coachHistory.value = [record, ...coachHistory.value].slice(0, MAX_RECORDS)
  saveToStorage(coachHistory.value)
  return record
}

/** Overwrite a record's content in place (used by the Explore inline-edit flow,
 * which mutates the user turn then regenerates). No-op if the id is unknown. */
export function updateRecordContent(id: string, content: string): void {
  const rec = coachHistory.value.find(r => r.id === id)
  if (!rec || rec.content === content) return
  rec.content = content
  saveToStorage(coachHistory.value)
}

/** Records belonging to a channel; legacy untagged === 'task'. */
export function recordsForChannel(channel: CoachChannel): CoachHistoryRecord[] {
  return coachHistory.value.filter(r => (r.channel ?? 'task') === channel)
}

export function deleteRecords(ids: Set<string>): void {
  coachHistory.value = coachHistory.value.filter(r => !ids.has(r.id))
  saveToStorage(coachHistory.value)
  pruneOrphanNames()
}

/** Drop custom names whose session no longer has any records. */
function pruneOrphanNames(): void {
  const liveSessions = new Set(
    coachHistory.value.map(r => r.sessionId).filter(Boolean) as string[]
  )
  const next: Record<string, string> = {}
  let changed = false
  for (const [id, name] of Object.entries(sessionNames.value)) {
    if (liveSessions.has(id)) next[id] = name
    else changed = true
  }
  if (changed) {
    sessionNames.value = next
    saveNames()
  }
}

export function clearHistory(): void {
  coachHistory.value = []
  localStorage.removeItem(LS_KEY)
  sessionByChannel.value = { task: null, explore: null }
  currentSessionId.value = null
  sessionNames.value = {}
  localStorage.removeItem(LS_SESSION_NAMES)
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

/** Make a session label safe to use as a download filename: strip filesystem-
 * illegal characters, collapse whitespace, cap length, fall back to 'chat'. */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim()
  return cleaned || 'chat'
}

// Content builders — shared by the single-file exporters and the per-chat zip.
export function recordsToJson(records: CoachHistoryRecord[]): string {
  return JSON.stringify(records, null, 2)
}
export function recordsToMarkdown(records: CoachHistoryRecord[]): string {
  return records.map(r => {
    const roleLabel = r.role === 'user' ? 'USER' : 'COACH'
    return `### ${roleLabel} — ${formatTime(r.timestamp)} (#${r.id})\n\n${r.content}\n\n<!-- ====== RECORD BOUNDARY ====== -->`
  }).join('\n\n')
}

export function exportAsJson(records: CoachHistoryRecord[], baseName?: string): void {
  const blob = new Blob([recordsToJson(records)], { type: 'application/json' })
  downloadBlob(blob, `${baseName ?? `coach-history-${todayStr()}`}.json`)
}

export function exportAsMarkdown(records: CoachHistoryRecord[], baseName?: string): void {
  const blob = new Blob([recordsToMarkdown(records)], { type: 'text/markdown' })
  downloadBlob(blob, `${baseName ?? `coach-history-${todayStr()}`}.md`)
}

export function exportRecords(records: CoachHistoryRecord[], format: 'json' | 'markdown' | 'both', baseName?: string): void {
  if (format === 'json' || format === 'both') exportAsJson(records, baseName)
  if (format === 'markdown' || format === 'both') exportAsMarkdown(records, baseName)
}

/** One chat → one file inside the export zip, named by the chat's title. */
export interface SessionExport {
  name: string
  records: CoachHistoryRecord[]
}

/**
 * Export several chats as a single .zip — one file per chat, each named by its
 * (sanitized) chat title. Same-titled chats get a "(2)", "(3)" … suffix so no
 * file overwrites another. `both` adds a .md and a .json per chat.
 */
export function exportSessionsZip(sessions: SessionExport[], format: 'json' | 'markdown' | 'both'): void {
  const files: Record<string, Uint8Array> = {}
  const used = new Set<string>()
  for (const s of sessions) {
    const base = sanitizeFilename(s.name)
    let name = base
    let n = 2
    while (used.has(name)) name = `${base} (${n++})`
    used.add(name)
    if (format === 'markdown' || format === 'both') files[`${name}.md`] = strToU8(recordsToMarkdown(s.records))
    if (format === 'json' || format === 'both') files[`${name}.json`] = strToU8(recordsToJson(s.records))
  }
  const zipped = zipSync(files)
  downloadBlob(new Blob([zipped], { type: 'application/zip' }), `coach-history-${todayStr()}.zip`)
}
