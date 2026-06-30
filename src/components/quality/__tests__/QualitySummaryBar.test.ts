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

import { mount, type VueWrapper } from '@vue/test-utils'
import QualitySummaryBar from '../QualitySummaryBar.vue'
import type { PeriodSummary } from '@/composables/useQualityGrid'

function summaryOf(counts: Record<string, number>): PeriodSummary {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return { total, periodCounts: counts, byTeam: [], matrix: [], bucketLabels: [] }
}

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('updated-at timestamp', () => {
  it('renders HH:MM from lastFetched and omits it when never fetched', async () => {
    const at = new Date(2026, 5, 11, 9, 5).getTime() // 09:05 local
    wrapper = mount(QualitySummaryBar, {
      props: { summary: summaryOf({ A: 2 }), lastFetched: at },
    })
    const label = wrapper.find('.updated-at')
    expect(label.exists()).toBe(true)
    expect(label.text()).toContain('09:05')

    await wrapper.setProps({ lastFetched: 0 })
    expect(wrapper.find('.updated-at').exists()).toBe(false)
  })

  it('pulses briefly when lastFetched changes, but not on first render', async () => {
    vi.useFakeTimers()
    const t1 = new Date(2026, 5, 11, 9, 5).getTime()
    wrapper = mount(QualitySummaryBar, {
      props: { summary: summaryOf({ A: 2 }), lastFetched: t1 },
    })
    expect(wrapper.find('.updated-at').classes()).not.toContain('pulse')

    await wrapper.setProps({ lastFetched: t1 + 60_000 })
    expect(wrapper.find('.updated-at').classes()).toContain('pulse')

    vi.advanceTimersByTime(1000)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.updated-at').classes()).not.toContain('pulse')
  })
})

describe('status chip count tick', () => {
  it('ticks only the chips whose count changed, and never on first render', async () => {
    vi.useFakeTimers()
    wrapper = mount(QualitySummaryBar, {
      props: { summary: summaryOf({ A: 2, C: 1 }) },
    })
    expect(wrapper.findAll('.chip-count--tick')).toHaveLength(0)

    await wrapper.setProps({ summary: summaryOf({ A: 3, C: 1 }) })
    const chips = wrapper.findAll('.chip')
    const aChip = chips.find(c => c.find('.chip-label').text() === 'A')!
    const cChip = chips.find(c => c.find('.chip-label').text() === 'C')!
    expect(aChip.find('.chip-count').classes()).toContain('chip-count--tick')
    expect(cChip.find('.chip-count').classes()).not.toContain('chip-count--tick')

    vi.advanceTimersByTime(700)
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.chip-count--tick')).toHaveLength(0)
  })
})

describe('empty-state gating (filtered summary, v10.189)', () => {
  it('does not claim an empty period when filters merely matched nothing', () => {
    wrapper = mount(QualitySummaryBar, {
      props: { summary: summaryOf({}), filteredCount: 0, totalCount: 5 },
    })
    expect(wrapper.find('.summary-empty').exists()).toBe(false)
  })

  it('shows the empty-period message when the period itself has no tickets', async () => {
    wrapper = mount(QualitySummaryBar, {
      props: { summary: summaryOf({}), filteredCount: 0, totalCount: 0 },
    })
    expect(wrapper.find('.summary-empty').exists()).toBe(true)
  })
})

describe('refresh spinner', () => {
  it('shows an inline spinner while loading (covers the invisible auto-refresh)', async () => {
    wrapper = mount(QualitySummaryBar, {
      props: { summary: summaryOf({ A: 2 }), loading: false },
    })
    expect(wrapper.find('.refresh-spinner').exists()).toBe(false)

    await wrapper.setProps({ loading: true })
    expect(wrapper.find('.refresh-spinner').exists()).toBe(true)
  })
})
