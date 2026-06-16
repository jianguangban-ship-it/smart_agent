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

describe('filteredSummary (per-team trend follows the grid filters)', () => {
  it('narrows the matrix to the selected team', async () => {
    mountGrid()
    await flushPromises()
    expect(grid.filteredSummary.value.matrix.map(r => r.team_key)).toEqual(['DKKF', 'PDSW'])

    filterTeam.value = 'PDSW'
    await nextTick()

    expect(grid.filteredSummary.value.matrix.map(r => r.team_key)).toEqual(['PDSW'])
    expect(grid.filteredSummary.value.total).toBe(1)
  })

  it('narrows periodCounts to the selected status', async () => {
    mountGrid()
    await flushPromises()
    expect(grid.filteredSummary.value.periodCounts).toEqual({ A: 2, C: 1 })

    filterStatus.value = 'C'
    await nextTick()

    expect(grid.filteredSummary.value.periodCounts).toEqual({ C: 1 })
  })

  it('reacts to search only after the 250ms debounce', async () => {
    mountGrid()
    await flushPromises()
    expect(grid.filteredSummary.value.total).toBe(3)

    vi.useFakeTimers()
    searchText.value = 'gamma'
    await nextTick()
    expect(grid.filteredSummary.value.total).toBe(3)

    vi.advanceTimersByTime(250)
    await nextTick()
    expect(grid.filteredSummary.value.total).toBe(1)
    expect(grid.filteredSummary.value.matrix.map(r => r.team_key)).toEqual(['PDSW'])
  })
})
