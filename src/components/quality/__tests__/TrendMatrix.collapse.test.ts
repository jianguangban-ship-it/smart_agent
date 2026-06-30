import { describe, it, expect, beforeAll, afterEach } from 'vitest'

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
import TrendMatrix from '../TrendMatrix.vue'
import type { PeriodSummary } from '@/composables/useQualityGrid'

const SUMMARY: PeriodSummary = {
  total: 3,
  periodCounts: { A: 2, C: 1 },
  byTeam: [],
  matrix: [
    {
      team_key: 'DKKF',
      team: 'Team DKKF',
      total: 3,
      cells: [
        { bucketLabel: 'W1', counts: { A: 2 }, total: 2 },
        { bucketLabel: 'W2', counts: { C: 1 }, total: 1 },
      ],
    },
  ],
  bucketLabels: ['W1', 'W2'],
}

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('TrendMatrix all-teams row', () => {
  it('omits the synthetic Σ row when only one team is present', () => {
    // With a team filter active the matrix collapses to one row; an "all
    // teams" sum would be a byte-identical duplicate of it.
    wrapper = mount(TrendMatrix, { props: { summary: SUMMARY } })
    expect(wrapper.find('.all-row').exists()).toBe(false)
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
  })

  it('keeps the synthetic Σ row for multi-team matrices', () => {
    const multi: PeriodSummary = {
      ...SUMMARY,
      total: 4,
      matrix: [
        ...SUMMARY.matrix,
        {
          team_key: 'PDSW',
          team: 'Team PDSW',
          total: 1,
          cells: [
            { bucketLabel: 'W1', counts: { A: 1 }, total: 1 },
            { bucketLabel: 'W2', counts: {}, total: 0 },
          ],
        },
      ],
    }
    wrapper = mount(TrendMatrix, { props: { summary: multi } })
    expect(wrapper.find('.all-row').exists()).toBe(true)
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
  })
})

// v10.190: the animated collapse + its a11y moved up to QualityGridPanel's
// shared trend-board header (tested in QualityGridPanel.trendtabs.test.ts);
// TrendMatrix is now the table only.
describe('TrendMatrix table', () => {
  it('renders the matrix table for a non-empty summary', () => {
    wrapper = mount(TrendMatrix, { props: { summary: SUMMARY } })
    expect(wrapper.find('.trend-table').exists()).toBe(true)
  })
})
