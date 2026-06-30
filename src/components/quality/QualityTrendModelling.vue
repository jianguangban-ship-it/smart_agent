<template>
  <div class="model-wrap">
    <div v-if="series.length === 0" class="model-empty">{{ t('view.empty') }}</div>

    <template v-else>
      <!-- v10.196: Apache ECharts (SVG renderer) replaces the hand-rolled SVG.
           Chart semantics live in qualityModelChart.ts (pure, tested); this
           component only owns the instance lifecycle. -->
      <div ref="chartEl" class="model-chart-host" role="img" :aria-label="t('view.modelTitle')"></div>

      <div v-if="trend" class="model-trend" :class="`model-trend--${trend.dir}`">
        {{ trend.arrow }} {{ t(trend.label) }} ({{ trend.slopeText }})
      </div>
      <div class="model-note">{{ t('view.modelFormula') }}</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted, toRaw } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import { useI18n } from '@/i18n'
import { buildSeries, trendSlope, FORECAST_HORIZON, type ModelSeries } from '@/composables/useQualityModel'
import { buildChartOption, type ChartTheme } from './qualityModelChart'
import type { PhaseBucket } from '@/composables/useTimingPhase'
import type { QualityTicket } from '@/types/quality'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, SVGRenderer])

const props = defineProps<{
  /** The FILTERED ticket set (v10.189 semantics — chart shows what the grid shows). */
  tickets: QualityTicket[]
  /** History buckets from useTimingPhase — one x slot each, plus forecast slots. */
  buckets: PhaseBucket[]
}>()
const { t } = useI18n()

// The quality-model build (~100-200ms over the filtered set) runs OFF the main
// thread in a Web Worker so a period/filter change never blocks interaction.
// Requests are debounced + id-tagged (stale results dropped); falls back to a
// synchronous build when Worker is unavailable (jsdom/tests) or fails.
const series = ref<ModelSeries[]>([])
let worker: Worker | null = null
let reqId = 0
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let firstBuild = true

function computeSync(): void {
  series.value = props.tickets.length === 0 ? [] : buildSeries(props.tickets, props.buckets)
}

function ensureWorker(): Worker | null {
  if (worker) return worker
  if (typeof Worker === 'undefined') return null
  try {
    worker = new Worker(new URL('../../workers/qualityModel.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ id: number; series: ModelSeries[] }>) => {
      if (e.data.id === reqId) series.value = e.data.series
    }
    worker.onerror = () => { worker?.terminate(); worker = null; computeSync() }
    return worker
  } catch {
    worker = null
    return null
  }
}

function recompute(): void {
  if (props.tickets.length === 0) { series.value = []; return }
  const w = ensureWorker()
  if (!w) { computeSync(); return }
  const id = ++reqId
  try {
    w.postMessage({ id, tickets: toRaw(props.tickets), buckets: toRaw(props.buckets), horizon: FORECAST_HORIZON })
  } catch {
    computeSync() // structured-clone failure → sync fallback
  }
}

watch([() => props.tickets, () => props.buckets], () => {
  if (firstBuild) { firstBuild = false; recompute(); return } // initial build immediate
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(recompute, 120)
}, { immediate: true })

onUnmounted(() => {
  worker?.terminate()
  worker = null
  if (debounceTimer) clearTimeout(debounceTimer)
})

const allSeries = computed(() => series.value.find(s => s.team_key === '*') ?? null)

// The regression slope m of the all-teams line — m > 0 improving, m < 0
// declining (|m| < 0.5 pts/bucket reads as stable noise). Rendered as Vue DOM
// below the chart, unchanged from the SVG version.
const trend = computed(() => {
  if (!allSeries.value) return null
  const m = trendSlope(allSeries.value.history, allSeries.value.counts)
  if (m === null) return null
  const dir = Math.abs(m) < 0.5 ? 'flat' : m > 0 ? 'up' : 'down'
  return {
    dir,
    arrow: dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→',
    label: dir === 'up' ? 'view.modelTrendUp' : dir === 'down' ? 'view.modelTrendDown' : 'view.modelTrendFlat',
    slopeText: `${m > 0 ? '+' : ''}${m.toFixed(1)} / ${t('view.modelPerBucket')}`,
  }
})

const slotLabels = computed(() => [
  ...props.buckets.map(b => b.label),
  ...Array.from({ length: FORECAST_HORIZON }, (_, k) => `+${k + 1}`),
])

// --- chart instance lifecycle ----------------------------------------------

const chartEl = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

function readTheme(el: HTMLElement): ChartTheme {
  const cs = getComputedStyle(el)
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  return {
    textMuted: v('--text-muted', '#a5a19a'),
    textPrimary: v('--text-primary', '#eceae6'),
    borderColor: v('--border-color', '#4A4740'),
    accentBlue: v('--accent-blue', '#6BAAE0'),
    bgTertiary: v('--bg-tertiary', '#3A3935'),
  }
}

// v10.199: the hovered team additionally shows its uncertainty band.
const hoveredBandKey = ref<string | null>(null)

function render(): void {
  if (!chart || !chartEl.value) return
  chart.setOption(
    buildChartOption(
      series.value,
      slotLabels.value,
      props.buckets.length,
      readTheme(chartEl.value),
      { allTeams: t('view.allTeamsRow'), tickets: t('view.modelTickets') },
      hoveredBandKey.value,
    ),
    { notMerge: true },
  )
}

function keyFromSeriesName(name: string): string | null {
  if (!name || name.includes('__band')) return null
  return name === t('view.allTeamsRow') ? '*' : name
}

// The host div appears/disappears with the empty-state v-if, and the panel
// itself is kept alive behind v-show — bind to the template ref, not mount.
watch(chartEl, el => {
  if (el && !chart) {
    chart = echarts.init(el, null, { renderer: 'svg' })
    chart.on('mouseover', (p) => {
      const key = keyFromSeriesName((p as { seriesName?: string }).seriesName ?? '')
      if (key && key !== hoveredBandKey.value) {
        hoveredBandKey.value = key
        render()
      }
    })
    chart.on('mouseout', () => {
      if (hoveredBandKey.value !== null) {
        hoveredBandKey.value = null
        render()
      }
    })
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => chart?.resize())
      ro.observe(el)
    }
    render()
  } else if (!el && chart) {
    ro?.disconnect()
    ro = null
    chart.dispose()
    chart = null
  }
}, { flush: 'post' })

watch([series, slotLabels], () => render())

onUnmounted(() => {
  ro?.disconnect()
  ro = null
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.model-wrap {
  padding: var(--space-2) 0;
}
.model-chart-host {
  width: 100%;
  height: 450px;
}
.model-trend {
  margin-top: var(--space-2);
  font-size: var(--font-sm);
  font-weight: 700;
}
.model-trend--up {
  color: var(--accent-green, #3fb950);
}
.model-trend--down {
  color: var(--accent-red);
}
.model-trend--flat {
  color: var(--text-muted);
}
.model-note {
  margin-top: var(--space-1);
  font-size: var(--font-xs);
  color: var(--text-muted);
  font-style: italic;
}
.model-empty {
  padding: var(--space-4);
  text-align: center;
  color: var(--text-muted);
  font-size: var(--font-sm);
}
</style>
