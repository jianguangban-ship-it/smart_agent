<template>
  <div class="jira-panel">
    <details :open="hasContent">
      <summary class="jira-header">
        <span class="header-title">{{ ICONS.jiraPanel }} {{ t('panel.jiraResponse') }}</span>
        <span v-if="isCreating && !response" class="status-badge status-loading">
          <svg class="mini-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round" opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
          </svg>
          {{ t('status.pending') }}
        </span>
        <span v-else-if="jiraKey" class="status-badge status-success">
          {{ jiraKey }}
        </span>
      </summary>

      <div class="jira-body">
        <!-- Loading state -->
        <div v-if="isCreating && !response" class="empty-state">
          <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round" opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
          </svg>
          <p class="loading-text">{{ t('panel.jiraCreating') }}</p>
        </div>

        <!-- Empty state -->
        <div v-else-if="!response" class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p class="empty-text">{{ t('panel.waitingJira') }}</p>
        </div>

        <!-- Success state -->
        <div v-else-if="jiraKey" class="success-state">
          <svg class="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <a :href="viewUrl || ('https://jira.gwm.cn/browse/' + jiraKey)" target="_blank" rel="noopener noreferrer" class="success-link">
            {{ jiraKey }}
          </a>
          <p class="success-hint">{{ t('toast.createSuccess') }}</p>
        </div>

        <!-- Fallback: raw JSON for unexpected responses -->
        <JsonViewer v-else :data="response" />
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import JsonViewer from '@/components/shared/JsonViewer.vue'
import { ICONS } from '@/config/icons'

const props = defineProps<{
  response: unknown
  isCreating: boolean
}>()

const { t } = useI18n()

const parsed = computed(() => {
  if (!props.response) return null
  try {
    return typeof props.response === 'string' ? JSON.parse(props.response) : props.response
  } catch { return null }
})

const jiraKey = computed(() => (parsed.value as Record<string, string>)?.key || '')
const viewUrl = computed(() => (parsed.value as Record<string, string>)?.view_tasks_created || '')

const hasContent = computed(() => !!props.response || props.isCreating)
</script>

<style scoped>
.jira-panel {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 12px;
}

.jira-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  list-style: none;
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 12px;
}
.jira-header::-webkit-details-marker { display: none; }
.header-title { flex: 1; }

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 1px 8px;
  border-radius: var(--radius-sm);
}
.status-loading {
  color: var(--accent-orange);
  background-color: color-mix(in srgb, var(--accent-orange) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-orange) 25%, transparent);
}
.status-success {
  color: var(--accent-green);
  background-color: color-mix(in srgb, var(--accent-green) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-green) 25%, transparent);
  font-family: var(--font-mono);
  font-weight: 600;
}

.mini-spinner {
  width: 12px;
  height: 12px;
  animation: spin 1s linear infinite;
}

.jira-body {
  border-top: 1px solid var(--border-color);
  padding: 8px 12px 10px;
  max-height: 360px;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px 16px;
}
.empty-icon { width: 36px; height: 36px; color: var(--text-muted); margin-bottom: 8px; }
.empty-text { font-size: 12px; color: var(--text-muted); }

.spinner {
  width: 28px;
  height: 28px;
  color: #2684FF;
  margin-bottom: 8px;
  animation: spin 1s linear infinite;
}
.loading-text {
  font-size: 12px;
  color: #2684FF;
}

/* Success state */
.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 16px;
  text-align: center;
}
.success-icon {
  width: 32px;
  height: 32px;
  color: var(--accent-green);
  margin-bottom: 8px;
}
.success-link {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 600;
  color: var(--accent-blue);
  text-decoration: none;
}
.success-link:hover { text-decoration: underline; }
.success-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
