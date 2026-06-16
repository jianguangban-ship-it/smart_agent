// Quality model v2 (v10.199, user-approved redesign). Every piece stays
// one-line explainable:
//  - bucket score = ticket average steadied by K=5 "memory tickets" at the
//    team's own window baseline (empirical-Bayes shrinkage),
//  - severity: D drops to 10 ("D nearly fails"), 格式异常 = 0, 未知 unscored,
//  - forecast = count-weighted least squares, anchored on the FIT at the last
//    bucket, damped ×0.7 per step (cannot run away),
//  - band = ±1.96·(weighted RMS residual)·√(1+k/N), absent under 3 points.

import { describe, it, expect } from 'vitest'
import {
  STATUS_SCORE, SHRINK_K, DAMPING,
  forecastSeries, buildSeries, trendSlope,
} from '../useQualityModel'
import type { PhaseBucket } from '../useTimingPhase'
import type { QualityTicket } from '@/types/quality'

function tk(p: Partial<QualityTicket>): QualityTicket {
  return {
    issueKey: 'X-1', issueType: 'Story', project: 'IDC_PDSW',
    team_key: 'DKKF', team: 'Team DKKF', summary: 's', points: 1,
    assignee: 'u', displayName: 'U', agentCheck: '', status: 'A',
    action: 'create', timestamp: '2026-05-01T10:00:00Z', ...p,
  }
}

function bucket(label: string, fromIso: string, toIso: string): PhaseBucket {
  return { label, from: new Date(fromIso), to: new Date(toIso) }
}

const BUCKETS: PhaseBucket[] = [
  bucket('5/1', '2026-05-01T00:00:00Z', '2026-05-01T23:59:59Z'),
  bucket('5/2', '2026-05-02T00:00:00Z', '2026-05-02T23:59:59Z'),
  bucket('5/3', '2026-05-03T00:00:00Z', '2026-05-03T23:59:59Z'),
]

function manyTickets(n: number, status: QualityTicket['status'], ts: string, keyPrefix: string): QualityTicket[] {
  return Array.from({ length: n }, (_, i) => tk({ issueKey: `${keyPrefix}-${i + 1}`, status, timestamp: ts }))
}

describe('STATUS_SCORE (model v2 severity)', () => {
  it('drops D to 10 — "D nearly fails" — keeping the rest of the scale', () => {
    expect(STATUS_SCORE).toEqual({ A: 100, B: 80, C: 60, D: 10, 格式异常: 0 })
    expect(STATUS_SCORE['未知']).toBeUndefined()
  })
})

describe('shrunk bucket scores (K = 5 memory tickets at the team baseline)', () => {
  it('exports the shrinkage constant', () => {
    expect(SHRINK_K).toBe(5)
  })

  it('n = K pulls a bucket halfway between its average and the baseline', () => {
    // b1: 5×A (avg 100), b2: 5×D (avg 10) → baseline (550/10) = 55.
    // b1 shrunk: (500 + 5·55)/10 = 77.5 → 78; b2: (50 + 275)/10 = 32.5 → 33.
    const tickets = [
      ...manyTickets(5, 'A', '2026-05-01T10:00:00Z', 'A'),
      ...manyTickets(5, 'D', '2026-05-02T10:00:00Z', 'D'),
    ]
    const all = buildSeries(tickets, BUCKETS).find(s => s.team_key === '*')!
    expect(all.history).toEqual([78, 33, null])
    expect(all.counts).toEqual([5, 5, 0])
  })

  it('large buckets speak for themselves; thin buckets are steadied', () => {
    // b1: 95×A, b2: 5×D → baseline = 9550/100 = 95.5.
    // b1: (9500 + 477.5)/100 = 99.775 → 100 (≈ raw mean)
    // b2: (50 + 477.5)/10 = 52.75 → 53 (raw 10, heavily steadied)
    const tickets = [
      ...manyTickets(95, 'A', '2026-05-01T10:00:00Z', 'A'),
      ...manyTickets(5, 'D', '2026-05-02T10:00:00Z', 'D'),
    ]
    const all = buildSeries(tickets, BUCKETS).find(s => s.team_key === '*')!
    expect(all.history).toEqual([100, 53, null])
  })

  it('empty buckets stay null gaps; 未知 carries no signal', () => {
    const tickets = [
      tk({ issueKey: 'A-1', status: 'A', timestamp: '2026-05-01T10:00:00Z' }),
      tk({ issueKey: 'A-2', status: '未知', timestamp: '2026-05-02T10:00:00Z' }),
    ]
    const all = buildSeries(tickets, BUCKETS).find(s => s.team_key === '*')!
    // single A → baseline 100 → b1 = (100 + 500)/6 = 100
    expect(all.history).toEqual([100, null, null])
    expect(all.counts).toEqual([1, 0, 0])
  })
})

describe('trendSlope (count-weighted least squares)', () => {
  it('matches plain OLS when counts are uniform', () => {
    expect(trendSlope([50, 60, 70], [1, 1, 1])).toBeCloseTo(10, 6)
  })

  it('defaults to uniform weights when counts are omitted', () => {
    expect(trendSlope([null, 50, null, 70])).toBeCloseTo(10, 6)
  })

  it('a high-count bucket dominates the fit', () => {
    // Unweighted slope over [50, 50, 100] is 25; with the outlier carrying
    // 1 ticket vs 100+100, the weighted slope collapses to 10/7 ≈ 1.43.
    expect(trendSlope([50, 50, 100], [100, 100, 1])).toBeCloseTo(10 / 7, 4)
  })

  it('returns null when history is too thin to fit', () => {
    expect(trendSlope([70])).toBeNull()
    expect(trendSlope([null, null])).toBeNull()
    expect(trendSlope([])).toBeNull()
  })
})

describe('forecastSeries (damped, count-weighted, fit-anchored)', () => {
  it('exports the damping constant', () => {
    expect(DAMPING).toBe(0.7)
  })

  it('damps a clean ramp: each step adds slope×φ^k', () => {
    // slope 10, anchor = fitted ŷ(2) = 70 → 70+7=77, 70+11.9≈82, 70+15.33≈85
    const { forecast } = forecastSeries([50, 60, 70], [1, 1, 1], 3)
    expect(forecast).toEqual([77, 82, 85])
  })

  it('a declining trend eases instead of crashing', () => {
    // slope −10, anchor 60 → 53, 48, 45 (old model: 50, 40, 30)
    const { forecast } = forecastSeries([80, 70, 60], [1, 1, 1], 3)
    expect(forecast).toEqual([53, 48, 45])
  })

  it('anchors on the FIT, not the noisy last point', () => {
    // [50, 90, 70]: OLS slope 10, ŷ(2) = 80 (raw last point is 70)
    const { forecast } = forecastSeries([50, 90, 70], [1, 1, 1], 3)
    expect(forecast[0]).toBe(87) // 80 + 10×0.7
  })

  it('still clamps to [0, 100]', () => {
    const { forecast } = forecastSeries([0, 0, 5], [1, 1, 1], 3)
    expect(forecast.every(v => v >= 0 && v <= 100)).toBe(true)
  })

  it('returns nothing with fewer than two known points', () => {
    expect(forecastSeries([70], [1], 3).forecast).toEqual([])
    expect(forecastSeries([null, null], [0, 0], 3).forecast).toEqual([])
  })

  describe('uncertainty band', () => {
    it('a perfect fit yields a zero-width band', () => {
      const { forecast, band } = forecastSeries([50, 60, 70], [1, 1, 1], 3)
      expect(band).not.toBeNull()
      expect(band!.lower).toEqual(forecast)
      expect(band!.upper).toEqual(forecast)
    })

    it('scatter widens the band, clamped to [0, 100]', () => {
      // [50, 90, 70]: residuals (−10, 20, −10) → se = √200 ≈ 14.14
      // band₁ = 1.96·14.14·√(4/3) ≈ 32 → lower 87−32 = 55, upper → 100
      const { forecast, band } = forecastSeries([50, 90, 70], [1, 1, 1], 3)
      expect(band!.lower[0]).toBe(55)
      expect(band!.upper[0]).toBe(100)
      // widening: measure on the unclamped (lower) side — the upper edge is
      // pinned at 100 here, so total width can't show the growth
      expect(forecast[2] - band!.lower[2]).toBeGreaterThan(forecast[0] - band!.lower[0])
    })

    it('is absent with fewer than three fitted points', () => {
      const { forecast, band } = forecastSeries([50, 60], [1, 1], 3)
      expect(forecast.length).toBe(3)
      expect(band).toBeNull()
    })
  })
})

describe('buildSeries (integration)', () => {
  it('returns the all-teams series first, then teams sorted by key', () => {
    const tickets = [
      tk({ issueKey: 'A-1', team_key: 'PDSW', team: 'Team PDSW', timestamp: '2026-05-01T10:00:00Z' }),
      tk({ issueKey: 'A-2', team_key: 'DKKF', timestamp: '2026-05-02T10:00:00Z' }),
    ]
    expect(buildSeries(tickets, BUCKETS).map(s => s.team_key)).toEqual(['*', 'DKKF', 'PDSW'])
  })

  it('attaches a sane damped forecast (no 100-pinning on a mild ramp)', () => {
    // C, B, A across buckets → baseline 80 → shrunk [77, 80, 83] → slope 3,
    // anchor 83 → forecasts 85, 87, 88 (the old model said 100, 100, 100).
    const tickets = [
      tk({ issueKey: 'A-1', status: 'C', timestamp: '2026-05-01T10:00:00Z' }),
      tk({ issueKey: 'A-2', status: 'B', timestamp: '2026-05-02T10:00:00Z' }),
      tk({ issueKey: 'A-3', status: 'A', timestamp: '2026-05-03T10:00:00Z' }),
    ]
    const all = buildSeries(tickets, BUCKETS).find(s => s.team_key === '*')!
    expect(all.history).toEqual([77, 80, 83])
    expect(all.forecast).toEqual([85, 87, 88])
    expect(all.band).not.toBeNull()
  })
})
