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

import { nextTick } from 'vue'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import QualityGridPanel from '../QualityGridPanel.vue'
import QualitySummaryBar from '../QualitySummaryBar.vue'
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
  tk({ issueKey: 'A-1' }),
  tk({ issueKey: 'A-2' }),
]

function okResponse(data: QualityTicket[]): Response {
  return { ok: true, json: async () => data } as unknown as Response
}
function failResponse(): Response {
  return { ok: false, status: 500 } as unknown as Response
}

const STUBS = {
  DynamicScroller: { template: '<div class="scroller-stub" />', props: ['items', 'minItemSize', 'keyField'] },
  DynamicScrollerItem: true,
  PeriodSelector: true,
  TrendMatrix: true,
  AgentCheckModal: true,
}

let wrapper: VueWrapper | null = null

function mountPanel() {
  wrapper = mount(QualityGridPanel, { global: { stubs: STUBS } })
  return wrapper
}

/** Drains the module-singleton ticket state by loading an empty dataset. */
async function drainTickets() {
  vi.stubGlobal('fetch', vi.fn(async () => okResponse([])))
  mountPanel()
  await flushPromises()
  wrapper!.unmount()
  wrapper = null
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
})

describe('skeleton loading rows', () => {
  it('shows shimmer skeleton rows during the initial load (no data yet)', async () => {
    await drainTickets()
    let resolveFetch!: (r: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(res => { resolveFetch = res })))
    const w = mountPanel()
    await nextTick()

    expect(w.find('.grid').exists()).toBe(true)
    expect(w.find('.grid').attributes('aria-busy')).toBe('true')
    expect(w.findAll('.skeleton-row').length).toBeGreaterThanOrEqual(6)
    expect(w.find('.scroller-stub').exists()).toBe(false)

    resolveFetch(okResponse(SAMPLE))
    await flushPromises()
    expect(w.find('.skeleton-row').exists()).toBe(false)
    expect(w.find('.scroller-stub').exists()).toBe(true)
  })

  it('does not show skeletons when refreshing over stale data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse(SAMPLE)))
    const w = mountPanel()
    await flushPromises()

    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    w.findComponent(QualitySummaryBar).vm.$emit('refresh')
    await nextTick()
    expect(w.find('.skeleton-row').exists()).toBe(false)
    expect(w.find('.scroller-stub').exists()).toBe(true)
  })
})

describe('stale-while-revalidate rendering', () => {
  it('shows the full-screen error only when there is no data at all', async () => {
    await drainTickets()
    vi.stubGlobal('fetch', vi.fn(async () => failResponse()))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.state-error').exists()).toBe(true)
    expect(w.find('.grid').exists()).toBe(false)
  })

  it('keeps the grid visible with a notice bar when a refetch fails over stale data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse(SAMPLE)))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.grid').exists()).toBe(true)

    vi.stubGlobal('fetch', vi.fn(async () => failResponse()))
    w.findComponent(QualitySummaryBar).vm.$emit('refresh')
    await flushPromises()

    expect(w.find('.grid').exists()).toBe(true)
    expect(w.find('.stale-error').exists()).toBe(true)
    expect(w.find('.state-error').exists()).toBe(false)
  })

  it('dims the grid body while refreshing over stale data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse(SAMPLE)))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.grid').classes()).not.toContain('grid--refreshing')

    let resolveFetch!: (r: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(res => { resolveFetch = res })))
    w.findComponent(QualitySummaryBar).vm.$emit('refresh')
    await nextTick()
    expect(w.find('.grid').classes()).toContain('grid--refreshing')

    resolveFetch(okResponse(SAMPLE))
    await flushPromises()
    expect(w.find('.grid').classes()).not.toContain('grid--refreshing')
  })
})
