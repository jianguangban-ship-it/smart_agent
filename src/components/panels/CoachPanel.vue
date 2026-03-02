<template>
  <PanelShell
    :title="t('coach.title')"
    :status="statusInfo.status"
    :status-label="t('status.' + statusInfo.key)"
    resizable
    height="400px"
    max-height="650px"
  >
    <template #header-actions>
      <span class="mode-badge badge-llm" :title="currentModel">{{ currentModel }}</span>
      <button
        class="skill-toggle"
        :class="{ 'skill-on': coachSkillEnabled, 'skill-off': !coachSkillEnabled }"
        @click="setCoachSkillEnabled(!coachSkillEnabled)"
        :title="coachSkillEnabled ? t('coach.skillOn') : t('coach.skillOff')"
        :aria-label="coachSkillEnabled ? t('coach.skillOn') : t('coach.skillOff')"
      >
        {{ coachSkillEnabled ? t('coach.skillOn') : t('coach.skillOff') }}
      </button>
      <button v-if="response && !isLoading" class="copy-btn" @click="copyResponse" :title="t('toast.copied')" :aria-label="t('toast.copied')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="2" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-linecap="round"/>
        </svg>
      </button>
    </template>

    <template #icon>
      <svg class="panel-icon green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>
    </template>

    <!-- Empty state / backoff state -->
    <div v-if="!response && !isLoading" class="empty-state">
      <!-- 429 backoff countdown -->
      <template v-if="backoffSecs > 0">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--accent-orange)">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="backoff-text">{{ t('coach.backoffLabel') }} <strong>{{ backoffSecs }}s</strong></p>
        <button class="cancel-btn small-cancel" @click="$emit('cancel')">{{ t('coach.backoffCancel') }}</button>
      </template>
      <!-- Normal empty state -->
      <template v-else>
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        </svg>
        <p class="empty-hint">{{ t('coach.emptyHint') }}</p>
        <p class="empty-sub">{{ t('coach.emptySubHint') }}</p>
        <div
          class="chips"
          :class="{ 'drag-over': isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="handleDrop"
        >
          <QuickChip
            v-for="chip in chips"
            :key="chip.key"
            :icon="chip.icon"
            :label="chip.label"
            @click="$emit('applyChip', chip.key)"
          />
          <span v-if="isDragging" class="drag-hint">Drop JSON here</span>
        </div>
      </template>
    </div>

    <!-- Loading state (waiting for first token) -->
    <div v-else-if="isLoading && !response" class="loading-state">
      <svg class="spinner green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round" opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
      </svg>
      <p class="loading-text green">{{ t('coach.analyzing') }}</p>
    </div>

    <!-- Coach response (streaming or complete) -->
    <div v-else>
      <div class="coach-response" v-html="formattedResponse" />
      <div v-if="isLoading" class="stream-footer">
        <span class="streaming-cursor green" />
        <span v-if="streamSpeed > 0" class="stream-speed">{{ streamSpeed }} {{ t('dev.streamSpeed') }}</span>
      </div>
    </div>

    <template #footer>
      <button v-if="isLoading" class="cancel-btn" @click="$emit('cancel')">
        <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
        <span>{{ t('settings.cancel') }}</span>
      </button>
      <template v-else>
        <button v-if="wasCancelled || hadError" class="retry-btn" :disabled="retryCountdown > 0" @click="handleRetry">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          <span>{{ retryCountdown > 0 ? `${retryCountdown}s` : t('coach.retryBtn') }}</span>
        </button>
        <button
          @click="$emit('request')"
          :disabled="!canRequest"
          class="coach-btn"
          :class="{ active: canRequest }"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          <span>{{ t('coach.requestBtn') }}</span>
        </button>
        <p class="coach-hint">{{ t('coach.hint') }}</p>
      </template>
    </template>
  </PanelShell>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { useI18n } from '@/i18n'
import { formatCoachResponse } from '@/utils/formatCoach'
import { effectiveTemplates } from '@/config/templates/index'
import { useToast } from '@/composables/useToast'
import { coachSkillEnabled, setCoachSkillEnabled } from '@/composables/useLLM'
import { currentModel } from '@/config/llm'
import PanelShell from '@/components/layout/PanelShell.vue'
import QuickChip from '@/components/shared/QuickChip.vue'

const props = defineProps<{
  response: unknown
  isLoading: boolean
  canRequest: boolean
  wasCancelled: boolean
  hadError: boolean
  streamSpeed: number
  backoffSecs: number
}>()

const emit = defineEmits<{
  request: []
  cancel: []
  retry: []
  applyChip: [key: string]
  importTemplates: [templates: import('@/types/template').TemplateDefinition[]]
}>()

const { t, isZh } = useI18n()
const { addToast } = useToast()

const isDragging = ref(false)
const retryCountdown = ref(0)
let _cooldownTimer: number | null = null

function handleRetry() {
  emit('retry')
  retryCountdown.value = 2
  _cooldownTimer = window.setInterval(() => {
    retryCountdown.value--
    if (retryCountdown.value <= 0) {
      clearInterval(_cooldownTimer!)
      _cooldownTimer = null
    }
  }, 1000)
}

onUnmounted(() => {
  if (_cooldownTimer !== null) clearInterval(_cooldownTimer)
  if (_rafId !== null) cancelAnimationFrame(_rafId)
})

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file || !file.name.endsWith('.json')) {
    addToast('error', t('toast.invalidDropFile'))
    return
  }
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target?.result as string)
      if (!Array.isArray(data)) throw new Error('Not an array')
      emit('importTemplates', data)
    } catch {
      addToast('error', t('toast.invalidTemplateJson'))
    }
  }
  reader.readAsText(file)
}

const statusInfo = computed(() => {
  if (props.isLoading) return { status: 'loading' as const, key: 'loading' }
  if (props.response) return { status: 'success' as const, key: 'success' }
  return { status: 'idle' as const, key: 'idle' }
})

// rAF-throttled to avoid running 12-regex formatter on every streaming token
const formattedResponse = ref('')
let _rafId: number | null = null
watch(() => props.response, (val) => {
  if (_rafId !== null) return
  _rafId = requestAnimationFrame(() => {
    formattedResponse.value = formatCoachResponse(val)
    _rafId = null
  })
}, { immediate: true })

const rawText = computed(() => {
  const r = props.response as Record<string, unknown>
  return typeof r?.message === 'string' ? r.message : ''
})

async function copyResponse() {
  const text = rawText.value || JSON.stringify(props.response, null, 2)
  if (!text) return
  await navigator.clipboard.writeText(text)
  addToast('success', t('toast.copied'), 2000)
}

const chips = computed(() =>
  effectiveTemplates.value.map(t => ({
    key: t.key,
    icon: t.icon,
    label: isZh.value ? t.label.zh : t.label.en
  }))
)
</script>

<style scoped>
.panel-icon {
  width: 16px;
  height: 16px;
}
.green { color: var(--accent-green); }

.empty-state,
.loading-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 16px;
}
.empty-icon {
  width: 40px;
  height: 40px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.empty-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.empty-sub {
  font-size: 12px;
  color: var(--text-muted);
  opacity: 0.7;
  margin-bottom: 16px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  border-radius: var(--radius-md);
  border: 2px dashed transparent;
  padding: 4px;
  transition: border-color 0.2s, background-color 0.2s;
  position: relative;
}
.chips.drag-over {
  border-color: var(--accent-blue);
  background-color: rgba(88, 166, 255, 0.06);
}
.drag-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--accent-blue);
  font-weight: 500;
  pointer-events: none;
}
.spinner {
  width: 32px;
  height: 32px;
  margin-bottom: 8px;
  animation: spin 1s linear infinite;
}
.loading-text {
  font-size: 12px;
}
.coach-response {
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
}

/* Coach formatted content styles */
.coach-response :deep(.coach-status-badge) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 8px;
}
.coach-response :deep(.coach-status-pass) {
  background-color: rgba(63, 185, 80, 0.15);
  color: var(--accent-green);
  border: 1px solid rgba(63, 185, 80, 0.3);
}
.coach-response :deep(.coach-status-fail) {
  background-color: rgba(248, 81, 73, 0.15);
  color: var(--accent-red);
  border: 1px solid rgba(248, 81, 73, 0.3);
}
.coach-response :deep(.coach-status-warn) {
  background-color: rgba(210, 153, 34, 0.15);
  color: var(--accent-orange);
  border: 1px solid rgba(210, 153, 34, 0.3);
}
.coach-response :deep(.coach-info-row) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  border-bottom: 1px solid var(--border-color);
  font-size: 12px;
}
.coach-response :deep(.coach-info-label) { color: var(--text-muted); }
.coach-response :deep(.coach-info-value) { color: var(--text-primary); font-weight: 500; }
.coach-response :deep(.coach-main-message) {
  background-color: var(--bg-tertiary);
  border-radius: 6px;
  padding: 8px 10px;
  margin: 6px 0;
  border-left: 3px solid var(--accent-blue);
}
.coach-response :deep(.coach-comment-title) {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-color);
}
.coach-response :deep(.coach-issues-list) { display: flex; flex-direction: column; gap: 5px; }
.coach-response :deep(.coach-issue-item) {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 8px;
  background-color: rgba(248, 81, 73, 0.06);
  border-radius: 6px;
  border-left: 3px solid var(--accent-red);
}
.coach-response :deep(.coach-issue-num) {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  background-color: var(--accent-red);
  color: white;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
  margin-top: 1px;
}
.coach-response :deep(.coach-issue-text) { font-size: 12px; line-height: 1.5; color: var(--text-secondary); }
.coach-response :deep(.coach-highlight-error) { color: var(--accent-red); font-weight: 600; }
.coach-response :deep(.coach-para) { margin-bottom: 6px; }
.coach-response :deep(.coach-h3) { font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 10px 0 5px; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); }
.coach-response :deep(.coach-h4) { font-size: 12px; font-weight: 600; color: var(--accent-blue); margin: 8px 0 4px; }
.coach-response :deep(.coach-hr) { border: none; border-top: 1px dashed var(--border-color); margin: 10px 0; }
.coach-response :deep(.coach-bold) { color: var(--accent-green); font-weight: 600; }
.coach-response :deep(.coach-code) { background-color: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-size: 12px; font-family: var(--font-mono); color: var(--accent-blue); }
.coach-response :deep(.coach-list-item) { display: flex; align-items: baseline; gap: 5px; margin: 0; padding: 0 0 0 4px; }
.coach-response :deep(.coach-list-num) { color: var(--accent-blue); font-weight: 600; min-width: 16px; flex-shrink: 0; }
.coach-response :deep(.coach-list-bullet) { color: var(--text-muted); font-weight: bold; flex-shrink: 0; }
.coach-response :deep(.coach-icon-error) { color: var(--accent-red); }
.coach-response :deep(.coach-icon-success) { color: var(--accent-green); }
.coach-response :deep(.coach-icon-warning) { color: var(--accent-orange); }

/* Mode badge */
.mode-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  letter-spacing: 0.3px;
  line-height: 1;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

/* Skill toggle */
.skill-toggle {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  letter-spacing: 0.3px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid;
}
.skill-on {
  background-color: rgba(63, 185, 80, 0.15);
  color: var(--accent-green);
  border-color: rgba(63, 185, 80, 0.3);
}
.skill-on:hover {
  background-color: rgba(63, 185, 80, 0.25);
}
.skill-off {
  background-color: var(--bg-tertiary);
  color: var(--text-muted);
  border-color: var(--border-color);
}
.skill-off:hover {
  color: var(--text-secondary);
  border-color: var(--text-muted);
}

/* Copy button */
.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.copy-btn:hover {
  color: var(--accent-green);
  border-color: var(--border-color);
  background-color: var(--bg-secondary);
}
.copy-btn svg {
  width: 13px;
  height: 13px;
}

/* Footer */
.cancel-btn {
  width: 100%;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  background-color: rgba(248, 81, 73, 0.1);
  color: var(--accent-red);
  border: 1px solid rgba(248, 81, 73, 0.3);
  cursor: pointer;
}
.cancel-btn:hover {
  background-color: rgba(248, 81, 73, 0.2);
}
.retry-btn {
  width: 100%;
  padding: 7px 16px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
  transition: all 0.2s;
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  cursor: pointer;
}
.retry-btn:hover:not(:disabled) {
  color: var(--accent-green);
  border-color: var(--accent-green);
}
.retry-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.coach-btn {
  width: 100%;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  background-color: var(--bg-tertiary);
  color: var(--text-muted);
}
.coach-btn.active {
  background-color: var(--accent-green);
  color: white;
}
.btn-icon {
  width: 16px;
  height: 16px;
}
.coach-hint {
  font-size: 12px;
  text-align: center;
  color: var(--text-muted);
  margin-top: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.stream-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.stream-speed {
  font-size: 11px;
  color: var(--accent-green);
  opacity: 0.8;
  font-family: var(--font-mono);
}
.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  margin-left: 2px;
  vertical-align: text-bottom;
  border-radius: 1px;
  animation: blink 0.9s step-end infinite;
}
.streaming-cursor.green { background-color: var(--accent-green); }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.backoff-text {
  font-size: 13px;
  color: var(--accent-orange);
  margin-bottom: 12px;
}
.small-cancel {
  padding: 5px 14px;
  font-size: 12px;
  margin-top: 0;
}
</style>
