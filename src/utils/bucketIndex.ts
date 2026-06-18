import type { PhaseBucket } from '@/composables/useTimingPhase'

// Vue-free bucket assignment (importable by the quality-model Web Worker).
// Buckets are sorted ascending by `from` and non-overlapping (with possible
// gaps, e.g. between PI sprints), so a single binary search replaces the old
// O(m) `.find()` / `.findIndex()` per ticket.

/** Precompute [fromMs, toMs] pairs once per summarize/buildSeries call. */
export function bucketBounds(bkts: PhaseBucket[]): Array<[number, number]> {
  return bkts.map(b => [b.from.getTime(), b.to.getTime()])
}

/**
 * Index of the bucket whose [from, to] window contains `ts`, or -1. Finds the
 * rightmost bucket with `from <= ts` (binary search), then verifies `ts <= to`
 * (so a timestamp landing in a gap returns -1). Equivalent to
 * `bkts.find(b => ts >= from && ts <= to)` but O(log m).
 */
export function bucketIndexOf(ts: number, bounds: Array<[number, number]>): number {
  let lo = 0
  let hi = bounds.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (bounds[mid][0] <= ts) { ans = mid; lo = mid + 1 }
    else hi = mid - 1
  }
  return ans !== -1 && ts <= bounds[ans][1] ? ans : -1
}
