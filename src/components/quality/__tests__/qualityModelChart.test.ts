// v10.196: ECharts option builder for the Quality Trend Modelling chart.
// Pure function — these tests pin the full chart contract (series pairing,
// dashed forecast anchored at the last history point, uniform widths, theme
// colors, axes, divider, legend order, tooltip text) without any rendering.

import { describe, it, expect } from 'vitest'
import { buildChartOption, colorOf, type ChartTheme } from '../qualityModelChart'
import type { ModelSeries } from '@/composables/useQualityModel'

const THEME: ChartTheme = {
  textMuted: '#a5a19a',
  textPrimary: '#eceae6',
  borderColor: '#4A4740',
  accentBlue: '#6BAAE0',
  bgTertiary: '#3A3935',
}

const ALL: ModelSeries = {
  team_key: '*', team: 'all',
  history: [80, 80, 60],
  counts: [10, 12, 8],
  forecast: [50, 40, 30],
  band: { lower: [40, 28, 18], upper: [60, 52, 42] },
}
const DKKF: ModelSeries = {
  team_key: 'DKKF', team: 'Team DKKF',
  history: [60, null, 100], // gap in the middle bucket
  counts: [3, 0, 5],
  forecast: [100, 100, 100],
  band: { lower: [90, 88, 86], upper: [100, 100, 100] },
}
const THIN: ModelSeries = {
  team_key: 'PDSW', team: 'Team PDSW',
  history: [70, null, null],
  counts: [2, 0, 0],
  forecast: [], // too thin to fit
  band: null,
}

const SLOTS = ['5/1', '5/2', '5/3', '+1', '+2', '+3']
const BUCKETS = 3
const LABELS = { allTeams: 'ALL TEAMS', tickets: 'tickets' }

function opt(hoveredKey: string | null = null) {
  return buildChartOption([ALL, DKKF, THIN], SLOTS, BUCKETS, THEME, LABELS, hoveredKey)
}

type LineSeries = {
  name: string
  data: Array<number | null>
  lineStyle: { width: number; type?: string; color: string; opacity?: number }
  markLine?: { data: Array<{ xAxis: string }> }
  connectNulls?: boolean
  stack?: string
  silent?: boolean
  areaStyle?: { opacity: number; color: string }
}

const isBand = (s: LineSeries) => Boolean(s.stack?.startsWith('band-'))
const visible = (s: LineSeries[]) => s.filter(x => !isBand(x))

describe('buildChartOption', () => {
  it('emits a history series per team and a forecast series only when a forecast exists', () => {
    const series = visible(opt().series as LineSeries[])
    // 3 history + 2 forecast (THIN has none)
    expect(series).toHaveLength(5)
    expect(series.filter(s => s.lineStyle.type === 'dashed')).toHaveLength(2)
  })

  it('history and forecast twins share one name so the legend links them', () => {
    const series = visible(opt().series as LineSeries[])
    const names = series.map(s => s.name)
    expect(names.filter(n => n === 'ALL TEAMS')).toHaveLength(2)
    expect(names.filter(n => n === 'DKKF')).toHaveLength(2)
    expect(names.filter(n => n === 'PDSW')).toHaveLength(1)
  })

  it('keeps null gaps in history data and pads it to the full slot count', () => {
    const series = opt().series as LineSeries[]
    const dkkf = series.find(s => s.name === 'DKKF' && s.lineStyle.type !== 'dashed')!
    expect(dkkf.data).toEqual([60, null, 100, null, null, null])
  })

  it('anchors the dashed forecast at the last known history point', () => {
    const series = opt().series as LineSeries[]
    const fc = series.find(s => s.name === 'DKKF' && s.lineStyle.type === 'dashed')!
    // anchor at index 2 (last history value 100), then the forecast slots
    expect(fc.data).toEqual([null, null, 100, 100, 100, 100])
  })

  it('forecast lines connect across null buckets; history keeps real gaps', () => {
    // v10.198 screenshot bug: a team whose data ends BEFORE the last history
    // bucket gets a null between its anchor and "+1" — without connectNulls
    // ECharts breaks the line and the forecast floats disconnected.
    const series = visible(opt().series as LineSeries[])
    for (const s of series) {
      if (s.lineStyle.type === 'dashed') expect(s.connectNulls).toBe(true)
      else expect(s.connectNulls ?? false).toBe(false)
    }
  })

  it('all curves share one 2px width; the all-teams series keeps the accent color', () => {
    const series = visible(opt().series as LineSeries[])
    for (const s of series) expect(s.lineStyle.width).toBe(2)
    const all = series.find(s => s.name === 'ALL TEAMS')!
    expect(all.lineStyle.color).toBe(THEME.accentBlue)
    // Teams are colored by their position in the series (golden-angle spread,
    // all-teams excluded): DKKF is team #0, PDSW team #1.
    const dkkf = series.find(s => s.name === 'DKKF')!
    expect(dkkf.lineStyle.color).toBe(colorOf('DKKF', 0))
    const pdsw = series.find(s => s.name === 'PDSW')!
    expect(pdsw.lineStyle.color).toBe(colorOf('PDSW', 1))
  })

  it('uses a 0–100 y axis and the slot labels on x', () => {
    const o = opt() as { xAxis: { data: string[] }; yAxis: { min: number; max: number } }
    expect(o.xAxis.data).toEqual(SLOTS)
    expect(o.yAxis.min).toBe(0)
    expect(o.yAxis.max).toBe(100)
  })

  it('draws the history/forecast divider at the last history bucket', () => {
    const series = opt().series as LineSeries[]
    const withMark = series.find(s => s.markLine)
    expect(withMark?.markLine?.data[0]?.xAxis).toBe('5/3')
  })

  it('legend lists the all-teams entry first and scrolls', () => {
    const o = opt() as { legend: { type: string; data: string[] } }
    expect(o.legend.type).toBe('scroll')
    expect(o.legend.data[0]).toBe('ALL TEAMS')
    expect(o.legend.data).toContain('DKKF')
  })

  it('hover focuses the series (pop + blur others); band series stay inert', () => {
    const series = opt().series as Array<LineSeries & { emphasis: { focus?: string; disabled?: boolean } }>
    for (const s of series) {
      if (isBand(s)) expect(s.emphasis.disabled).toBe(true)
      else expect(s.emphasis.focus).toBe('series')
    }
  })

  it('item tooltip names the team, bucket, score, and the bucket ticket count', () => {
    const o = opt() as { tooltip: { trigger: string; formatter: (p: unknown) => string } }
    expect(o.tooltip.trigger).toBe('item')
    const text = o.tooltip.formatter({ seriesName: 'DKKF', dataIndex: 2, value: 100 })
    expect(text).toContain('DKKF')
    expect(text).toContain('5/3')
    expect(text).toContain('100')
    expect(text).toContain('(5 tickets)') // counts[2] of DKKF
  })

  it('tooltip omits the count on forecast slots and zero-count buckets', () => {
    const o = opt() as { tooltip: { formatter: (p: unknown) => string } }
    expect(o.tooltip.formatter({ seriesName: 'DKKF', dataIndex: 4, value: 100 })).not.toContain('tickets')
    expect(o.tooltip.formatter({ seriesName: 'DKKF', dataIndex: 1, value: 0 })).not.toContain('tickets')
  })

  describe('uncertainty band (v10.199)', () => {
    it('renders the all-teams band always: a silent stacked lower line + area diff over the forecast slots', () => {
      const series = opt().series as LineSeries[]
      const band = series.filter(s => s.stack === 'band-*')
      expect(band).toHaveLength(2)
      const [lower, diff] = band
      // lower: invisible carrier at the band's lower edge, forecast slots only
      expect(lower.data).toEqual([null, null, null, 40, 28, 18])
      expect(lower.silent).toBe(true)
      expect(lower.areaStyle).toBeUndefined()
      // diff: upper − lower, shaded
      expect(diff.data).toEqual([null, null, null, 20, 24, 24])
      expect(diff.areaStyle?.opacity).toBeCloseTo(0.15, 5)
      expect(diff.areaStyle?.color).toBe(THEME.accentBlue)
    })

    it('band series stay out of the legend', () => {
      const o = opt() as { legend: { data: string[] }; series: LineSeries[] }
      for (const name of o.legend.data) {
        expect(o.series.filter(s => s.name === name).every(s => !isBand(s))).toBe(true)
      }
    })

    it('a hovered team gets its band too (in its own color); none otherwise', () => {
      const plain = opt().series as LineSeries[]
      expect(plain.some(s => s.stack === 'band-DKKF')).toBe(false)

      const hovered = opt('DKKF').series as LineSeries[]
      const band = hovered.filter(s => s.stack === 'band-DKKF')
      expect(band).toHaveLength(2)
      expect(band[1].areaStyle?.color).toBe(colorOf('DKKF', 0))
    })

    it('teams without a band emit none even when hovered', () => {
      const series = opt('PDSW').series as LineSeries[]
      expect(series.some(s => s.stack === 'band-PDSW')).toBe(false)
    })
  })

  it('colorOf spreads hues by golden angle — adjacent teams are maximally separated', () => {
    // v10.198: the old name-hash put ~5 of 18 prod teams on near-identical
    // greens. Hue is now index-driven: i × 137.508° (mod 360).
    expect(colorOf('A', 0)).toBe('hsl(0, 62%, 52%)')
    expect(colorOf('B', 1)).toBe('hsl(137.5, 62%, 52%)')
    expect(colorOf('C', 2)).toBe('hsl(275, 62%, 52%)')
    // deterministic, and the name itself doesn't matter
    expect(colorOf('ANY', 1)).toBe(colorOf('OTHER', 1))
    expect(colorOf('SAME', 0)).not.toBe(colorOf('SAME', 1))
  })
})
