import { describe, it, expect } from 'vitest'
import {
  SPRINT_SCHEDULE,
  findSprintAt,
  getCadenceString,
  getNextSprint,
  parseProjectCadence,
} from '../sprintSchedule'

describe('SPRINT_SCHEDULE', () => {
  it('contains 26 entries spanning 4 PIs', () => {
    expect(SPRINT_SCHEDULE.length).toBe(26)
    expect(new Set(SPRINT_SCHEDULE.map(s => s.pi))).toEqual(new Set([1, 2, 3, 4]))
  })

  it('each entry is a 14-day window (Wed 09:00 → Tue 21:00)', () => {
    const day = 86_400_000
    for (const entry of SPRINT_SCHEDULE) {
      const span = entry.end.getTime() - entry.start.getTime()
      // 13 days + 12 hours = 13.5 * day
      expect(span).toBe(13 * day + 12 * 60 * 60 * 1000)
    }
  })

  it('every PI ends with DRP as its final sprint', () => {
    for (let pi = 1; pi <= 4; pi++) {
      const entries = SPRINT_SCHEDULE.filter(s => s.pi === pi)
      expect(entries[entries.length - 1].sprint).toBe('DRP')
    }
  })
})

describe('findSprintAt', () => {
  it('returns 26 PI2 S4 for today (2026-05-14 12:00 local)', () => {
    const e = findSprintAt(new Date('2026-05-14T12:00:00'))
    expect(e?.name).toBe('26 PI2 S4')
  })

  it('returns 26 PI2 S1 at the start instant of PI2 (2026-03-25 09:00)', () => {
    const e = findSprintAt(new Date('2026-03-25T09:00:00'))
    expect(e?.name).toBe('26 PI2 S1')
  })

  it('returns 26 PI1 S1 at the very first start (2025-12-17 09:00)', () => {
    const e = findSprintAt(new Date('2025-12-17T09:00:00'))
    expect(e?.name).toBe('26 PI1 S1')
  })

  it('returns null before the first sprint starts', () => {
    expect(findSprintAt(new Date('2025-12-16T23:59:00'))).toBeNull()
  })

  it('returns null after the last sprint ends', () => {
    expect(findSprintAt(new Date('2026-12-16T00:00:00'))).toBeNull()
  })

  it('attributes the overnight gap to the sprint that just ended', () => {
    // S1 ends 2025-12-30 21:00; S2 starts 2025-12-31 09:00. Gap @ 2025-12-31 06:00 belongs to S1.
    const e = findSprintAt(new Date('2025-12-31T06:00:00'))
    expect(e?.name).toBe('26 PI1 S1')
  })
})

describe('parseProjectCadence', () => {
  it('splits IDC_PDSW into PD + SW', () => {
    expect(parseProjectCadence('IDC_PDSW')).toEqual({ dept: 'PD', team: 'SW' })
  })

  it('splits all four PD-prefixed teams from the cadence doc', () => {
    expect(parseProjectCadence('IDC_PDHW')).toEqual({ dept: 'PD', team: 'HW' })
    expect(parseProjectCadence('IDC_PDSY')).toEqual({ dept: 'PD', team: 'SY' })
    expect(parseProjectCadence('IDC_PDVV')).toEqual({ dept: 'PD', team: 'VV' })
  })

  it('splits longer team codes (3-char team suffix)', () => {
    expect(parseProjectCadence('IDC_ADSIM')).toEqual({ dept: 'AD', team: 'SIM' })
    expect(parseProjectCadence('IDC_PMVSS')).toEqual({ dept: 'PM', team: 'VSS' })
  })

  it('returns null when prefix is missing', () => {
    expect(parseProjectCadence('PDSW')).toBeNull()
    expect(parseProjectCadence('DKKF')).toBeNull()
  })

  it('returns null when remainder is too short', () => {
    expect(parseProjectCadence('IDC_')).toBeNull()
    expect(parseProjectCadence('IDC_PD')).toBeNull()
  })

  it('returns null on empty string', () => {
    expect(parseProjectCadence('')).toBeNull()
  })
})

describe('getCadenceString', () => {
  const s4 = SPRINT_SCHEDULE.find(s => s.name === '26 PI2 S4')!
  const drp = SPRINT_SCHEDULE.find(s => s.name === '26 PI2 DRP')!

  it('builds PD_26PI2_S4_SW from IDC_PDSW (matches v10.89 example)', () => {
    expect(getCadenceString(s4, 'IDC_PDSW')).toBe('PD_26PI2_S4_SW')
  })

  it('builds PD_26PI2_DRP_VV for DRP sprint + V&V team', () => {
    expect(getCadenceString(drp, 'IDC_PDVV')).toBe('PD_26PI2_DRP_VV')
  })

  it('derives dept prefix from project name, not hardcoded "PD"', () => {
    expect(getCadenceString(s4, 'IDC_ADSIM')).toBe('AD_26PI2_S4_SIM')
    expect(getCadenceString(s4, 'IDC_SDBS')).toBe('SD_26PI2_S4_BS')
  })

  it('falls back to PD_26PI<N>_<Sprint> when project name is empty', () => {
    expect(getCadenceString(s4, '')).toBe('PD_26PI2_S4')
  })

  it('falls back when project name does not match IDC_<dept><team> pattern', () => {
    expect(getCadenceString(s4, 'DKKF')).toBe('PD_26PI2_S4')
  })

  it('returns empty string when entry is null', () => {
    expect(getCadenceString(null, 'IDC_PDSW')).toBe('')
  })
})

describe('getNextSprint', () => {
  it('returns the chronologically next sprint', () => {
    const s4 = SPRINT_SCHEDULE.find(s => s.name === '26 PI2 S4')!
    expect(getNextSprint(s4)?.name).toBe('26 PI2 S5')
  })

  it('crosses PI boundaries: 26 PI1 DRP → 26 PI2 S1', () => {
    const drp = SPRINT_SCHEDULE.find(s => s.name === '26 PI1 DRP')!
    expect(getNextSprint(drp)?.name).toBe('26 PI2 S1')
  })

  it('returns null after the very last sprint', () => {
    const last = SPRINT_SCHEDULE[SPRINT_SCHEDULE.length - 1]
    expect(getNextSprint(last)).toBeNull()
  })
})

