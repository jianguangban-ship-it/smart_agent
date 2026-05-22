<template>
  <div class="dev-tools">
    <details>
      <summary class="dev-summary"><strong>{{ t('dev.viewPayload') }}</strong></summary>
      <div class="dev-content">
        <JsonViewer :data="payload" />
      </div>
    </details>

    <details>
      <summary class="dev-summary"><strong>{{ t('dev.viewCoachPayload') }}</strong></summary>
      <div class="dev-content raw-coach">
        <template v-if="lastCoachRaw">
          <div class="jv-toolbar">
            <button class="jv-copy-btn" @click="copyCoachRaw" :title="t('toast.copied')">
              <svg class="jv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </button>
            <button class="jv-action-btn" @click="rawExpanded = true" :title="t('dev.expandAll')">
              <svg class="jv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <button class="jv-action-btn" @click="rawExpanded = false" :title="t('dev.collapseAll')">
              <svg class="jv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </button>
          </div>
          <pre class="raw-pre" :class="{ 'raw-collapsed': !rawExpanded }">{{ lastCoachRaw }}</pre>
        </template>
        <p v-else class="raw-empty">{{ t('dev.noCoachResponse') }}</p>
      </div>
    </details>

    <details>
      <summary class="dev-summary"><strong>{{ ICONS.devWebhook }} {{ t('dev.activeWebhook') }}</strong></summary>
      <div class="dev-config">
        <div class="config-row">
          <span class="config-label">{{ t('dev.currentMode') }}:</span>
          <span :style="{ color: isProd ? 'var(--accent-green)' : 'var(--accent-orange)' }">
            {{ isProd ? t('dev.production') : t('dev.testing') }}
          </span>
        </div>
        <div class="config-row">
          <span class="config-label">{{ t('dev.activeUrl') }}:</span>
          <code class="config-url">{{ activeUrl }}</code>
        </div>
        <div class="config-hint">
          {{ ICONS.devHint }} {{ t('dev.configHint') }} <code class="config-code">WEBHOOK_CONFIG</code>
        </div>
      </div>
    </details>

    <details>
      <summary class="dev-summary"><strong>{{ ICONS.devAgent }} {{ t('dev.agentState') }}</strong></summary>
      <div class="dev-config">
        <div class="config-row">
          <span class="config-label">{{ t('dev.model') }}:</span>
          <code class="config-url">{{ activeModel }}</code>
        </div>
        <div class="config-row">
          <span class="config-label">{{ t('dev.activeRole') }}:</span>
          <span style="color: var(--accent-blue); font-weight: 600">{{ currentRoleDefinition ? (isZh ? currentRoleDefinition.labelZh : currentRoleDefinition.labelEn) : '—' }}</span>
        </div>
        <div class="config-row">
          <span class="config-label">{{ t('dev.activeSkill') }}:</span>
          <span :style="{ color: activeSkill ? 'var(--accent-purple)' : 'var(--text-muted)' }">
            {{ activeSkill ? activeSkill.name : '—' }}
          </span>
        </div>
        <div class="config-row">
          <span class="config-label">{{ t('dev.taskCoachSkill') }}:</span>
          <span :style="{ color: activeTaskSkillFile ? 'var(--accent-green)' : 'var(--text-muted)' }">
            {{ activeTaskSkillFile || '—' }}
          </span>
          <span v-if="coachSkillTaskModified" style="color: var(--accent-orange); margin-left: 4px; font-size: 10px; font-weight: 600">
            [{{ t('settings.skillModified') }}]
          </span>
        </div>
        <div class="config-row">
          <span class="config-label">{{ t('dev.analyzeSkill') }}:</span>
          <span :style="{ color: analyzeSkillModified ? 'var(--accent-orange)' : 'var(--text-muted)' }">
            {{ analyzeSkillModified ? t('settings.skillModified') : t('dev.no') }}
          </span>
        </div>
        <div class="config-row">
          <span class="config-label">{{ t('dev.customTemplates') }}:</span>
          <span :style="{ color: customTemplatesModified ? 'var(--accent-orange)' : 'var(--text-muted)' }">
            {{ customTemplatesModified ? t('settings.skillModified') : t('dev.no') }}
          </span>
        </div>
        <div class="state-divider" />
        <div class="config-row">
          <span class="config-label">{{ t('dev.coach') }} {{ t('dev.streaming') }}:</span>
          <span :style="{ color: isCoachLoading ? 'var(--accent-green)' : 'var(--text-muted)' }">
            {{ isCoachLoading ? t('dev.yes') : t('dev.no') }}
            <span v-if="isCoachLoading && coachStreamSpeed > 0" class="speed-badge">{{ coachStreamSpeed }} {{ t('dev.streamSpeed') }}</span>
          </span>
        </div>
        <div class="config-row">
          <span class="config-label">{{ t('dev.analyze') }} {{ t('dev.streaming') }}:</span>
          <span :style="{ color: isAnalyzeLoading ? 'var(--accent-purple)' : 'var(--text-muted)' }">
            {{ isAnalyzeLoading ? t('dev.yes') : t('dev.no') }}
            <span v-if="isAnalyzeLoading && analyzeStreamSpeed > 0" class="speed-badge">{{ analyzeStreamSpeed }} {{ t('dev.streamSpeed') }}</span>
          </span>
        </div>
        <div v-if="coachBackoffSecs > 0 || analyzeBackoffSecs > 0" class="config-row">
          <span class="config-label">{{ t('dev.backoff') }}:</span>
          <span style="color: var(--accent-orange)">
            <span v-if="coachBackoffSecs > 0">{{ t('dev.coach') }} {{ coachBackoffSecs }}s</span>
            <span v-if="analyzeBackoffSecs > 0">{{ t('dev.analyze') }} {{ analyzeBackoffSecs }}s</span>
          </span>
        </div>
        <div class="config-row">
          <span class="config-label">{{ t('dev.coachErrorCancel') }}:</span>
          <span :style="{ color: coachHadError ? 'var(--accent-red)' : coachWasCancelled ? 'var(--accent-orange)' : 'var(--text-muted)' }">
            {{ coachHadError ? t('dev.error') : coachWasCancelled ? t('dev.cancelled') : t('dev.no') }}
          </span>
        </div>
        <div class="config-row">
          <span class="config-label">{{ t('dev.analyzeErrorCancel') }}:</span>
          <span :style="{ color: analyzeHadError ? 'var(--accent-red)' : analyzeWasCancelled ? 'var(--accent-orange)' : 'var(--text-muted)' }">
            {{ analyzeHadError ? t('dev.error') : analyzeWasCancelled ? t('dev.cancelled') : t('dev.no') }}
          </span>
        </div>
        <template v-if="jiraResponse">
          <div class="state-divider" />
          <div class="config-row">
            <span class="config-label">JIRA:</span>
            <a v-if="jiraKey" :href="'https://jira.gwm.cn/browse/' + jiraKey" target="_blank" rel="noopener noreferrer" class="jira-key-link">{{ jiraKey }}</a>
            <span v-else style="color: var(--text-muted)">—</span>
          </div>
          <div v-if="jiraAiPoints != null" class="config-row">
            <span class="config-label">AI Points:</span>
            <span style="color: var(--accent-green); font-weight: 600">{{ jiraAiPoints }}</span>
          </div>
          <div v-if="jiraViewUrl" class="config-row">
            <span class="config-label">View:</span>
            <a :href="jiraViewUrl" target="_blank" rel="noopener noreferrer" class="jira-view-link">{{ jiraViewUrl }}</a>
          </div>
        </template>
      </div>
    </details>

  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n'
import { WEBHOOK_CONFIG, useProductionMode } from '@/config/webhook'
import { ICONS } from '@/config/icons'
import { computed, ref } from 'vue'
import type { ChatMessage } from '@/types/api'
import { useToast } from '@/composables/useToast'
import { copyText } from '@/utils/clipboard'
import { currentRoleDefinition } from '@/composables/useRole'
import { activeSkill } from '@/composables/useLLM'
import JsonViewer from '@/components/shared/JsonViewer.vue'
import {
  coachSkillTaskModified,
  activeTaskSkillFile
} from '@/config/skills/index'

const props = defineProps<{
  payload: string
  coachMessages: ChatMessage[]
  activeModel: string
  analyzeSkillModified: boolean
  customTemplatesModified: boolean
  isCoachLoading: boolean
  isAnalyzeLoading: boolean
  coachHadError: boolean
  analyzeHadError: boolean
  coachWasCancelled: boolean
  analyzeWasCancelled: boolean
  coachStreamSpeed: number
  analyzeStreamSpeed: number
  coachBackoffSecs: number
  analyzeBackoffSecs: number
  jiraResponse?: unknown
}>()

const { t, isZh } = useI18n()
const { addToast } = useToast()

// Last assistant message raw content (for debugging LaTeX/rendering)
const lastCoachRaw = computed(() => {
  const msgs = props.coachMessages
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'assistant' && msgs[i].content) return msgs[i].content
  }
  return ''
})

// JIRA response parsed fields for Agent State
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

const rawExpanded = ref(true)

async function copyCoachRaw() {
  const ok = await copyText(lastCoachRaw.value)
  addToast(ok ? 'success' : 'error', t(ok ? 'toast.copied' : 'toast.copyFailed'))
}

const isProd = useProductionMode

const activeUrl = computed(() =>
  isProd.value ? WEBHOOK_CONFIG.prodUrl : WEBHOOK_CONFIG.testUrl
)

</script>

<style scoped>
.dev-tools {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dev-summary {
  cursor: pointer;
  font-size: 12px;
  padding: 4px 0;
  color: var(--text-muted);
}
.dev-content {
  margin-top: 8px;
  padding: 12px;
  border-radius: var(--radius-lg);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  overflow-x: auto;
}
.dev-config {
  margin-top: 8px;
  padding: 16px;
  border-radius: var(--radius-lg);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
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
  min-width: 120px;
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
.config-hint {
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
  color: var(--text-muted);
}
.config-code {
  color: var(--accent-green);
}
.state-divider {
  border-top: 1px dashed var(--border-color);
  margin: 2px 0;
}
.mode-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--radius-sm);
}
.badge-llm {
  background-color: var(--blue-subtle);
  color: var(--accent-blue);
  border: 1px solid var(--blue-border);
}
.badge-n8n {
  background-color: var(--orange-subtle);
  color: var(--accent-orange);
  border: 1px solid var(--orange-border);
}
.speed-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  margin-left: 6px;
  opacity: 0.8;
}
.raw-coach {
  position: relative;
  max-height: 400px;
  overflow-y: auto;
}
.raw-pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-primary);
  margin: 0;
}
.raw-collapsed {
  max-height: 80px;
  overflow: hidden;
}
.raw-empty {
  color: var(--text-muted);
  font-size: 11px;
  font-style: italic;
  margin: 0;
}
/* Toolbar — same styles as JsonViewer .jv-toolbar */
.jv-toolbar {
  position: absolute;
  top: 2px;
  right: 2px;
  z-index: 1;
  display: flex;
  gap: 2px;
}
.jv-copy-btn,
.jv-action-btn {
  padding: 3px;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.jv-copy-btn:hover,
.jv-action-btn:hover {
  color: var(--accent-blue);
  border-color: var(--accent-blue);
}
.jv-icon {
  width: 13px;
  height: 13px;
}
</style>
