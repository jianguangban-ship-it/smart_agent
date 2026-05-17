<template>
  <div class="agent-info">
    <div class="agent-title">{{ ICONS.devAgent }} {{ t('dev.agentState') }}</div>
    <div class="agent-rows">
      <div class="config-row">
        <span class="config-label">{{ t('dev.model') }}:</span>
        <code class="config-url">{{ currentModel }}</code>
      </div>
      <div class="config-row">
        <span class="config-label">{{ t('dev.activeRole') }}:</span>
        <span class="role-val">{{ currentRoleDefinition ? (isZh ? currentRoleDefinition.labelZh : currentRoleDefinition.labelEn) : '—' }}</span>
      </div>
      <div class="config-row">
        <span class="config-label">{{ t('dev.activeSkill') }}:</span>
        <span :style="{ color: activeSkill ? 'var(--accent-purple)' : 'var(--text-muted)' }">
          {{ activeSkill ? activeSkill.name : '—' }}
        </span>
      </div>
      <template v-if="jiraResponse">
        <div class="state-divider" />
        <div class="config-row">
          <span class="config-label">JIRA:</span>
          <a v-if="jiraKey" :href="'https://jira.gwm.cn/browse/' + jiraKey" target="_blank" rel="noopener noreferrer" class="jira-key-link">{{ jiraKey }}</a>
          <span v-else class="muted">—</span>
        </div>
        <div v-if="jiraAiPoints != null" class="config-row">
          <span class="config-label">AI Points:</span>
          <span class="points-val">{{ jiraAiPoints }}</span>
        </div>
        <div v-if="jiraViewUrl" class="config-row">
          <span class="config-label">View:</span>
          <a :href="jiraViewUrl" target="_blank" rel="noopener noreferrer" class="jira-view-link">{{ jiraViewUrl }}</a>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import { ICONS } from '@/config/icons'
import { currentModel } from '@/config/llm'
import { currentRoleDefinition } from '@/composables/useRole'
import { activeSkill } from '@/composables/useLLM'

const props = defineProps<{ jiraResponse?: unknown }>()

const { t, isZh } = useI18n()

// JIRA response parsed fields (same logic as the removed DevTools Agent State)
const parsedJira = computed(() => {
  if (!props.jiraResponse) return null
  try {
    return typeof props.jiraResponse === 'string' ? JSON.parse(props.jiraResponse) : props.jiraResponse
  } catch { return null }
})
const jiraKey = computed(() => (parsedJira.value as Record<string, string>)?.key || '')
const jiraAiPoints = computed(() => {
  const pts = (parsedJira.value as Record<string, unknown>)?.ai_points
  return typeof pts === 'number' ? pts : null
})
const jiraViewUrl = computed(() => (parsedJira.value as Record<string, string>)?.view_tasks_created || '')
</script>

<style scoped>
.agent-info {
  padding: var(--space-5);
  border-top: 1px solid var(--border-color);
}
.agent-title {
  font-size: var(--font-sm);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: var(--space-3);
}
.agent-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 12px;
}
.config-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.config-label {
  color: var(--text-muted);
  min-width: 110px;
  flex-shrink: 0;
}
.config-url {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-tertiary);
  color: var(--accent-blue);
  font-family: var(--font-mono);
  font-size: 11px;
}
.role-val {
  color: var(--accent-blue);
  font-weight: 600;
}
.points-val {
  color: var(--accent-green);
  font-weight: 600;
}
.muted {
  color: var(--text-muted);
}
.state-divider {
  border-top: 1px dashed var(--border-color);
  margin: 2px 0;
}
.jira-key-link {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-blue);
  text-decoration: none;
}
.jira-key-link:hover { text-decoration: underline; }
.jira-view-link {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--accent-blue);
  text-decoration: none;
  word-break: break-all;
}
.jira-view-link:hover { text-decoration: underline; }
</style>
