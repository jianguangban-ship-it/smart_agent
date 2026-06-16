// v10.194: the View panel stays mounted across mode switches (v-show — same
// pattern as Task mode) so leaving View never pays the virtual-scroller pool
// unmount (~1s+ at production scale). That makes "is the grid actually the
// visible mode?" a first-class state: the 30s tab-focus auto-refresh must not
// fire while another mode is on screen, and returning to View refetches if
// the data went stale meanwhile.

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

import { defineComponent, h } from 'vue'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { useQualityGrid, setGridActive } from '../useQualityGrid'
import type { QualityTicket } from '@/types/quality'

const SAMPLE: QualityTicket[] = [{
  issueKey: 'X-1', issueType: 'Story', project: 'IDC_PDSW',
  team_key: 'DKKF', team: 'Team DKKF', summary: 's', points: 1,
  assignee: 'u', displayName: 'U', agentCheck: '', status: 'A',
  action: 'create', timestamp: '2026-05-07T10:00:00Z',
}]

let wrapper: VueWrapper | null = null
let fetchMock: ReturnType<typeof vi.fn>

function mountGrid() {
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => SAMPLE } as unknown as Response))
  vi.stubGlobal('fetch', fetchMock)
  const Host = defineComponent({
    setup() {
      useQualityGrid()
      return () => h('div')
    },
  })
  wrapper = mount(Host)
}

function fireVisibilityChange() {
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  setGridActive(true)
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('grid active gate (panel kept alive across mode switches)', () => {
  it('tab-focus auto-refresh is suppressed while the grid is not the visible mode', async () => {
    mountGrid()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1) // the onMounted fetch

    setGridActive(false) // user switched to Task/Explore
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000) // data goes stale
    fireVisibilityChange()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1) // still just the initial fetch
  })

  it('returning to View refetches when the data is stale (>30s)', async () => {
    mountGrid()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    setGridActive(false)
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000)
    setGridActive(true) // back to View after a minute
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returning to View quickly does NOT refetch (data still fresh)', async () => {
    mountGrid()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    setGridActive(false)
    setGridActive(true) // immediate bounce
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('activation before any fetch ever happened defers to the onMounted fetch', async () => {
    // Never-fetched state: activate first, then mount.
    setGridActive(false)
    setGridActive(true)
    mountGrid()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1) // only the mount fetch, no double
  })

  it('tab-focus auto-refresh still works while the grid IS the visible mode', async () => {
    mountGrid()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000)
    fireVisibilityChange()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
