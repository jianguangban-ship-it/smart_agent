/// <reference lib="webworker" />
import { buildSeries } from '@/composables/useQualityModel'
import type { QualityTicket } from '@/types/quality'
import type { PhaseBucket } from '@/composables/useTimingPhase'

// Off-main-thread quality-model builder. `buildSeries` is pure and Vue-free
// (only type imports), so it runs here without pulling in the framework. The
// caller (QualityTrendModelling.vue) debounces requests and tags each with an
// id so stale results are ignored. Bucket Date objects survive structured clone.
interface Req {
  id: number
  tickets: QualityTicket[]
  buckets: PhaseBucket[]
  horizon: number
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, tickets, buckets, horizon } = e.data
  const series = buildSeries(tickets, buckets, horizon)
  ;(self as unknown as Worker).postMessage({ id, series })
}
