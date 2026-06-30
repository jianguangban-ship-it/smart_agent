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
import { filterTeam, filterStatus, searchText } from '@/composables/useQualityGrid'
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
  tk({ issueKey: 'A-2', status: 'A' }),
  tk({ issueKey: 'A-3', status: 'C' }),
]

function okResponse(data: QualityTicket[]): Response {
  return { ok: true, json: async () => data } as unknown as Response
}

const STUBS = {
  DynamicScroller: { template: '<div class="scroller-stub" />', props: ['items', 'minItemSize', 'keyField'] },
  DynamicScrollerItem: true,
  PeriodSelector: true,
  TrendMatrix: true,
  AgentCheckModal: true,
}

let wrapper: VueWrapper | null = null

afterEach(async () => {
  wrapper?.unmount()
  wrapper = null
  // Module-singleton filter refs — reset under fake timers so the debounced
  // searchText reset flushes (same gotcha as useQualityGrid.debounce.test.ts).
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

function chipCounts(w: VueWrapper): Record<string, string> {
  const out: Record<string, string> = {}
  for (const chip of w.findAll('.chip')) {
    out[chip.find('.chip-label').text()] = chip.find('.chip-count').text()
  }
  return out
}

describe('Mission Quality bar reflects the filtered ticket set', () => {
  it('chips narrow to the filtered status and recover when the filter clears', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse(SAMPLE)))
    wrapper = mount(QualityGridPanel, { global: { stubs: STUBS } })
    await flushPromises()
    expect(chipCounts(wrapper)).toEqual({ A: '2', C: '1' })

    filterStatus.value = 'C'
    await nextTick()
    expect(chipCounts(wrapper)).toEqual({ C: '1' })
    // Percentages are shares of the FILTERED set — a lone C is 100%.
    expect(wrapper.find('.chip-ratio').text()).toContain('100%')

    filterStatus.value = ''
    await nextTick()
    expect(chipCounts(wrapper)).toEqual({ A: '2', C: '1' })
  })

  it('the count label keeps the whole-period reference (showing X of Y)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse(SAMPLE)))
    wrapper = mount(QualityGridPanel, { global: { stubs: STUBS } })
    await flushPromises()

    filterStatus.value = 'C'
    await nextTick()
    const label = wrapper.find('.summary-total').text()
    expect(label).toContain('1')
    expect(label).toContain('3')
  })
})
