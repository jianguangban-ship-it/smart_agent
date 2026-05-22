<template>
  <div v-if="stats.total > 0" class="review-dashboard">
    <h3 class="dashboard-title">
      <svg class="dashboard-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
      {{ isZh ? '质量仪表盘' : 'Quality Dashboard' }}
      <button class="clear-btn" @click="handleClear" :title="isZh ? '清空' : 'Clear'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
          <path stroke-linecap="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </h3>

    <div class="stats-grid">
      <!-- Total reviews -->
      <div class="stat-card">
        <span class="stat-value">{{ stats.total }}</span>
        <span class="stat-label">{{ isZh ? '审查总数' : 'Reviews' }}</span>
      </div>
      <!-- Approval rate -->
      <div class="stat-card">
        <span class="stat-value" :class="approvalColor">{{ stats.approvalRate }}%</span>
        <span class="stat-label">{{ isZh ? '通过率' : 'Approval' }}</span>
      </div>
      <!-- Avg quality -->
      <div class="stat-card">
        <span class="stat-value" :class="qualityColor">{{ stats.avgQualityScore }}</span>
        <span class="stat-label">{{ isZh ? '均分' : 'Avg Score' }}</span>
      </div>
    </div>

    <!-- Top failed checks -->
    <div v-if="stats.topFailedChecks.length > 0" class="failed-checks">
      <span class="failed-title">{{ isZh ? '常见问题' : 'Common Issues' }}</span>
      <div v-for="f in stats.topFailedChecks" :key="f.id" class="failed-item">
        <span class="failed-bar" :style="{ width: barWidth(f.count) }" />
        <span class="failed-label">{{ f.id }}</span>
        <span class="failed-count">{{ f.count }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import type { ReviewStats } from '@/composables/useReviewHistory'

const props = defineProps<{
  stats: ReviewStats
}>()

const emit = defineEmits<{ clear: [] }>()

const { isZh } = useI18n()

const approvalColor = computed(() => {
  if (props.stats.approvalRate >= 80) return 'color-green'
  if (props.stats.approvalRate >= 50) return 'color-orange'
  return 'color-red'
})

const qualityColor = computed(() => {
  if (props.stats.avgQualityScore >= 70) return 'color-green'
  if (props.stats.avgQualityScore >= 40) return 'color-orange'
  return 'color-red'
})

function barWidth(count: number) {
  const max = props.stats.topFailedChecks[0]?.count || 1
  return `${Math.round((count / max) * 100)}%`
}

function handleClear() {
  emit('clear')
}
</script>

<style scoped>
.review-dashboard {
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  font-size: 11px;
}
.dashboard-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}
.dashboard-icon {
  width: 14px;
  height: 14px;
  color: var(--accent-purple);
}
.clear-btn {
  margin-left: auto;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius-sm);
}
.clear-btn:hover {
  color: var(--accent-red);
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
  margin-bottom: 8px;
}
.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-tertiary);
}
.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}
.stat-label {
  font-size: 9px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.color-green { color: var(--accent-green); }
.color-orange { color: var(--accent-orange); }
.color-red { color: var(--accent-red); }

.failed-checks {
  margin-top: 4px;
}
.failed-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.failed-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  position: relative;
}
.failed-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background-color: var(--red-subtle);
  border-radius: 2px;
  z-index: 0;
}
.failed-label {
  font-size: 10px;
  color: var(--text-secondary);
  z-index: 1;
  flex: 1;
  padding-left: 4px;
}
.failed-count {
  font-size: 10px;
  font-weight: 600;
  color: var(--accent-red);
  z-index: 1;
}
</style>
