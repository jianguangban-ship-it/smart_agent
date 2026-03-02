<template>
  <Transition name="fade">
    <div v-if="aiResponse" class="summary-card">
      <h3 class="summary-title">{{ t('panel.summary') }}</h3>
      <div class="summary-rows">
        <div class="summary-row">
          <span class="row-label">{{ t('panel.aiCorrectedPoints') }}</span>
          <div class="row-value">
            <span class="old-points">{{ estimatedPoints }}</span>
            <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
            </svg>
            <span class="new-points">{{ parsed?.ai_points || '-' }}</span>
          </div>
        </div>
        <div class="summary-row">
          <span class="row-label">{{ t('panel.subtasks') }}</span>
          <span class="subtask-count" :class="{ active: subtaskCount > 0 }">
            {{ subtaskCount }} {{ t('panel.items') }}
          </span>
        </div>
        <div v-if="jiraKey" class="summary-row jira-row">
          <span class="row-label">{{ t('panel.jiraTicket') }}</span>
          <a :href="'https://jira.gwm.cn/browse/' + jiraKey" target="_blank" class="jira-link">
            {{ jiraKey }}
          </a>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'

const props = defineProps<{
  aiResponse: unknown
  jiraResponse: unknown
  estimatedPoints: number
}>()

const { t } = useI18n()

const parsed = computed(() => {
  if (!props.aiResponse) return null
  try {
    return typeof props.aiResponse === 'string' ? JSON.parse(props.aiResponse) : props.aiResponse
  } catch { return null }
})

const subtaskCount = computed(() => (parsed.value as Record<string, number>)?.subtasks_created || 0)

const jiraKey = computed(() => {
  if (!props.jiraResponse) return ''
  try {
    const r = typeof props.jiraResponse === 'string' ? JSON.parse(props.jiraResponse) : props.jiraResponse
    return (r as Record<string, string>)?.key || ''
  } catch { return '' }
})
</script>

<style scoped>
.summary-card {
  padding: 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  animation: fadeIn 0.3s ease-out;
}
.summary-title {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.summary-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.row-label {
  font-size: 12px;
  color: var(--text-secondary);
}
.row-value {
  display: flex;
  align-items: center;
  gap: 6px;
}
.old-points {
  font-size: 12px;
  text-decoration: line-through;
  color: var(--text-muted);
}
.arrow-icon {
  width: 12px;
  height: 12px;
  color: var(--text-muted);
}
.new-points {
  font-size: 14px;
  font-weight: 500;
  color: var(--accent-green);
}
.subtask-count {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
}
.subtask-count.active {
  color: var(--accent-orange);
}
.jira-row {
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}
.jira-link {
  font-size: 14px;
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--accent-blue);
  text-decoration: none;
}
.jira-link:hover {
  text-decoration: underline;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
