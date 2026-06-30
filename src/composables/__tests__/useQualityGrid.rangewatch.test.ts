// v10.234: regression guard. The View grid watches the timing window and
// refetches when it changes. `range` (useTimingPhase) depends on `now`
// (useSprint), which ticks every 60s. The watch source MUST be an array of
// getters so Vue compares each value with Object.is — a single getter returning
// a fresh [from,to] array fires on EVERY 60s tick (new array reference) and
// silently re-polls the server, which is the auto-refresh we removed.

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

import { defineComponent, h } from 'vue'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { useQualityGrid } from '../useQualityGrid'
import { _setNowForTesting, stopSprintClock } from '@/composables/useSprint'
import { setPhaseKind, setPreset, _resetTimingPhaseForTesting } from '@/composables/useTimingPhase'
import type { QualityTicket } from '@/types/quality'

const SAMPLE: QualityTicket[] = [{
  issueKey: 'X-1', issueType: 'Story', project: 'IDC_PDSW',
  team_key: 'DKKF', team: 'Team DKKF', summary: 's', points: 1,
  assignee: 'u', displayName: 'U', agentCheck: '', status: 'A',
  action: 'create', timestamp: '2026-05-07T10:00:00Z',
}]

let wrapper: VueWrapper | null = null
let fetchMock: ReturnType<typeof vi.fn>

// Fixed base time so range presets resolve deterministically.
const BASE = new Date('2026-06-10T09:00:00Z')

function mountGrid() {
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => SAMPLE } as unknown as Response))
  vi.stubGlobal('fetch', fetchMock)
  const Host = defineComponent({
    setup() { useQualityGrid(); return () => h('div') },
  })
  wrapper = mount(Host)
}

beforeEach(() => {
  stopSprintClock() // the real 60s interval must not interfere
  _resetTimingPhaseForTesting()
  _setNowForTesting(new Date(BASE))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('timing-window watch fires only on real window change', () => {
  it('does NOT refetch when the 60s clock ticks but the window is unchanged', async () => {
    mountGrid()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1) // onMounted fetch

    // Advance the shared clock one minute, same day / same sprint → range
    // start+end are identical → no refetch.
    _setNowForTesting(new Date(BASE.getTime() + 60_000))
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // A few more ticks, still within the day.
    _setNowForTesting(new Date(BASE.getTime() + 120_000))
    _setNowForTesting(new Date(BASE.getTime() + 180_000))
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('DOES refetch when the timing window genuinely changes', async () => {
    mountGrid()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Switch to a calendar preset whose from/to differ from the default window.
    setPhaseKind('calendar')
    setPreset('last30')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
