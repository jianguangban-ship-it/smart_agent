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
import type { QualityTicket } from '@/types/quality'

function tk(p: Partial<QualityTicket>): QualityTicket {
  return {
    issueKey: 'X-1', issueType: 'Story', project: 'IDC_PDSW',
    team_key: 'DKKF', team: 'Team DKKF', summary: 's', points: 1,
    assignee: 'u', displayName: 'U', agentCheck: '', status: 'A',
    action: 'create', timestamp: '2026-05-07T10:00:00Z', ...p,
  }
}

const SAMPLE: QualityTicket[] = [
  tk({ issueKey: 'A-1', status: 'A' }),
  tk({ issueKey: 'A-2', status: 'C' }),
]

function okResponse(data: QualityTicket[]): Response {
  return { ok: true, json: async () => data } as unknown as Response
}

const STUBS = {
  DynamicScroller: { template: '<div class="scroller-stub" />', props: ['items', 'minItemSize', 'keyField'] },
  DynamicScrollerItem: true,
  PeriodSelector: true,
  AgentCheckModal: true,
  TrendMatrix: { template: '<div class="matrix-stub" />', props: ['summary'] },
  QualityTrendModelling: { template: '<div class="model-stub" />', props: ['tickets', 'buckets'] },
}

let wrapper: VueWrapper | null = null

async function mountPanel() {
  vi.stubGlobal('fetch', vi.fn(async () => okResponse(SAMPLE)))
  wrapper = mount(QualityGridPanel, { global: { stubs: STUBS } })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  delete storage['view-trend-tab']
  vi.unstubAllGlobals()
})

describe('trend board tabs', () => {
  it('defaults to the per-team trend matrix', async () => {
    const w = await mountPanel()
    expect(w.find('.trend-tabs').exists()).toBe(true)
    expect(w.find('.matrix-stub').exists()).toBe(true)
    expect(w.find('.model-stub').exists()).toBe(false)
    const matrixTab = w.find('.trend-tab:not(.trend-tab--model)')
    expect(matrixTab.attributes('aria-selected')).toBe('true')
  })

  it('switches to Quality Trend Modelling (red tab) and persists the choice', async () => {
    const w = await mountPanel()
    const modelTab = w.find('.trend-tab--model')
    expect(modelTab.exists()).toBe(true)

    await modelTab.trigger('click')
    expect(w.find('.model-stub').exists()).toBe(true)
    expect(w.find('.matrix-stub').exists()).toBe(false)
    expect(modelTab.attributes('aria-selected')).toBe('true')
    expect(storage['view-trend-tab']).toBe('model')
  })

  it('restores the persisted tab on mount', async () => {
    storage['view-trend-tab'] = 'model'
    const w = await mountPanel()
    expect(w.find('.model-stub').exists()).toBe(true)
    expect(w.find('.matrix-stub').exists()).toBe(false)
  })

  it('collapses whichever page is active (collapse moved to the panel)', async () => {
    const w = await mountPanel()
    expect(w.find('.trend-collapse').classes()).toContain('is-open')

    await w.find('.collapse-btn').trigger('click')
    expect(w.find('.trend-collapse').classes()).not.toContain('is-open')
    expect(w.find('.trend-collapse').attributes('inert')).toBeDefined()
    // Content stays mounted (pure-CSS 0fr -> 1fr collapse).
    expect(w.find('.matrix-stub').exists()).toBe(true)

    await w.find('.trend-tab--model').trigger('click')
    expect(w.find('.trend-collapse').classes()).not.toContain('is-open')
  })
})
