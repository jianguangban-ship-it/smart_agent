// Regression test for the production-scale freeze (found 2026-06-12 testing
// against the real GWM DB): vue-virtual-scroller's RecycleScroller throws
// "Rendered items limit reached" when the dataset exceeds its itemsLimit
// (default 1000) at a moment the scroller viewport is unmeasurable (height 0
// — exactly what jsdom gives us, and what a mid-layout/hidden grid gives the
// browser). The throw lands inside Vue's reactive flush and aborts it, after
// which the whole app stops re-rendering — clicks "work" but nothing paints.
//
// Production has 1,155+ tickets, so this is a real-data bug class: any test
// dataset under 1000 rows can never catch it. main.ts must raise the
// library's itemsLimit config far above any realistic ticket count.

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
import { _resetTimingPhaseForTesting } from '@/composables/useTimingPhase'
import { applyScrollerConfig } from '@/main-scroller-config'
import type { QualityTicket } from '@/types/quality'

// Mirror main.ts: the config tweak under test must be active here exactly as
// it is in the real app bootstrap.
applyScrollerConfig()

function buildTickets(n: number): QualityTicket[] {
  const out: QualityTicket[] = []
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
      timestamp: new Date().toISOString(),
    })
  }
  return out
}

// > 1000 rows — the library's default itemsLimit — but a realistic prod count.
const DATA = buildTickets(1206)

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  _resetTimingPhaseForTesting()
  delete storage['view-trend-tab']
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('virtual scroller at production scale (>1000 rows)', () => {
  // Renders 1,206 (stubbed) rows in the degenerate geometry — legitimately
  // heavy, and slower still when vitest workers share the CPU in a full run.
  it('mounting with 1206 tickets in a zero-height viewport must not throw "Rendered items limit reached"', { timeout: 30_000 }, async () => {
    // Reproduce the degenerate geometry from the real freeze: the scroller's
    // viewport reports as tall as the entire content (the "element isn't
    // scrolling" state), so the visible range spans ALL items at once.
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(60_000)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1_000)

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rejections: unknown[] = []
    const onRejection = (e: PromiseRejectionEvent | { reason?: unknown }) => {
      rejections.push((e as { reason?: unknown }).reason)
    }
    process.on('unhandledRejection', onRejection as never)
    vi.stubGlobal('fetch', vi.fn(async () =>
      ({ ok: true, json: async () => DATA } as unknown as Response)))

    let thrown: unknown = null
    try {
      // REAL DynamicScroller/DynamicScrollerItem — the throw lives inside the
      // scroller; only the row content and unrelated widgets are stubbed.
      wrapper = mount(QualityGridPanel, {
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
      await new Promise(r => setTimeout(r, 50)) // let the scroller's deferred size checks run
      await flushPromises()
    } catch (e) {
      thrown = e
    } finally {
      process.off('unhandledRejection', onRejection as never)
    }

    const allErrorText = [
      String(thrown ?? ''),
      ...rejections.map(String),
      ...errSpy.mock.calls.map(c => c.map(String).join(' ')),
      ...warnSpy.mock.calls.map(c => c.map(String).join(' ')),
    ].join('\n')

    // Three faces of the same failure: the throw itself, the library's
    // diagnostic (only emitted from the same code path), and Vue reporting
    // the broken flush.
    expect(allErrorText).not.toContain('Rendered items limit reached')
    expect(allErrorText).not.toContain("isn't scrolling")
    expect(allErrorText).not.toContain('Unhandled error')
    expect(thrown).toBeNull()
  })
})
