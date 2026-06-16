// Regression test: virtualization must HOLD at production scale, including
// across period switches that swap the items array. v10.193 fixed the fatal
// itemsLimit throw; this guards the residual failure mode found right after —
// the scroller rendering (and pooling) far more row views than the viewport
// needs, which makes leaving View mode destroy 1000+ pooled components
// (~1s+ mode-switch lag in dev).

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'

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

import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import QualityGridPanel from '../QualityGridPanel.vue'
import { _resetTimingPhaseForTesting, setPhaseKind, setPreset } from '@/composables/useTimingPhase'
import { applyScrollerConfig } from '@/main-scroller-config'
import type { QualityTicket } from '@/types/quality'

applyScrollerConfig()

const MS_PER_DAY = 86_400_000

function buildTickets(n: number, daysBack: number): QualityTicket[] {
  const out: QualityTicket[] = []
  const now = Date.now()
  for (let i = 0; i < n; i++) {
    out.push({
      issueKey: `SCALE-${i + 1}`,
      issueType: 'Task',
      project: 'IDC',
      team_key: `IDC_T${i % 18}`,
      team: `IDC_T${i % 18}`,
      summary: `production-scale row ${i}`,
      points: 1,
      assignee: 'u',
      displayName: 'U',
      agentCheck: '',
      status: (['A', 'B', 'C', 'D'] as const)[i % 4],
      action: 'create',
      // spread evenly over the past `daysBack` days so period windows differ
      timestamp: new Date(now - (i / n) * daysBack * MS_PER_DAY).toISOString(),
    })
  }
  return out
}

// 1,206 rows over 30 days — "Last 7 days" selects a ~280-row subset.
const DATA = buildTickets(1206, 30)

function fetchStub(input: RequestInfo | URL): Promise<Response> {
  const url = String(input)
  const qs = new URLSearchParams(url.split('?')[1] ?? '')
  const from = qs.get('from') ?? '0000'
  const to = qs.get('to') ?? '9999'
  const rows = DATA.filter(t => t.timestamp >= from && t.timestamp <= to)
  return Promise.resolve({ ok: true, json: async () => rows } as unknown as Response)
}

function mountedRowViews(): number {
  return document.querySelectorAll('.vue-recycle-scroller__item-view').length
}

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  _resetTimingPhaseForTesting()
  delete storage['view-trend-tab']
  delete storage['view-timing-phase']
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('virtualization holds at production scale', () => {
  it('mounts only a viewport worth of rows, including across period swaps', { timeout: 30_000 }, async () => {
    // Sane geometry: a realistic 600px-tall, 1000px-wide layout.
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1_000)
    vi.stubGlobal('fetch', vi.fn(fetchStub))

    wrapper = mount(QualityGridPanel, {
      attachTo: document.body,
      global: {
        stubs: {
          QualityRow: true,
          AgentCheckModal: true,
          TrendMatrix: true,
          QualityTrendModelling: true,
          PeriodSelector: true,
        },
      },
    })
    await flushPromises()
    await new Promise(r => setTimeout(r, 50))
    await flushPromises()

    // 600px viewport / 42px rows + 200px buffers ≈ 25 views; < 100 is generous.
    const afterMount = mountedRowViews()
    expect(afterMount, `views after initial mount (items=1206)`).toBeLessThan(100)

    // Period swaps: last7 (subset) → last30 (full set) → last7 → last30.
    setPhaseKind('calendar') // → last7
    await flushPromises()
    setPreset('last30')
    await flushPromises()
    setPreset('last7')
    await flushPromises()
    setPreset('last30')
    await flushPromises()
    await new Promise(r => setTimeout(r, 50))
    await flushPromises()

    const afterSwaps = mountedRowViews()
    expect(afterSwaps, `views after 4 period swaps (pool bloat?)`).toBeLessThan(100)
  })
})
