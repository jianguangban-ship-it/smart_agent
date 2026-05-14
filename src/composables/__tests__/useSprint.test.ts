import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

const storage: Record<string, string> = {}
beforeAll(() => {
  // Provide localStorage before composables that read it on import (useRole reads role-key).
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
    key: () => null,
    length: 0,
  } as Storage
})

import {
  currentSprint,
  dayOfSprint,
  daysRemaining,
  progressPercent,
  isDRP,
  isLastTwoDays,
  scheduleStatus,
  cadenceString,
  setSelectedProjectName,
  stopSprintClock,
  _setNowForTesting,
} from '../useSprint'

beforeAll(() => stopSprintClock())

beforeEach(() => {
  // Reset role mapping (uses localStorage); composables import currentRole as a module-level ref.
  Object.keys(storage).forEach(k => delete storage[k])
})

describe('useSprint', () => {
  it('mid-sprint: 2026-05-14 12:00 → 26 PI2 S4 day 9 of 14', () => {
    _setNowForTesting(new Date('2026-05-14T12:00:00'))
    expect(currentSprint.value?.name).toBe('26 PI2 S4')
    expect(dayOfSprint.value).toBe(9)
    expect(daysRemaining.value).toBe(6)
    expect(progressPercent.value).toBeCloseTo((8 / 14) * 100, 1)
    expect(isDRP.value).toBe(false)
    expect(isLastTwoDays.value).toBe(false)
    expect(scheduleStatus.value).toBe('in-schedule')
  })

  it('last 2 days flips the orange flag: 2026-05-18 → S4 day 13', () => {
    _setNowForTesting(new Date('2026-05-18T12:00:00'))
    expect(currentSprint.value?.name).toBe('26 PI2 S4')
    expect(dayOfSprint.value).toBe(13)
    expect(daysRemaining.value).toBe(2)
    expect(isLastTwoDays.value).toBe(true)
  })

  it('DRP sprint sets the DRP flag (not orange even if near end)', () => {
    _setNowForTesting(new Date('2026-06-10T12:00:00'))
    expect(currentSprint.value?.name).toBe('26 PI2 DRP')
    expect(isDRP.value).toBe(true)
    expect(isLastTwoDays.value).toBe(false)
  })

  it('before first sprint: scheduleStatus = before-first, currentSprint null', () => {
    _setNowForTesting(new Date('2025-11-01T12:00:00'))
    expect(currentSprint.value).toBeNull()
    expect(scheduleStatus.value).toBe('before-first')
  })

  it('after last sprint: scheduleStatus = after-last, currentSprint null', () => {
    _setNowForTesting(new Date('2027-01-15T12:00:00'))
    expect(currentSprint.value).toBeNull()
    expect(scheduleStatus.value).toBe('after-last')
  })

  it('cadenceString derives from selectedProjectName, not role', () => {
    _setNowForTesting(new Date('2026-05-14T12:00:00'))
    setSelectedProjectName('IDC_PDSW')
    expect(cadenceString.value).toBe('PD_26PI2_S4_SW')
    setSelectedProjectName('IDC_PDVV')
    expect(cadenceString.value).toBe('PD_26PI2_S4_VV')
    setSelectedProjectName('')
    expect(cadenceString.value).toBe('PD_26PI2_S4')
  })
})
