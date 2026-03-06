<template>
  <PanelShell
    :title="t('panel.aiAgentResponse')"
    :status="statusInfo.status"
    :status-label="t('status.' + statusInfo.key)"
    resizable
  >
    <template #header-actions>
      <span class="mode-badge badge-llm" :title="currentModel">{{ currentModel }}</span>
      <button
        v-if="canShowDiff && !isAnalyzing"
        class="copy-btn"
        :class="{ 'diff-active': showDiff }"
        @click="showDiff = !showDiff"
        :title="showDiff ? t('panel.hideDiff') : t('panel.showDiff')"
        :aria-label="showDiff ? t('panel.hideDiff') : t('panel.showDiff')"
      >
        {{ showDiff ? t('panel.hideDiff') : t('panel.showDiff') }}
      </button>
      <button v-if="response && !isAnalyzing" class="copy-btn" @click="copyResponse" :title="t('toast.copied')" :aria-label="t('toast.copied')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="2" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-linecap="round"/>
        </svg>
      </button>
    </template>

    <template #icon>
      <svg class="panel-icon" style="color: var(--accent-purple);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
      </svg>
    </template>

    <!-- Empty state / backoff state -->
    <div v-if="!response && !isAnalyzing" class="empty-state">
      <!-- 429 backoff countdown -->
      <template v-if="backoffSecs > 0">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--accent-orange)">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="backoff-text">{{ t('panel.backoffLabel') }} <strong>{{ backoffSecs }}s</strong></p>
        <button class="cancel-btn" @click="$emit('cancel')">{{ t('coach.backoffCancel') }}</button>
      </template>
      <!-- Normal empty state -->
      <template v-else>
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>
        <p class="empty-text">{{ t('panel.waitingAI') }}</p>
        <div v-if="hadError" class="retry-row">
          <button class="retry-btn" :disabled="retryCountdown > 0" @click="handleRetry">
            <svg class="retry-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            {{ retryCountdown > 0 ? `${retryCountdown}s` : t('panel.retryBtn') }}
          </button>
        </div>
      </template>
    </div>

    <!-- Loading state (waiting for first token) -->
    <div v-else-if="isAnalyzing && !response" class="empty-state">
      <svg class="spinner" style="color: var(--accent-purple);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round" opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
      </svg>
      <p class="loading-text" style="color: var(--accent-purple);">{{ t('panel.aiAnalyzing') }}</p>
      <button class="cancel-btn" @click="$emit('cancel')">
        <svg class="cancel-icon" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
        {{ t('settings.cancel') }}
      </button>
    </div>

    <!-- LLM markdown result (streaming or complete) -->
    <div v-else-if="isMarkdownResponse">
      <div v-if="isAnalyzing" class="cancel-row">
        <button class="cancel-btn" @click="$emit('cancel')">
          <svg class="cancel-icon" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          {{ t('settings.cancel') }}
        </button>
      </div>
      <div v-if="showDiff && canShowDiff" class="coach-response diff-view" v-html="diffHtml" />
      <div v-else class="coach-response" v-html="formattedAnalysis" />
      <div v-if="isAnalyzing" class="stream-footer">
        <span class="streaming-cursor" />
        <span v-if="streamSpeed > 0" class="stream-speed">{{ streamSpeed }} {{ t('dev.streamSpeed') }}</span>
      </div>
      <div v-if="!isAnalyzing && (wasCancelled || hadError)" class="retry-row">
        <button class="retry-btn" :disabled="retryCountdown > 0" @click="handleRetry">
          <svg class="retry-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          {{ retryCountdown > 0 ? `${retryCountdown}s` : t('panel.retryBtn') }}
        </button>
      </div>
    </div>

    <!-- Webhook JSON result -->
    <JsonViewer v-else :data="response" />
  </PanelShell>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { useI18n } from '@/i18n'
import { formatCoachResponse } from '@/utils/formatCoach'
import { diffWords } from '@/utils/diffText'
import { useToast } from '@/composables/useToast'
import { currentModel } from '@/config/llm'
import PanelShell from '@/components/layout/PanelShell.vue'
import JsonViewer from '@/components/shared/JsonViewer.vue'

const props = defineProps<{
  response: unknown
  previousResponse: unknown
  isAnalyzing: boolean
  hasError: boolean
  wasCancelled: boolean
  hadError: boolean
  streamSpeed: number
  backoffSecs: number
}>()

const emit = defineEmits<{ cancel: []; retry: [] }>()

const { t } = useI18n()
const { addToast } = useToast()

const retryCountdown = ref(0)
const showDiff = ref(false)
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

let _rafId: number | null = null
onUnmounted(() => {
  if (_cooldownTimer !== null) clearInterval(_cooldownTimer)
  if (_rafId !== null) cancelAnimationFrame(_rafId)
})

const statusInfo = computed(() => {
  if (props.isAnalyzing) return { status: 'loading' as const, key: 'loading' }
  if (props.response) return { status: 'success' as const, key: 'success' }
  if (props.hasError) return { status: 'error' as const, key: 'error' }
  return { status: 'idle' as const, key: 'idle' }
})

const isMarkdownResponse = computed(() => {
  const r = props.response as Record<string, unknown>
  return !!r && ('markdown_msg' in r || 'message' in r)
})

// rAF-throttled to avoid running 12-regex formatter on every streaming token
const formattedAnalysis = ref('')
watch(() => props.response, (val) => {
  if (_rafId !== null) return
  _rafId = requestAnimationFrame(() => {
    formattedAnalysis.value = formatCoachResponse(val)
    _rafId = null
  })
}, { immediate: true })

const rawText = computed(() => {
  const r = props.response as Record<string, unknown>
  return typeof r?.message === 'string' ? r.message : ''
})

const prevRawText = computed(() => {
  const r = props.previousResponse as Record<string, unknown>
  return typeof r?.message === 'string' ? r.message : ''
})

const canShowDiff = computed(() =>
  isMarkdownResponse.value && !!props.previousResponse && !!prevRawText.value
)

const diffHtml = computed(() => {
  if (!canShowDiff.value) return ''
  return diffWords(prevRawText.value, rawText.value)
})

async function copyResponse() {
  const text = rawText.value || JSON.stringify(props.response, null, 2)
  if (!text) return
  await navigator.clipboard.writeText(text)
  addToast('success', t('toast.copied'), 2000)
}
</script>

<style scoped>
.panel-icon { width: 16px; height: 16px; }
.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 16px;
}
.empty-icon { width: 40px; height: 40px; color: var(--text-muted); margin-bottom: 8px; }
.empty-text { font-size: 12px; color: var(--text-muted); }
.spinner { width: 32px; height: 32px; margin-bottom: 8px; animation: spin 1s linear infinite; }
.loading-text { font-size: 12px; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Markdown response styles (mirrors CoachPanel) — markdown-it output */
.coach-response {
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
}
/* Headings */
.coach-response :deep(h1),
.coach-response :deep(h2) { font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 12px 0 6px; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); }
.coach-response :deep(h3) { font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 10px 0 5px; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); }
.coach-response :deep(h4),
.coach-response :deep(h5),
.coach-response :deep(h6) { font-size: 12px; font-weight: 600; color: var(--accent-purple); margin: 8px 0 4px; }
/* Paragraphs */
.coach-response :deep(p) { margin: 0 0 6px; }
/* Bold & italic */
.coach-response :deep(strong) { color: var(--accent-purple); font-weight: 600; }
.coach-response :deep(em) { font-style: italic; }
/* Inline code */
.coach-response :deep(code) { background-color: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-size: 12px; font-family: var(--font-mono); color: var(--accent-blue); }
/* Code blocks — structural styles; colors from highlight.js theme */
.coach-response :deep(pre) { border-radius: 6px; padding: 10px 12px; margin: 6px 0; overflow-x: auto; border: 1px solid var(--border-color); background-color: var(--bg-tertiary); }
.coach-response :deep(pre code) { padding: 0; background: transparent; font-size: 12px; font-family: var(--font-mono); }
.coach-response :deep(pre code.hljs) { background: transparent; padding: 0; }
/* Horizontal rules */
.coach-response :deep(hr) { border: none; border-top: 1px dashed var(--border-color); margin: 10px 0; }
.coach-response :deep(hr.coach-response-divider) { border-top: 2px solid var(--accent-purple); margin: 16px 0; opacity: 0.4; }
/* Lists */
.coach-response :deep(ul),
.coach-response :deep(ol) { margin: 4px 0; padding-left: 20px; }
.coach-response :deep(li) { margin: 2px 0; }
.coach-response :deep(li::marker) { color: var(--text-muted); }
.coach-response :deep(ol li::marker) { color: var(--accent-purple); font-weight: 600; }
/* Blockquotes */
.coach-response :deep(blockquote) { border-left: 3px solid var(--accent-purple); margin: 6px 0; padding: 4px 10px; background-color: var(--bg-tertiary); border-radius: 0 6px 6px 0; color: var(--text-secondary); }
.coach-response :deep(blockquote p) { margin: 0; }
/* Links */
.coach-response :deep(a) { color: var(--accent-blue); text-decoration: none; }
.coach-response :deep(a:hover) { text-decoration: underline; }
/* Tables */
.coach-response :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin: 8px 0;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
  display: block;
  overflow-x: auto;
}
.coach-response :deep(thead) { background-color: var(--bg-tertiary); }
.coach-response :deep(th) {
  color: var(--text-primary);
  font-weight: 600;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  white-space: nowrap;
  text-align: left;
}
.coach-response :deep(td) {
  padding: 5px 10px;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  line-height: 1.4;
}
.coach-response :deep(tbody tr:hover) { background-color: var(--bg-secondary); }
/* Structured coach fields (status badges, info rows, etc.) */
.coach-response :deep(.coach-status-badge) {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 6px; font-weight: 600; font-size: 12px; margin-bottom: 8px;
}
.coach-response :deep(.coach-status-pass) { background-color: rgba(63,185,80,.15); color: var(--accent-green); border: 1px solid rgba(63,185,80,.3); }
.coach-response :deep(.coach-status-fail) { background-color: rgba(248,81,73,.15); color: var(--accent-red); border: 1px solid rgba(248,81,73,.3); }
.coach-response :deep(.coach-status-warn) { background-color: rgba(210,153,34,.15); color: var(--accent-orange); border: 1px solid rgba(210,153,34,.3); }
.coach-response :deep(.coach-info-row) { display: flex; align-items: center; gap: 8px; padding: 3px 0; border-bottom: 1px solid var(--border-color); font-size: 12px; }
.coach-response :deep(.coach-info-label) { color: var(--text-muted); }
.coach-response :deep(.coach-info-value) { color: var(--text-primary); font-weight: 500; }
.coach-response :deep(.coach-main-message) { background-color: var(--bg-tertiary); border-radius: 6px; padding: 8px 10px; margin: 6px 0; border-left: 3px solid var(--accent-purple); }
.coach-response :deep(.coach-comment-title) { font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); }
.coach-response :deep(.coach-issues-list) { display: flex; flex-direction: column; gap: 5px; }
.coach-response :deep(.coach-issue-item) { display: flex; align-items: flex-start; gap: 8px; padding: 5px 8px; background-color: rgba(248,81,73,.06); border-radius: 6px; border-left: 3px solid var(--accent-red); }
.coach-response :deep(.coach-issue-num) { display: flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; background-color: var(--accent-red); color: white; border-radius: 50%; font-size: 10px; font-weight: 600; flex-shrink: 0; margin-top: 1px; }
.coach-response :deep(.coach-issue-text) { font-size: 12px; line-height: 1.5; color: var(--text-secondary); }
.coach-response :deep(.coach-highlight-error) { color: var(--accent-red); font-weight: 600; }

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

.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 11px;
  font-weight: 500;
}
.copy-btn:hover {
  color: var(--accent-purple);
  border-color: var(--border-color);
  background-color: var(--bg-secondary);
}
.copy-btn.diff-active {
  color: var(--accent-blue);
  border-color: var(--accent-blue);
  background-color: rgba(88, 166, 255, 0.1);
}
.copy-btn svg {
  width: 13px;
  height: 13px;
}

/* Diff view */
.diff-view {
  white-space: pre-wrap;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
}
.diff-view :deep(.diff-add) {
  background-color: rgba(63, 185, 80, 0.2);
  color: var(--accent-green);
  text-decoration: none;
  border-radius: 2px;
  padding: 0 1px;
}
.diff-view :deep(.diff-del) {
  background-color: rgba(248, 81, 73, 0.15);
  color: var(--accent-red);
  text-decoration: line-through;
  border-radius: 2px;
  padding: 0 1px;
}

.stream-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.stream-speed {
  font-size: 11px;
  color: var(--accent-purple);
  opacity: 0.8;
  font-family: var(--font-mono);
}
.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background-color: var(--accent-purple);
  margin-left: 2px;
  vertical-align: text-bottom;
  border-radius: 1px;
  animation: blink 0.9s step-end infinite;
}
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.backoff-text {
  font-size: 13px;
  color: var(--accent-orange);
  margin-bottom: 12px;
}

.cancel-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}
.cancel-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
  background-color: rgba(248, 81, 73, 0.1);
  color: var(--accent-red);
  border: 1px solid rgba(248, 81, 73, 0.3);
  cursor: pointer;
  transition: background-color 0.15s;
  margin-top: 12px;
}
.cancel-btn:hover { background-color: rgba(248, 81, 73, 0.2); }
.cancel-icon { width: 12px; height: 12px; }

.retry-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.retry-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.15s;
}
.retry-btn:hover:not(:disabled) {
  color: var(--accent-purple);
  border-color: var(--accent-purple);
}
.retry-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.retry-icon { width: 12px; height: 12px; }
</style>
