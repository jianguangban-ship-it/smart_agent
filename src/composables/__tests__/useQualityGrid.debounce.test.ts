import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'

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

import { defineComponent, h, nextTick } from 'vue'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { useQualityGrid, filterTeam, filterStatus, searchText } from '../useQualityGrid'
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
  tk({ issueKey: 'A-1', team_key: 'DKKF', status: 'A', summary: 'alpha widget' }),
  tk({ issueKey: 'A-2', team_key: 'DKKF', status: 'C', summary: 'beta widget' }),
  tk({ issueKey: 'B-1', team_key: 'PDSW', status: 'A', summary: 'gamma gadget' }),
]

function okResponse(data: QualityTicket[]): Response {
  return { ok: true, json: async () => data } as unknown as Response
}

let grid!: ReturnType<typeof useQualityGrid>
let wrapper: VueWrapper | null = null

function mountGrid() {
  const Host = defineComponent({
    setup() {
      grid = useQualityGrid()
      return () => h('div')
    },
  })
  wrapper = mount(Host)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => okResponse(SAMPLE)))
})

afterEach(async () => {
  wrapper?.unmount()
  wrapper = null
  // Module-level singleton refs — must be reset between tests. The reset of
  // searchText itself goes through the 250ms debounce (its watcher schedules
  // the timeout on the microtask queue), so tick, then flush under fake
  // timers — or the next test still sees the previous query.
  if (!vi.isFakeTimers()) vi.useFakeTimers()
  searchText.value = ''
  filterTeam.value = ''
  filterStatus.value = ''
  await nextTick()
  vi.advanceTimersByTime(300)
  await nextTick()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('debounced search', () => {
  it('does not filter until ~250ms after typing stops', async () => {
    mountGrid()
    await flushPromises()
    expect(grid.filteredTickets.value).toHaveLength(3)

    vi.useFakeTimers()
    searchText.value = 'alpha'
    await nextTick()
    // Still unfiltered — debounce window not elapsed.
    expect(grid.filteredTickets.value).toHaveLength(3)

    vi.advanceTimersByTime(250)
    await nextTick()
    expect(grid.filteredTickets.value.map(t => t.issueKey)).toEqual(['A-1'])
  })

  it('applies team and status filters immediately (no debounce)', async () => {
    mountGrid()
    await flushPromises()

    vi.useFakeTimers()
    filterTeam.value = 'PDSW'
    await nextTick()
    expect(grid.filteredTickets.value.map(t => t.issueKey)).toEqual(['B-1'])

    filterTeam.value = ''
    filterStatus.value = 'C'
    await nextTick()
    expect(grid.filteredTickets.value.map(t => t.issueKey)).toEqual(['A-2'])
  })
})

describe('stale-while-revalidate', () => {
  it('exposes isRefreshing true only while refetching with data already present', async () => {
    // Drain singleton ticket state left by earlier tests: load an empty set.
    vi.stubGlobal('fetch', vi.fn(async () => okResponse([])))
    mountGrid()
    await flushPromises()
    wrapper!.unmount()
    wrapper = null

    let resolveFetch!: (r: Response) => void
    const deferred = new Promise<Response>(res => { resolveFetch = res })
    const fetchMock = vi.fn(() => deferred)
    vi.stubGlobal('fetch', fetchMock)

    mountGrid()
    await nextTick()
    // Initial load: loading but no data yet — NOT a refresh.
    expect(grid.loading.value).toBe(true)
    expect(grid.isRefreshing.value).toBe(false)

    resolveFetch(okResponse(SAMPLE))
    await flushPromises()
    expect(grid.isRefreshing.value).toBe(false)

    // Second fetch with data on screen — IS a refresh.
    let resolveSecond!: (r: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>(res => { resolveSecond = res }))
    const p = grid.refresh()
    await nextTick()
    expect(grid.isRefreshing.value).toBe(true)
    resolveSecond(okResponse(SAMPLE))
    await p
    expect(grid.isRefreshing.value).toBe(false)
  })

  it('keeps stale tickets visible when a refetch fails', async () => {
    mountGrid()
    await flushPromises()
    expect(grid.tickets.value).toHaveLength(3)

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 }) as unknown as Response))
    await grid.refresh()
    expect(grid.error.value).toContain('500')
    expect(grid.tickets.value).toHaveLength(3)
  })

  it('returns lastFetched and updates it on successful fetch', async () => {
    mountGrid()
    await flushPromises()
    const first = grid.lastFetched.value
    expect(first).toBeGreaterThan(0)
  })
})
