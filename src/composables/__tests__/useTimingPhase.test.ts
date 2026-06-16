import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

const storage: Record<string, string> = {}
beforeAll(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
    key: () => null,
    length: 0,
  } as Storage
})

import { _setNowForTesting, stopSprintClock } from '../useSprint'
import {
  range, buckets,
  setPhaseKind, setPreset, setCustomRange,
  _resetTimingPhaseForTesting,
} from '../useTimingPhase'

beforeAll(() => stopSprintClock())

beforeEach(() => {
  Object.keys(storage).forEach(k => delete storage[k])
  _resetTimingPhaseForTesting()
  // Mid-sprint anchor: 26 PI2 S4 (2026-05-06 → 2026-05-19).
  _setNowForTesting(new Date('2026-05-14T12:00:00'))
})

describe('useTimingPhase — sprint presets', () => {
  it('current sprint → 26 PI2 S4 window, 2 weekly buckets', () => {
    expect(range.value.label).toBe('26 PI2 S4')
    expect(buckets.value.map(b => b.label)).toEqual(['W1', 'W2'])
  })

  it('last sprint → 26 PI2 S3', () => {
    setPreset('last')
    expect(range.value.label).toBe('26 PI2 S3')
    expect(buckets.value).toHaveLength(2)
  })

  it('current PI → PI2 span with one bucket per sprint', () => {
    setPreset('currentPI')
    expect(range.value.label).toBe('26 PI2')
    expect(buckets.value.map(b => b.label)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'DRP'])
  })
})

describe('useTimingPhase — calendar presets', () => {
  it('last 7 days → 7 daily buckets', () => {
    setPhaseKind('calendar') // resets preset to last7
    expect(buckets.value).toHaveLength(7)
    expect(range.value.label).toBe('Last 7 days')
  })

  it('last 30 days → weekly buckets labeled with their full date span', () => {
    setPhaseKind('calendar')
    setPreset('last30')
    expect(range.value.label).toBe('Last 30 days')
    // Start-date-only labels read like 5 scattered single days; each column
    // must announce the span it covers, including the short final stub.
    expect(buckets.value.map(b => b.label)).toEqual([
      '4/15–4/21', '4/22–4/28', '4/29–5/5', '5/6–5/12', '5/13–5/14',
    ])
  })

  it('a single-day stub week is labeled as a bare date, not a self-range', () => {
    setPhaseKind('calendar')
    setPreset('custom')
    setCustomRange('2026-01-01', '2026-01-15') // 15 days: 2 full weeks + 1-day stub
    expect(buckets.value.map(b => b.label)).toEqual(['1/1–1/7', '1/8–1/14', '1/15'])
  })

  it('custom range (9-day span) → daily buckets', () => {
    setPhaseKind('calendar')
    setPreset('custom')
    setCustomRange('2026-01-01', '2026-01-10')
    expect(range.value.label).toContain('→')
    expect(buckets.value.length).toBe(10)
  })

  it('invalid custom range falls back to last 30 days', () => {
    setPhaseKind('calendar')
    setPreset('custom')
    setCustomRange('2026-02-01', '2026-01-01') // from > to
    expect(range.value.label).toBe('Last 30 days')
  })
})

describe('useTimingPhase — persistence', () => {
  it('writes the selection to localStorage', () => {
    setPhaseKind('calendar')
    setPreset('last30')
    const saved = JSON.parse(storage['view-timing-phase'])
    expect(saved).toMatchObject({ kind: 'calendar', preset: 'last30' })
  })
})
