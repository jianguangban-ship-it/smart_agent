import { describe, it, expect } from 'vitest'
import { bucketBounds, bucketIndexOf } from '@/utils/bucketIndex'
import type { PhaseBucket } from '@/composables/useTimingPhase'

// Contiguous daily buckets + a deliberate GAP (5/3 missing) to prove the binary
// search returns -1 for a gap, matching the old `bkts.find(b => ts in [from,to])`.
const BUCKETS: PhaseBucket[] = [
  { label: '5/1', from: new Date('2026-05-01T00:00:00Z'), to: new Date('2026-05-01T23:59:59.999Z') },
  { label: '5/2', from: new Date('2026-05-02T00:00:00Z'), to: new Date('2026-05-02T23:59:59.999Z') },
  // gap: no 5/3 bucket
  { label: '5/4', from: new Date('2026-05-04T00:00:00Z'), to: new Date('2026-05-04T23:59:59.999Z') },
]

// Reference implementation = the pre-optimization `.find()`.
function naive(ts: number, bkts: PhaseBucket[]): number {
  return bkts.findIndex(b => ts >= b.from.getTime() && ts <= b.to.getTime())
}

describe('bucketIndexOf', () => {
  const bounds = bucketBounds(BUCKETS)
  const cases = [
    '2026-05-01T00:00:00Z', // first bucket start (boundary)
    '2026-05-01T12:00:00Z',
    '2026-05-02T23:59:59.999Z', // bucket end (boundary)
    '2026-05-03T10:00:00Z', // in the gap → -1
    '2026-05-04T08:00:00Z', // last bucket
    '2026-04-30T10:00:00Z', // before everything → -1
    '2026-05-09T10:00:00Z', // after everything → -1
  ]

  it('matches the naive .find() index for every case (incl. gaps/boundaries)', () => {
    for (const iso of cases) {
      const ts = new Date(iso).getTime()
      expect(bucketIndexOf(ts, bounds)).toBe(naive(ts, BUCKETS))
    }
  })

  it('returns -1 for an empty bucket list', () => {
    expect(bucketIndexOf(Date.now(), [])).toBe(-1)
  })
})
