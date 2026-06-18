// v10.196: the modelling chart renders through Apache ECharts (SVG renderer).
// The option contract is pinned in qualityModelChart.test.ts; here we test the
// component wiring — init/setOption/dispose lifecycle, the data fed into the
// option builder, and the Vue DOM that surrounds the chart (trend indicator,
// formula note, empty state).

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

const setOption = vi.fn()
const resize = vi.fn()
const dispose = vi.fn()
const on = vi.fn()
const init = vi.fn((..._args: unknown[]) => ({ setOption, resize, dispose, on }))
vi.mock('echarts/core', () => ({ init: (...a: unknown[]) => init(...a), use: vi.fn() }))
vi.mock('echarts/charts', () => ({ LineChart: {} }))
vi.mock('echarts/components', () => ({
  GridComponent: {}, TooltipComponent: {}, LegendComponent: {}, MarkLineComponent: {},
}))
vi.mock('echarts/renderers', () => ({ SVGRenderer: {} }))

import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import QualityTrendModelling from '../QualityTrendModelling.vue'
import type { PhaseBucket } from '@/composables/useTimingPhase'
import type { QualityTicket } from '@/types/quality'

function tk(p: Partial<QualityTicket>): QualityTicket {
  return {
    issueKey: 'X-1', issueType: 'Story', project: 'IDC_PDSW',
    team_key: 'DKKF', team: 'Team DKKF', summary: 's', points: 1,
    assignee: 'u', displayName: 'U', agentCheck: '', status: 'A',
    action: 'create', timestamp: '2026-05-01T10:00:00Z', ...p,
  }
}

const BUCKETS: PhaseBucket[] = [
  { label: '5/1', from: new Date('2026-05-01T00:00:00Z'), to: new Date('2026-05-01T23:59:59Z') },
  { label: '5/2', from: new Date('2026-05-02T00:00:00Z'), to: new Date('2026-05-02T23:59:59Z') },
  { label: '5/3', from: new Date('2026-05-03T00:00:00Z'), to: new Date('2026-05-03T23:59:59Z') },
]

const TICKETS: QualityTicket[] = [
  tk({ issueKey: 'A-1', team_key: 'DKKF', status: 'C', timestamp: '2026-05-01T10:00:00Z' }),
  tk({ issueKey: 'A-2', team_key: 'DKKF', status: 'B', timestamp: '2026-05-02T10:00:00Z' }),
  tk({ issueKey: 'A-3', team_key: 'DKKF', status: 'A', timestamp: '2026-05-03T10:00:00Z' }),
  tk({ issueKey: 'B-1', team_key: 'PDSW', team: 'Team PDSW', status: 'A', timestamp: '2026-05-01T10:00:00Z' }),
  tk({ issueKey: 'B-2', team_key: 'PDSW', team: 'Team PDSW', status: 'D', timestamp: '2026-05-03T10:00:00Z' }),
]

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.clearAllMocks()
})

type CapturedOption = {
  series: Array<{ name: string }>
  xAxis: { data: string[] }
}

describe('QualityTrendModelling (ECharts wiring)', () => {
  it('initializes an SVG-renderer chart and feeds it the built option', async () => {
    wrapper = mount(QualityTrendModelling, { props: { tickets: TICKETS, buckets: BUCKETS } })
    await nextTick()
    expect(init).toHaveBeenCalledTimes(1)
    expect(init.mock.calls[0][2]).toMatchObject({ renderer: 'svg' })
    expect(setOption).toHaveBeenCalled()

    const opt = setOption.mock.calls[0][0] as CapturedOption
    // all-teams + DKKF + PDSW histories (+ forecasts) and 3 forecast slots
    expect(opt.series.length).toBeGreaterThanOrEqual(3)
    expect(opt.xAxis.data).toContain('+1')
    expect(opt.xAxis.data).toContain('5/3')
  })

  it('re-renders the option when tickets change', async () => {
    wrapper = mount(QualityTrendModelling, { props: { tickets: TICKETS, buckets: BUCKETS } })
    await nextTick()
    const calls = setOption.mock.calls.length
    await wrapper.setProps({ tickets: TICKETS.slice(0, 3) })
    // The model build is now debounced (~120ms) and off the synchronous path;
    // wait out the debounce so the recompute → render fires.
    await new Promise(r => setTimeout(r, 150))
    await nextTick()
    expect(setOption.mock.calls.length).toBeGreaterThan(calls)
  })

  it('disposes the chart on unmount', async () => {
    wrapper = mount(QualityTrendModelling, { props: { tickets: TICKETS, buckets: BUCKETS } })
    await nextTick()
    wrapper.unmount()
    wrapper = null
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('renders the empty state and no chart when there are no tickets', async () => {
    wrapper = mount(QualityTrendModelling, { props: { tickets: [], buckets: BUCKETS } })
    await nextTick()
    expect(wrapper.find('.model-empty').exists()).toBe(true)
    expect(init).not.toHaveBeenCalled()
  })

  it('keeps the all-teams trend indicator (regression direction) outside the chart', async () => {
    // Model v2: shrunk all-teams history [73, 72, 66], counts [2, 1, 2]
    // → count-weighted slope −3.5 → declining.
    wrapper = mount(QualityTrendModelling, { props: { tickets: TICKETS, buckets: BUCKETS } })
    await nextTick()
    const trend = wrapper.find('.model-trend')
    expect(trend.exists()).toBe(true)
    expect(trend.classes()).toContain('model-trend--down')
    expect(trend.text()).toContain('-3.5')
  })

  it('keeps the formula note', async () => {
    wrapper = mount(QualityTrendModelling, { props: { tickets: TICKETS, buckets: BUCKETS } })
    expect(wrapper.find('.model-note').exists()).toBe(true)
  })

  // v10.199: hovering a team's curve re-renders the option with that team's
  // uncertainty band; leaving reverts to the all-teams-only band.
  it('wires hover listeners and re-renders with the hovered team band', async () => {
    wrapper = mount(QualityTrendModelling, { props: { tickets: TICKETS, buckets: BUCKETS } })
    await nextTick()
    const events = on.mock.calls.map(c => c[0])
    expect(events).toContain('mouseover')
    expect(events).toContain('mouseout')

    const overHandler = on.mock.calls.find(c => c[0] === 'mouseover')![1] as (p: unknown) => void
    const outHandler = on.mock.calls.find(c => c[0] === 'mouseout')![1] as (p: unknown) => void
    const before = setOption.mock.calls.length

    overHandler({ componentType: 'series', seriesName: 'DKKF' })
    await nextTick()
    expect(setOption.mock.calls.length).toBe(before + 1)

    outHandler({})
    await nextTick()
    expect(setOption.mock.calls.length).toBe(before + 2)
  })
})
