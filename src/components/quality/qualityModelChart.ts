// v10.196: pure ECharts option builder for the Quality Trend Modelling chart.
// All chart semantics live here (testable without rendering); the component
// only wires init/setOption/resize/dispose. Data comes from useQualityModel's
// ModelSeries — this module is presentation only.

import type { ModelSeries } from '@/composables/useQualityModel'

/** Theme colors resolved from the CSS variables of the mounted element. */
export interface ChartTheme {
  textMuted: string
  textPrimary: string
  borderColor: string
  accentBlue: string
  bgTertiary: string
}

/** Team color by golden-angle hue spread over the displayed series order —
 *  maximal separation at any team count (v10.198: the old name-hash put ~5 of
 *  18 production teams on near-identical greens). Colors may shift when
 *  filters change which teams are visible; hover/legend/tooltip carry
 *  identity. `teamKey` stays in the signature for call-site readability. */
export function colorOf(_teamKey: string, index: number): string {
  const hue = Math.round(((index * 137.508) % 360) * 10) / 10
  return `hsl(${hue}, 62%, 52%)`
}

const LINE_WIDTH = 2 // v10.195: ONE width for every curve, including all-teams

interface TooltipParams {
  seriesName: string
  dataIndex: number
  value: number
}

export interface ChartLabels {
  allTeams: string
  tickets: string
}

export function buildChartOption(
  series: ModelSeries[],
  slotLabels: string[],
  bucketsLength: number,
  theme: ChartTheme,
  labels: ChartLabels,
  /** v10.199: this team's uncertainty band is shown in addition to all-teams. */
  hoveredKey: string | null = null,
) {
  const slotCount = slotLabels.length
  const nameOf = (s: ModelSeries) => (s.team_key === '*' ? labels.allTeams : s.team_key)
  const lastHistoryLabel = slotLabels[bucketsLength - 1]
  const countsByName = new Map<string, number[]>()

  const chartSeries: object[] = []
  let teamIdx = 0
  series.forEach((s, idx) => {
    const name = nameOf(s)
    const color = s.team_key === '*' ? theme.accentBlue : colorOf(s.team_key, teamIdx++)
    countsByName.set(name, s.counts)

    // Solid history line — nulls stay nulls (native gaps), padded to all slots.
    const historyData: Array<number | null> = [
      ...s.history,
      ...Array.from({ length: slotCount - s.history.length }, () => null),
    ]
    chartSeries.push({
      name,
      type: 'line',
      data: historyData,
      lineStyle: { width: LINE_WIDTH, color },
      itemStyle: { color },
      symbol: 'circle',
      symbolSize: 6,
      emphasis: { focus: 'series' },
      // History/forecast divider — attached to the first series only.
      ...(idx === 0
        ? {
            markLine: {
              silent: true,
              symbol: 'none',
              label: { show: false },
              lineStyle: { color: theme.textMuted, type: 'dashed', width: 1 },
              data: [{ xAxis: lastHistoryLabel }],
            },
          }
        : {}),
    })

    // Dashed forecast, anchored at the last known history point so the line
    // connects across the divider. Same name → one legend entry per team.
    if (s.forecast.length > 0) {
      const lastIdx = s.history.reduce<number>((acc, v, i) => (v !== null ? i : acc), -1)
      if (lastIdx !== -1) {
        const forecastData: Array<number | null> = Array.from({ length: slotCount }, () => null)
        forecastData[lastIdx] = s.history[lastIdx]
        s.forecast.forEach((v, k) => { forecastData[bucketsLength + k] = v })
        chartSeries.push({
          name,
          type: 'line',
          data: forecastData,
          // v10.198: the anchor may sit BEFORE trailing empty history buckets
          // (team data ends early) — connect across those nulls or the
          // forecast floats detached from its history line. Safe here: a
          // forecast series has no real gaps to preserve (history does).
          connectNulls: true,
          lineStyle: { width: LINE_WIDTH, color, type: 'dashed' },
          itemStyle: { color },
          symbol: 'circle',
          symbolSize: 5,
          emphasis: { focus: 'series' },
        })
      }
    }

    // v10.199: uncertainty band — all-teams always, plus the hovered team.
    // Standard ECharts CI pattern: a silent invisible "lower" carrier line
    // stacked with an (upper − lower) area on top of it.
    if (s.band && (s.team_key === '*' || s.team_key === hoveredKey)) {
      const nulls = () => Array.from({ length: slotCount }, () => null as number | null)
      const lowerData = nulls()
      const diffData = nulls()
      s.band.lower.forEach((lo, k) => {
        lowerData[bucketsLength + k] = lo
        diffData[bucketsLength + k] = s.band!.upper[k] - lo
      })
      const bandBase = {
        type: 'line',
        stack: `band-${s.team_key}`,
        silent: true,
        symbol: 'none',
        lineStyle: { width: 0, opacity: 0, color },
        emphasis: { disabled: true },
        tooltip: { show: false },
        legendHoverLink: false,
        z: 1,
      }
      chartSeries.push({ ...bandBase, name: `${name}__band-lo`, data: lowerData })
      chartSeries.push({
        ...bandBase,
        name: `${name}__band-hi`,
        data: diffData,
        areaStyle: { color, opacity: 0.15 },
      })
    }
  })

  // Legend in stable reading order: all-teams first, then teams as given.
  const legendData = [
    ...series.filter(s => s.team_key === '*').map(nameOf),
    ...series.filter(s => s.team_key !== '*').map(nameOf),
  ]

  return {
    animationDuration: 200,
    grid: { left: 44, right: 16, top: 16, bottom: 56, containLabel: false },
    xAxis: {
      type: 'category',
      data: slotLabels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: theme.borderColor } },
      axisLabel: { color: theme.textMuted },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: theme.borderColor } },
      axisLabel: { color: theme.textMuted },
    },
    legend: {
      type: 'scroll',
      bottom: 0,
      data: legendData,
      textStyle: { color: theme.textPrimary },
      inactiveColor: theme.textMuted,
      pageIconColor: theme.textPrimary,
      pageTextStyle: { color: theme.textMuted },
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: theme.bgTertiary,
      borderColor: theme.borderColor,
      textStyle: { color: theme.textPrimary },
      formatter: (p: TooltipParams) => {
        // v10.199: surface the evidence — how many tickets back this point.
        // Forecast slots and empty buckets have no count to show.
        const n = p.dataIndex < bucketsLength ? countsByName.get(p.seriesName)?.[p.dataIndex] ?? 0 : 0
        const suffix = n > 0 ? ` (${n} ${labels.tickets})` : ''
        return `${p.seriesName} ${slotLabels[p.dataIndex]}: ${p.value}${suffix}`
      },
    },
    series: chartSeries,
  }
}
