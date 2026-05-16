import { describe, it, expect, beforeAll } from 'vitest'

const storage: Record<string, string> = {}
beforeAll(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage
})

import { summarize } from '../useQualityGrid'
import type { PhaseBucket } from '../useTimingPhase'
import type { QualityTicket } from '@/types/quality'

function tk(p: Partial<QualityTicket>): QualityTicket {
  return {
    issueKey: 'X-1', issueType: 'Story', project: 'IDC_PDSW',
    team_key: 'DKKF', team: 'Team DKKF', summary: 's', points: 1,
    assignee: 'u', displayName: 'U', agentCheck: '', status: 'A',
    action: 'create', timestamp: '2026-05-07T10:00:00Z', ...p,
  }
}

const buckets: PhaseBucket[] = [
  { label: 'W1', from: new Date('2026-05-06T00:00:00Z'), to: new Date('2026-05-12T23:59:59Z') },
  { label: 'W2', from: new Date('2026-05-13T00:00:00Z'), to: new Date('2026-05-19T23:59:59Z') },
]

describe('summarize', () => {
  it('tallies period counts and per-team breakdown', () => {
    const list = [
      tk({ issueKey: 'A-1', team_key: 'DKKF', status: 'A', timestamp: '2026-05-07T10:00:00Z' }),
      tk({ issueKey: 'A-2', team_key: 'DKKF', status: 'C', timestamp: '2026-05-08T10:00:00Z' }),
      tk({ issueKey: 'B-1', team_key: 'PDSW', status: 'A', timestamp: '2026-05-14T10:00:00Z' }),
    ]
    const s = summarize(list, buckets)
    expect(s.total).toBe(3)
    expect(s.periodCounts).toEqual({ A: 2, C: 1 })
    expect(s.byTeam.map(t => t.team_key)).toEqual(['DKKF', 'PDSW'])
    expect(s.byTeam[0]).toMatchObject({ team_key: 'DKKF', total: 2, counts: { A: 1, C: 1 } })
  })

  it('buckets tickets by event_time and leaves empty buckets at zero', () => {
    const list = [
      tk({ issueKey: 'A-1', team_key: 'DKKF', status: 'A', timestamp: '2026-05-07T10:00:00Z' }),
      tk({ issueKey: 'A-2', team_key: 'DKKF', status: 'B', timestamp: '2026-05-15T10:00:00Z' }),
    ]
    const s = summarize(list, buckets)
    const dkkf = s.matrix.find(r => r.team_key === 'DKKF')!
    expect(dkkf.cells.map(c => c.total)).toEqual([1, 1])
    expect(dkkf.cells[0].counts).toEqual({ A: 1 })
    expect(dkkf.cells[1].counts).toEqual({ B: 1 })
  })

  it('counts off-taxonomy status under its raw value (drift preserved)', () => {
    const list = [tk({ issueKey: 'A-1', status: 'bogus', timestamp: '2026-05-07T10:00:00Z' })]
    const s = summarize(list, buckets)
    expect(s.periodCounts).toEqual({ bogus: 1 })
  })

  it('drops tickets outside every bucket from the matrix but keeps them in totals', () => {
    const list = [
      tk({ issueKey: 'A-1', status: 'A', timestamp: '2026-04-01T10:00:00Z' }), // before W1
    ]
    const s = summarize(list, buckets)
    expect(s.total).toBe(1)
    expect(s.periodCounts).toEqual({ A: 1 })
    const row = s.matrix.find(r => r.team_key === 'DKKF')!
    expect(row.total).toBe(0)
  })
})
