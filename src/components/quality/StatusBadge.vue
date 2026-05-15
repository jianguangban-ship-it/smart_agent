<template>
  <span class="status-badge" :style="{ backgroundColor: color, color: textColor }" :title="title">
    {{ display }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import { colorForStatus, isCanonicalStatus } from '@/types/quality'

const props = defineProps<{ status: string }>()
const { t } = useI18n()

const color = computed(() => colorForStatus(props.status))

// White text on dark colors, dark text on lighter (B's blue/C's orange are mid).
// Simple WCAG-ish heuristic: light backgrounds get dark text.
const textColor = computed(() => {
  const c = color.value
  // FFA500 (orange) is the brightest — keep dark text on it. Others use white.
  if (c.toUpperCase() === '#FFA500') return '#1a1a1a'
  return '#fff'
})

const display = computed(() => {
  // Show the literal status string. For canonical values we don't translate the
  // letter (A/B/C/D are universal); for the two ZH sentinels we show them as-is.
  return props.status
})

const title = computed(() => {
  // Tooltip carries the human-readable meaning.
  const labels: Record<string, string> = {
    A: t('view.statusA'),
    B: t('view.statusB'),
    C: t('view.statusC'),
    D: t('view.statusD'),
    '格式异常': t('view.statusFormatError'),
    '未知': t('view.statusUnknown')
  }
  return labels[props.status] ?? `${t('view.statusDrift')}: ${props.status}`
})
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: var(--font-base);
  letter-spacing: 0.5px;
  line-height: 1.3;
}
</style>
