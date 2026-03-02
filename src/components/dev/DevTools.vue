<template>
  <div class="dev-tools">
    <details>
      <summary class="dev-summary">{{ t('dev.viewPayload') }}</summary>
      <div class="dev-content">
        <JsonViewer :data="payload" />
      </div>
    </details>

    <details>
      <summary class="dev-summary">⚡ {{ t('dev.webhookConfig') }}</summary>
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
          💡 {{ t('dev.configHint') }} <code class="config-code">WEBHOOK_CONFIG</code>
        </div>
      </div>
    </details>

    <details>
      <summary class="dev-summary">🤖 {{ t('dev.agentState') }}</summary>
      <div class="dev-config">
        <div class="config-row">
          <span class="config-label">{{ t('dev.model') }}:</span>
          <code class="config-url">{{ activeModel }}</code>
        </div>
        <div class="config-row">
          <span class="config-label">{{ t('dev.coachSkill') }}:</span>
          <span :style="{ color: coachSkillModified ? 'var(--accent-orange)' : 'var(--text-muted)' }">
            {{ coachSkillModified ? t('settings.skillModified') : t('dev.no') }}
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
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n'
import { WEBHOOK_CONFIG, useProductionMode } from '@/config/webhook'
import { computed } from 'vue'
import JsonViewer from '@/components/shared/JsonViewer.vue'

defineProps<{
  payload: string
  activeModel: string
  coachSkillModified: boolean
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
}>()

const { t } = useI18n()
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
  background-color: rgba(88, 166, 255, 0.15);
  color: var(--accent-blue);
  border: 1px solid rgba(88, 166, 255, 0.3);
}
.badge-n8n {
  background-color: rgba(210, 153, 34, 0.15);
  color: var(--accent-orange);
  border: 1px solid rgba(210, 153, 34, 0.3);
}
.speed-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  margin-left: 6px;
  opacity: 0.8;
}
</style>
