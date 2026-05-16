<template>
  <div class="summary-bar">
    <div class="summary-head">
      <span class="summary-title">{{ t('view.summaryTitle') }}</span>
      <span class="summary-period">{{ range.label }}</span>
      <span class="summary-total">{{ t('view.countLabel').replace('{n}', String(summary.total)) }}</span>
    </div>
    <div v-if="summary.total > 0" class="chips">
      <span
        v-for="s in orderedStatuses"
        :key="s"
        class="chip"
        :title="s"
      >
        <span class="dot" :style="{ backgroundColor: colorForStatus(s) }"></span>
        <span class="chip-label">{{ s }}</span>
        <span class="chip-count">{{ summary.periodCounts[s] }}</span>
      </span>
    </div>
    <div v-else class="summary-empty">{{ t('view.periodEmpty') }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import { colorForStatus } from '@/types/quality'
import { range } from '@/composables/useTimingPhase'
import type { PeriodSummary } from '@/composables/useQualityGrid'

const props = defineProps<{ summary: PeriodSummary }>()
const { t } = useI18n()

const CANONICAL = ['A', 'B', 'C', 'D', '格式异常', '未知']

// Canonical taxonomy first (in order), then any off-taxonomy drift values.
const orderedStatuses = computed(() => {
  const present = Object.keys(props.summary.periodCounts)
  const canon = CANONICAL.filter(s => present.includes(s))
  const drift = present.filter(s => !CANONICAL.includes(s)).sort()
  return [...canon, ...drift]
})
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
  align-items: baseline;
  gap: var(--space-3);
  flex-wrap: wrap;
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
  color: var(--text-muted);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
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
}
.summary-empty {
  font-size: var(--font-sm);
  color: var(--text-muted);
}
</style>
