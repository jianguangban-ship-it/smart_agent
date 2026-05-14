import { ref, computed } from 'vue'
import {
  SPRINT_SCHEDULE,
  SCHEDULE_FIRST_START,
  SCHEDULE_LAST_END,
  findSprintAt,
  getNextSprint,
  getCadenceString,
} from '@/config/sprintSchedule'

const MS_PER_DAY = 86_400_000

// Shared reactive clock — single 60s interval drives every consumer.
const now = ref(new Date())
let _tickHandle: ReturnType<typeof setInterval> | null = null

export function startSprintClock(): void {
  if (_tickHandle != null) return
  _tickHandle = setInterval(() => { now.value = new Date() }, 60_000)
}

// Auto-start in browser. Test environments can call stopSprintClock() if needed.
if (typeof window !== 'undefined') {
  startSprintClock()
}

export function stopSprintClock(): void {
  if (_tickHandle != null) {
    clearInterval(_tickHandle)
    _tickHandle = null
  }
}

/** Test-only seam: replace the reactive `now` with a fixed Date. */
export function _setNowForTesting(d: Date): void {
  now.value = d
}

export const currentSprint = computed(() => findSprintAt(now.value))

// 1-indexed: the start date itself is Day 1.
export const dayOfSprint = computed<number>(() => {
  const entry = currentSprint.value
  if (!entry) return 0
  const startMidnight = new Date(entry.start)
  startMidnight.setHours(0, 0, 0, 0)
  const nowMidnight = new Date(now.value)
  nowMidnight.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((nowMidnight.getTime() - startMidnight.getTime()) / MS_PER_DAY)
  return Math.max(1, Math.min(14, diffDays + 1))
})

export const sprintLengthDays = computed<number>(() => 14)

export const daysRemaining = computed<number>(() =>
  Math.max(0, sprintLengthDays.value - dayOfSprint.value + 1)
)

export const progressPercent = computed<number>(() => {
  const total = sprintLengthDays.value
  const done = dayOfSprint.value - 1
  return Math.min(100, Math.max(0, (done / total) * 100))
})

export const isDRP = computed<boolean>(() => currentSprint.value?.sprint === 'DRP')

export const isLastTwoDays = computed<boolean>(() =>
  !!currentSprint.value && !isDRP.value && daysRemaining.value <= 2
)

/**
 * Project name of the currently-selected Agile Team (e.g. "IDC_PDSW"). Synced
 * from App.vue via a watch(form.projectKey) → setSelectedProjectName. Used
 * by the cadence string. Empty string → cadence falls back to `PD_26PI<N>_<Sprint>`.
 */
export const selectedProjectName = ref<string>('')

export function setSelectedProjectName(name: string): void {
  selectedProjectName.value = name
}

export const cadenceString = computed<string>(() =>
  getCadenceString(currentSprint.value, selectedProjectName.value)
)

export const nextSprint = computed(() =>
  currentSprint.value ? getNextSprint(currentSprint.value) : null
)

export type SprintScheduleStatus = 'before-first' | 'after-last' | 'in-schedule'

export const scheduleStatus = computed<SprintScheduleStatus>(() => {
  const t = now.value.getTime()
  if (t < SCHEDULE_FIRST_START.getTime()) return 'before-first'
  if (t > SCHEDULE_LAST_END.getTime()) return 'after-last'
  return 'in-schedule'
})

export { SPRINT_SCHEDULE }
