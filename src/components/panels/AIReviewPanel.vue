<template>
  <div class="review-panel">
    <div class="review-content">
      <div v-if="response || isAnalyzing" class="review-toolbar">
        <span class="header-actions">
          <span v-if="response && !hasError && !isAnalyzing" class="status-badge status-success">{{ t('status.success') }}</span>
          <span v-else-if="hasError" class="status-badge status-error">{{ t('status.error') }}</span>
          <!-- AI result badges (visible even when collapsed) -->
          <span v-if="aiPoints != null && !isAnalyzing" class="result-badge points-badge">
            <span class="points-old">{{ estimatedPoints }}</span>
            <span class="points-arrow">&rarr;</span>
            <span class="points-new">{{ aiPoints }}</span>
          </span>
          <span v-if="subtaskCount > 0 && !isAnalyzing" class="result-badge subtask-badge">
            {{ subtaskCount }} {{ t('panel.subtasks') }}
          </span>
          <button
            v-if="canShowDiff && !isAnalyzing"
            class="copy-btn"
            :class="{ 'diff-active': showDiff }"
            @click="showDiff = !showDiff"
            :title="showDiff ? t('panel.hideDiff') : t('panel.showDiff')"
          >
            {{ showDiff ? t('panel.hideDiff') : t('panel.showDiff') }}
          </button>
          <button v-if="response && !isAnalyzing" class="copy-btn" @click="copyResponse" :title="t('toast.copied')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="2" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-linecap="round"/>
            </svg>
          </button>
        </span>
      </div>

      <div class="review-body">
        <!-- Empty state / backoff state -->
        <div v-if="!response && !isAnalyzing" class="empty-state">
          <template v-if="backoffSecs > 0">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--accent-orange)">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p class="backoff-text">{{ t('panel.backoffLabel') }} <strong>{{ backoffSecs }}s</strong></p>
            <button class="cancel-btn" @click="$emit('cancel')">{{ t('coach.backoffCancel') }}</button>
          </template>
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
          <!-- Cancel moved to the action-bar Analysis→Cancel toggle (v10.207). -->
        </div>

        <!-- LLM markdown result (streaming or complete) -->
        <div v-else-if="isMarkdownResponse">
          <div v-if="hasPerspectiveTabs && !showDiff" class="perspective-tabs">
            <button
              class="perspective-tab"
              :class="{ 'tab-active': activeTab === 'all' }"
              @click="activeTab = 'all'"
            >{{ t('panel.allPerspectives') }}</button>
            <button
              v-for="s in perspectiveSections"
              :key="s.id"
              class="perspective-tab"
              :class="{ 'tab-active': activeTab === s.id }"
              @click="activeTab = s.id"
            >{{ s.label }}</button>
          </div>
          <div v-if="showDiff && canShowDiff" class="coach-response diff-view" v-html="diffHtml" />
          <div v-else class="coach-response" v-html="filteredAnalysisHtml" />
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { useI18n } from '@/i18n'
import { formatCoachResponse } from '@/utils/formatCoach'
import { diffWords } from '@/utils/diffText'
import { useToast } from '@/composables/useToast'
import { copyText } from '@/utils/clipboard'
import JsonViewer from '@/components/shared/JsonViewer.vue'

const props = defineProps<{
  response: unknown
  previousResponse: unknown
  isAnalyzing: boolean
  isDeepReview: boolean
  hasError: boolean
  wasCancelled: boolean
  hadError: boolean
  streamSpeed: number
  backoffSecs: number
  estimatedPoints?: number
}>()

const emit = defineEmits<{ cancel: []; retry: [] }>()

const { t } = useI18n()
const { addToast } = useToast()

const retryCountdown = ref(0)
const showDiff = ref(false)
const activeTab = ref('all')
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


// AI result badges — parse final_points / split_number from the LLM JSON response
// The response is { message: '{"final_points":5,"split_number":4,...}' }
// LLM may wrap JSON in ```json ... ``` code fences despite instructions — strip them
const analysisData = computed<Record<string, unknown> | null>(() => {
  if (!props.response || props.isAnalyzing) return null
  try {
    const r = props.response as Record<string, unknown>
    let msg = typeof r?.message === 'string' ? r.message : null
    if (!msg) return null
    // Strip markdown code fences if present
    msg = msg.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim()
    const parsed = JSON.parse(msg)
    // DEBUG: remove after confirming badges work
    console.log('[AIReviewPanel] analysisData parsed:', parsed)
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch (e) {
    // DEBUG: remove after confirming badges work
    console.log('[AIReviewPanel] JSON parse failed:', e, 'raw message:', (props.response as Record<string, unknown>)?.message)
    return null
  }
})
const aiPoints = computed(() => {
  const pts = analysisData.value?.final_points
  return typeof pts === 'number' ? pts : null
})
const subtaskCount = computed(() => {
  const n = analysisData.value?.split_number
  return typeof n === 'number' ? n : 0
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
    formattedAnalysis.value = formatCoachResponse(val, props.isAnalyzing)
    _rafId = null
  })
}, { immediate: true })

// ─── Perspective tabs (deep review) ─────────────────────────────────────────
interface PerspectiveSection {
  id: string
  label: string
  html: string
}

const PERSPECTIVE_IDS = [
  { pattern: /safety|安全/i, id: 'safety', labelKey: 'panel.safety' },
  { pattern: /testab|可测试/i, id: 'testability', labelKey: 'panel.testability' },
  { pattern: /implement|可实现/i, id: 'implementability', labelKey: 'panel.implementability' },
  { pattern: /complete|完整/i, id: 'completeness', labelKey: 'panel.completeness' }
]

const perspectiveSections = computed<PerspectiveSection[]>(() => {
  if (!props.isDeepReview || !formattedAnalysis.value) return []
  const html = formattedAnalysis.value
  const parts = html.split(/(?=<h2[^>]*>)/i)
  if (parts.length <= 1) return []

  const sections: PerspectiveSection[] = []
  for (const part of parts) {
    const headerMatch = part.match(/<h2[^>]*>(.*?)<\/h2>/i)
    if (!headerMatch) continue
    const headerText = headerMatch[1].replace(/<[^>]*>/g, '')
    const matched = PERSPECTIVE_IDS.find(p => p.pattern.test(headerText))
    sections.push({
      id: matched?.id || `section-${sections.length}`,
      label: matched ? t(matched.labelKey) : headerText.replace(/[🛡️🧪⚙️📋]\s*/g, '').trim(),
      html: part
    })
  }
  return sections
})

const hasPerspectiveTabs = computed(() => perspectiveSections.value.length >= 2)

const filteredAnalysisHtml = computed(() => {
  if (!hasPerspectiveTabs.value || activeTab.value === 'all') return formattedAnalysis.value
  const section = perspectiveSections.value.find(s => s.id === activeTab.value)
  return section?.html || formattedAnalysis.value
})

watch(() => props.response, () => { activeTab.value = 'all' })

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
  const ok = await copyText(text)
  addToast(ok ? 'success' : 'error', t(ok ? 'toast.copied' : 'toast.copyFailed'), 2000)
}
</script>

<style scoped>
/* Embedded inside CoachPanel's Analysis tab — no own panel chrome/scroll
   (PanelShell's .panel-body provides the box + scroller). */
.review-panel {
  font-size: 12px;
}

.review-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 4px 0 8px;
  user-select: none;
  color: var(--text-primary);
  font-weight: 500;
  font-size: var(--font-lg);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Status badges */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 1px 8px;
  border-radius: var(--radius-sm);
}
.status-success {
  color: var(--accent-green);
  background-color: color-mix(in srgb, var(--accent-green) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-green) 25%, transparent);
}
.status-error {
  color: var(--accent-red);
  background-color: color-mix(in srgb, var(--accent-red) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-red) 25%, transparent);
}

/* AI result badges */
.result-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 500;
  padding: 1px 8px;
  border-radius: var(--radius-sm);
}
.points-badge {
  color: var(--accent-green);
  background-color: color-mix(in srgb, var(--accent-green) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-green) 25%, transparent);
}
.points-old {
  text-decoration: line-through;
  opacity: 0.6;
}
.points-arrow {
  opacity: 0.5;
  font-size: 10px;
}
.points-new {
  font-weight: 600;
}
.subtask-badge {
  color: var(--accent-orange);
  background-color: color-mix(in srgb, var(--accent-orange) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-orange) 25%, transparent);
}

.review-body {
  padding: 4px 0;
}

/* Empty / loading states */
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
.spinner { width: 28px; height: 28px; margin-bottom: 8px; animation: spin 1s linear infinite; }
.loading-text { font-size: 12px; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Markdown response styles — mirrors the Explore/Review polish (serif body,
   airy rhythm, Claude-style borderless tables); review-specific accent chrome
   (purple headings-accent, status/issue colors) is preserved below. */
.coach-response {
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--text-primary);
}
.coach-response :deep(h1),
.coach-response :deep(h2) { font-family: var(--font-serif); font-size: 1.4rem; line-height: 1.3; font-weight: 600; color: var(--text-primary); margin: 12px 0 6px; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); }
.coach-response :deep(h3) { font-family: var(--font-serif); font-size: 1.15rem; line-height: 1.35; font-weight: 600; color: var(--text-primary); margin: 10px 0 5px; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); }
.coach-response :deep(h4),
.coach-response :deep(h5),
.coach-response :deep(h6) { font-family: var(--font-serif); font-size: 12px; font-weight: 600; color: var(--accent-purple); margin: 8px 0 4px; }
.coach-response :deep(p) { margin: 0 0 0.85em; }
.coach-response :deep(strong) { color: var(--accent-purple); font-weight: 600; }
.coach-response :deep(em) { font-style: italic; }
.coach-response :deep(code) { background-color: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-size: 12px; font-family: var(--font-mono); color: var(--accent-blue); }
.coach-response :deep(pre) { border-radius: 6px; padding: 10px 12px; margin: 6px 0; overflow-x: auto; border: 1px solid var(--border-color); background-color: var(--bg-tertiary); }
.coach-response :deep(pre code) { padding: 0; background: transparent; font-size: 12px; font-family: var(--font-mono); }
.coach-response :deep(pre code.hljs) { background: transparent; padding: 0; }
.coach-response :deep(hr) { border: none; border-top: 1px dashed var(--border-color); margin: 10px 0; }
.coach-response :deep(hr.coach-response-divider) { border-top: 2px solid var(--accent-purple); margin: 16px 0; opacity: 0.4; }
.coach-response :deep(ul),
.coach-response :deep(ol) { margin: 4px 0; padding-left: 20px; }
.coach-response :deep(li) { margin: 0.25em 0; }
.coach-response :deep(li::marker) { color: var(--text-muted); }
.coach-response :deep(ol li::marker) { color: var(--accent-purple); font-weight: 600; }
.coach-response :deep(blockquote) { border-left: 3px solid var(--accent-purple); margin: 6px 0; padding: 4px 10px; background-color: var(--bg-tertiary); border-radius: 0 6px 6px 0; color: var(--text-secondary); }
.coach-response :deep(blockquote p) { margin: 0; }
.coach-response :deep(a) { color: var(--accent-blue); text-decoration: none; }
.coach-response :deep(a:hover) { text-decoration: underline; }
/* Claude-style borderless tables (mirrors the Review chat). Horizontal scroll is
   provided by the global .coach-response .table-scroll wrapper from
   coach-response.css, so no display:block/overflow hack here. */
.coach-response :deep(table) {
  width: 100%;
  border-collapse: collapse;
  border: none;
  border-radius: 0;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  margin: 8px 0;
}
.coach-response :deep(thead) { background: transparent; }
.coach-response :deep(th) {
  border: none;
  border-bottom: 1px solid var(--text-muted);
  padding: 0.55em 1.25em 0.55em 0;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  text-align: left;
}
.coach-response :deep(td) {
  border: none;
  border-bottom: 1px solid var(--border-color);
  padding: 0.6em 1.25em 0.6em 0;
  color: var(--text-primary);
  line-height: 1.5;
  vertical-align: top;
}
.coach-response :deep(tbody tr:hover) { background: transparent; }
.coach-response :deep(tbody tr:last-child td) { border-bottom: none; }
.coach-response :deep(.coach-status-badge) {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 6px; font-weight: 600; font-size: 12px; margin-bottom: 8px;
}
.coach-response :deep(.coach-status-pass) { background-color: var(--green-subtle); color: var(--accent-green); border: 1px solid var(--green-border); }
.coach-response :deep(.coach-status-fail) { background-color: var(--red-subtle); color: var(--accent-red); border: 1px solid var(--red-border); }
.coach-response :deep(.coach-status-warn) { background-color: var(--orange-subtle); color: var(--accent-orange); border: 1px solid var(--orange-border); }
.coach-response :deep(.coach-info-row) { display: flex; align-items: center; gap: 8px; padding: 3px 0; border-bottom: 1px solid var(--border-color); font-size: 12px; }
.coach-response :deep(.coach-info-label) { color: var(--text-muted); }
.coach-response :deep(.coach-info-value) { color: var(--text-primary); font-weight: 500; }
/* No card box — let the report flow directly on the panel like the Review chat
   (the global .coach-main-message is padding:0; v10.210). */
.coach-response :deep(.coach-main-message) { background: transparent; border: none; border-radius: 0; padding: 0; margin: 0; }
.coach-response :deep(.coach-comment-title) { font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); }
.coach-response :deep(.coach-issues-list) { display: flex; flex-direction: column; gap: 5px; }
.coach-response :deep(.coach-issue-item) { display: flex; align-items: flex-start; gap: 8px; padding: 5px 8px; background-color: var(--red-subtle); border-radius: 6px; border-left: 3px solid var(--accent-red); }
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
  background-color: var(--blue-subtle);
  color: var(--accent-blue);
  border: 1px solid var(--blue-border);
}

/* Action buttons */
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
  background-color: var(--blue-subtle);
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
  background-color: var(--green-subtle);
  color: var(--accent-green);
  text-decoration: none;
  border-radius: 2px;
  padding: 0 1px;
}
.diff-view :deep(.diff-del) {
  background-color: var(--red-subtle);
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

.cancel-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
  background-color: var(--red-subtle);
  color: var(--accent-red);
  border: 1px solid var(--red-border);
  cursor: pointer;
  transition: background-color 0.15s;
  margin-top: 12px;
}
.cancel-btn:hover { background-color: var(--red-border); }

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

/* Deep review perspective tabs */
.perspective-tabs {
  display: flex;
  gap: 2px;
  padding: 4px;
  margin-bottom: 10px;
  border-radius: var(--radius-md);
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  overflow-x: auto;
}
.perspective-tab {
  flex: 1;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
  background: transparent;
  color: var(--text-muted);
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.perspective-tab:hover:not(.tab-active) {
  color: var(--text-primary);
  background-color: var(--bg-secondary);
}
.perspective-tab.tab-active {
  background-color: var(--accent-purple);
  color: white;
  font-weight: 600;
}
</style>
