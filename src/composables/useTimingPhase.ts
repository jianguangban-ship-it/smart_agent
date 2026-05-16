import { ref, computed } from 'vue'
import { now } from '@/composables/useSprint'
import { findSprintAt } from '@/config/sprintSchedule'
import {
  getPreviousSprint,
  sprintsInPI,
  type SprintEntry,
} from '@/config/sprintSchedule'

// Timing-phase lens for View mode. Defines the date window the JIRA Quality
// Grid reviews (server-side `event_time` range) plus the sub-period buckets
// the per-team trend matrix is drawn over. Shares useSprint's reactive clock
// (and its `_setNowForTesting` seam) so sprint + calendar presets stay in sync.

const MS_PER_DAY = 86_400_000
const LS_KEY = 'view-timing-phase'

export type PhaseKind = 'sprint' | 'calendar'
/** sprint: current | last | currentPI · calendar: last7 | last30 | custom */
export type PresetKey = 'current' | 'last' | 'currentPI' | 'last7' | 'last30' | 'custom'

export interface PhaseRange {
  from: Date
  to: Date
  /** Human label for the summary bar, e.g. "26 PI2 S4" or "5/10 → 5/16". */
  label: string
}

export interface PhaseBucket {
  label: string
  from: Date
  to: Date
}

interface PersistedPhase {
  kind: PhaseKind
  preset: PresetKey
  customFrom: string
  customTo: string
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY)
}
function fmtMD(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function loadPersisted(): PersistedPhase {
  const fallback: PersistedPhase = { kind: 'sprint', preset: 'current', customFrom: '', customTo: '' }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return fallback
    const p = JSON.parse(raw) as Partial<PersistedPhase>
    return {
      kind: p.kind === 'calendar' ? 'calendar' : 'sprint',
      preset: (p.preset as PresetKey) ?? fallback.preset,
      customFrom: typeof p.customFrom === 'string' ? p.customFrom : '',
      customTo: typeof p.customTo === 'string' ? p.customTo : '',
    }
  } catch {
    return fallback
  }
}

const _init = loadPersisted()

export const phaseKind = ref<PhaseKind>(_init.kind)
export const presetKey = ref<PresetKey>(_init.preset)
export const customFrom = ref<string>(_init.customFrom)
export const customTo = ref<string>(_init.customTo)

function persist(): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      kind: phaseKind.value,
      preset: presetKey.value,
      customFrom: customFrom.value,
      customTo: customTo.value,
    } satisfies PersistedPhase))
  } catch {
    // localStorage unavailable (private mode / SSR) — selection just won't persist.
  }
}

/** Switch phase kind and reset to that kind's default preset. */
export function setPhaseKind(kind: PhaseKind): void {
  phaseKind.value = kind
  presetKey.value = kind === 'sprint' ? 'current' : 'last7'
  persist()
}

export function setPreset(key: PresetKey): void {
  presetKey.value = key
  persist()
}

export function setCustomRange(from: string, to: string): void {
  customFrom.value = from
  customTo.value = to
  persist()
}

// --- range ---------------------------------------------------------------

function calendarFallback(label: string): PhaseRange {
  // Used when sprint presets can't resolve (now outside the published schedule).
  const to = endOfDay(now.value)
  return { from: startOfDay(addDays(now.value, -29)), to, label }
}

export const range = computed<PhaseRange>(() => {
  if (phaseKind.value === 'sprint') {
    const cur = findSprintAt(now.value)
    if (!cur) return calendarFallback('Last 30 days')

    if (presetKey.value === 'last') {
      const prev = getPreviousSprint(cur)
      if (!prev) return calendarFallback('Last 30 days')
      return { from: prev.start, to: prev.end, label: prev.name }
    }
    if (presetKey.value === 'currentPI') {
      const pi = sprintsInPI(cur.pi)
      const first = pi[0]
      const last = pi[pi.length - 1]
      return { from: first.start, to: last.end, label: `26 PI${cur.pi}` }
    }
    // 'current'
    return { from: cur.start, to: cur.end, label: cur.name }
  }

  // calendar
  if (presetKey.value === 'custom') {
    const f = customFrom.value ? new Date(customFrom.value) : null
    const t = customTo.value ? new Date(customTo.value) : null
    if (f && t && !isNaN(f.getTime()) && !isNaN(t.getTime()) && f.getTime() <= t.getTime()) {
      return { from: startOfDay(f), to: endOfDay(t), label: `${fmtMD(f)} → ${fmtMD(t)}` }
    }
    return calendarFallback('Last 30 days')
  }
  const days = presetKey.value === 'last30' ? 30 : 7
  const from = startOfDay(addDays(now.value, -(days - 1)))
  const to = endOfDay(now.value)
  return { from, to, label: `Last ${days} days` }
})

// --- buckets (trend sub-periods) -----------------------------------------

function dailyBuckets(from: Date, to: Date): PhaseBucket[] {
  const out: PhaseBucket[] = []
  let cursor = startOfDay(from)
  const end = to.getTime()
  while (cursor.getTime() <= end) {
    const bEnd = endOfDay(cursor)
    out.push({ label: fmtMD(cursor), from: cursor, to: bEnd })
    cursor = addDays(cursor, 1)
  }
  return out
}

function weeklyBuckets(from: Date, to: Date): PhaseBucket[] {
  const out: PhaseBucket[] = []
  let start = new Date(from)
  const end = to.getTime()
  while (start.getTime() <= end) {
    const next = addDays(start, 7)
    const bEnd = next.getTime() - 1 <= end ? new Date(next.getTime() - 1) : to
    out.push({ label: fmtMD(start), from: start, to: bEnd })
    start = next
  }
  return out
}

function monthlyBuckets(from: Date, to: Date): PhaseBucket[] {
  const out: PhaseBucket[] = []
  let start = new Date(from.getFullYear(), from.getMonth(), 1)
  if (start.getTime() < from.getTime()) start = new Date(from)
  while (start.getTime() <= to.getTime()) {
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999)
    const bEnd = monthEnd.getTime() <= to.getTime() ? monthEnd : to
    out.push({ label: `${start.getFullYear()}/${start.getMonth() + 1}`, from: start, to: bEnd })
    start = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  }
  return out
}

export const buckets = computed<PhaseBucket[]>(() => {
  const { from, to } = range.value

  if (phaseKind.value === 'sprint') {
    const cur = findSprintAt(now.value)
    if (cur && presetKey.value === 'currentPI') {
      return sprintsInPI(cur.pi).map((s: SprintEntry) => ({
        label: s.sprint,
        from: s.start,
        to: s.end,
      }))
    }
    if (cur && (presetKey.value === 'current' || presetKey.value === 'last')) {
      const entry: SprintEntry | null =
        presetKey.value === 'last' ? getPreviousSprint(cur) : cur
      if (entry) {
        const mid = addDays(entry.start, 7)
        return [
          { label: 'W1', from: entry.start, to: new Date(mid.getTime() - 1) },
          { label: 'W2', from: mid, to: entry.end },
        ]
      }
    }
    // outside schedule → treat span as calendar
  }

  const spanDays = Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)
  if (spanDays <= 14) return dailyBuckets(from, to)
  if (spanDays <= 90) return weeklyBuckets(from, to)
  return monthlyBuckets(from, to)
})

/** Test-only: reset to defaults and clear persistence. */
export function _resetTimingPhaseForTesting(): void {
  phaseKind.value = 'sprint'
  presetKey.value = 'current'
  customFrom.value = ''
  customTo.value = ''
  try { localStorage.removeItem(LS_KEY) } catch { /* noop */ }
}
