<template>
  <div class="summary-bar">
    <!-- v10.136: this bar absorbs the Refresh button + count that used to
         live in the panel-header's right side. The summary-head row now
         holds the period title block + chips on the left and the Refresh
         button on the right; the chips wrap to a new line on narrow
         viewports while Refresh stays anchored to the right of the head. -->
    <div class="summary-head">
      <div class="summary-head-left">
        <span class="summary-title">{{ t('view.summaryTitle') }}</span>
        <span class="summary-period">{{ range.label }}</span>
        <span class="summary-total">{{ countLabel }}</span>
        <div v-if="summary.total > 0" class="chips">
          <span
            v-for="s in orderedStatuses"
            :key="s"
            class="chip"
            :title="s"
          >
            <span class="dot" :style="{ backgroundColor: colorForStatus(s) }"></span>
            <span class="chip-label">{{ s }}</span>
            <span class="chip-count" :class="{ 'chip-count--tick': changedStatuses.has(s) }">{{ summary.periodCounts[s] }}</span>
            <span class="chip-ratio">{{ ratioFor(s) }}</span>
          </span>
        </div>
      </div>
      <div class="summary-head-right">
        <!-- v10.184: visible heartbeat for every fetch — including the 30s
             tab-focus auto-refresh, which previously had no UI signal. -->
        <span v-if="loading" class="refresh-spinner" aria-hidden="true"></span>
        <span v-if="updatedLabel" class="updated-at" :class="{ pulse }">{{ updatedLabel }}</span>
        <button class="refresh-btn" :disabled="loading" @click="$emit('refresh')">
          <span v-if="loading">{{ t('view.refreshing') }}</span>
          <span v-else>{{ t('view.refresh') }}</span>
        </button>
      </div>
    </div>
    <!-- v10.189: `summary` is the FILTERED set, so "empty period" must gate on
         the raw period total — filters matching nothing is not an empty period
         (the list below shows its own no-match state). -->
    <div v-if="(totalCount ?? summary.total) === 0" class="summary-empty">{{ t('view.periodEmpty') }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { useI18n } from '@/i18n'
import { colorForStatus } from '@/types/quality'
import { range } from '@/composables/useTimingPhase'
import type { PeriodSummary } from '@/composables/useQualityGrid'

const props = defineProps<{
  /** v10.189: the FILTERED summary — chips/ratios describe what the user is looking at. */
  summary: PeriodSummary
  /** Number of tickets visible after Team/Status/Search filters. */
  filteredCount?: number
  /** Total tickets in the current period (before filters). */
  totalCount?: number
  /** Disables the Refresh button while a fetch is in flight. */
  loading?: boolean
  /** Epoch ms of the last successful fetch; 0 = never fetched. */
  lastFetched?: number
}>()
defineEmits<{ refresh: [] }>()
const { t } = useI18n()

/**
 * v10.184: "Updated HH:MM" next to the Refresh button. Pulses briefly when
 * lastFetched advances so even the silent 30s tab-focus auto-refresh gets a
 * visible acknowledgement. The first value (initial load) doesn't pulse.
 */
const updatedLabel = computed((): string => {
  if (!props.lastFetched) return ''
  const d = new Date(props.lastFetched)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return t('view.updatedAt').replace('{time}', `${hh}:${mm}`)
})

const pulse = ref(false)
let pulseTimer: ReturnType<typeof setTimeout> | undefined
watch(() => props.lastFetched, (now, prev) => {
  if (!prev || !now || now === prev) return
  pulse.value = true
  clearTimeout(pulseTimer)
  pulseTimer = setTimeout(() => { pulse.value = false }, 900)
})

/**
 * v10.184: chips whose count just changed get a brief scale "tick" so a
 * refresh that shifts the distribution is noticeable. Skips the initial
 * population — only statuses already on screen can tick.
 */
const changedStatuses = ref<Set<string>>(new Set())
let prevCounts: Record<string, number> = {}
let tickTimer: ReturnType<typeof setTimeout> | undefined
watch(() => props.summary.periodCounts, (counts) => {
  const hit = new Set<string>()
  for (const s of Object.keys(counts)) {
    if (prevCounts[s] !== undefined && prevCounts[s] !== counts[s]) hit.add(s)
  }
  prevCounts = { ...counts }
  if (hit.size > 0) {
    changedStatuses.value = hit
    clearTimeout(tickTimer)
    tickTimer = setTimeout(() => { changedStatuses.value = new Set() }, 600)
  }
}, { immediate: true })

onUnmounted(() => {
  clearTimeout(pulseTimer)
  clearTimeout(tickTimer)
})

/**
 * v10.136: shows the same filter-aware count that used to live in the
 * panel-header's count-label. Falls back to summary.total when the optional
 * props aren't passed (keeps the component usable in isolation if anyone
 * ever drops it elsewhere).
 */
const countLabel = computed((): string => {
  const total = props.totalCount ?? props.summary.total
  const filtered = props.filteredCount ?? total
  if (filtered === total) {
    return t('view.countLabel').replace('{n}', String(total))
  }
  return t('view.countFiltered')
    .replace('{filtered}', String(filtered))
    .replace('{total}', String(total))
})

const CANONICAL = ['A', 'B', 'C', 'D', '格式异常', '未知']

// Canonical taxonomy first (in order), then any off-taxonomy drift values.
const orderedStatuses = computed(() => {
  const present = Object.keys(props.summary.periodCounts)
  const canon = CANONICAL.filter(s => present.includes(s))
  const drift = present.filter(s => !CANONICAL.includes(s)).sort()
  return [...canon, ...drift]
})

/**
 * v10.135: show each status's share of the period total alongside its raw
 * count. Format adapts to magnitude — 1 decimal under 10%, 0 above — so big
 * shares read like "57%" and small shares like "2.2%" instead of "57.0%"
 * and "2%". Returns empty string when total is 0 (caller v-ifs on total).
 */
function ratioFor(status: string): string {
  const total = props.summary.total
  if (total <= 0) return ''
  const n = props.summary.periodCounts[status] ?? 0
  const pct = (n / total) * 100
  return pct < 10 ? pct.toFixed(1) + '%' : Math.round(pct) + '%'
}
</script>

<style scoped>
.summary-bar {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--border-color);
}
.summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: nowrap;
}
.summary-head-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;       /* chips wrap onto a new line below the head text */
  flex: 1;
  min-width: 0;
}
.summary-title {
  font-size: var(--font-sm);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}
.summary-period {
  font-size: var(--font-base);
  font-weight: 600;
  color: var(--text-primary);
}
.summary-total {
  font-size: var(--font-sm);
  font-weight: 700;
  color: var(--accent-blue);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.summary-head-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}
.refresh-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent-blue);
  border-radius: 50%;
  animation: spinner-rotate 0.8s linear infinite;
}
@keyframes spinner-rotate {
  to { transform: rotate(360deg); }
}
.updated-at {
  font-size: var(--font-xs);
  color: var(--text-muted);
  white-space: nowrap;
}
.updated-at.pulse {
  animation: updated-pulse 0.9s ease;
}
@keyframes updated-pulse {
  0% { color: var(--accent-blue); }
  100% { color: var(--text-muted); }
}
.chip-count--tick {
  animation: chip-tick 0.5s ease;
}
@keyframes chip-tick {
  0% { transform: scale(1); }
  40% { transform: scale(1.25); color: var(--accent-blue); }
  100% { transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .refresh-spinner,
  .updated-at.pulse,
  .chip-count--tick {
    animation: none;
  }
}
.refresh-btn {
  flex-shrink: 0;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  background-color: var(--accent-blue);
  color: white;
  font-size: var(--font-base);
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}
.refresh-btn:hover:not(:disabled) { opacity: 0.9; }
.refresh-btn:disabled { opacity: 0.5; cursor: wait; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px var(--space-2);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  color: var(--text-primary);
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.chip-count {
  font-weight: 700;
  color: var(--accent-blue);
}
.chip-ratio {
  color: var(--text-muted);
  font-size: var(--font-sm);
  margin-left: 2px;
}
.chip-ratio::before {
  content: '· ';
}
.summary-empty {
  font-size: var(--font-sm);
  color: var(--text-muted);
}
</style>
