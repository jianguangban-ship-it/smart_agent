<template>
  <div class="app">
    <AppHeader @open-settings="showSettingsModal = true" />

    <!-- Settings Modal -->
    <LLMSettings v-model="showSettingsModal" @saved="onSettingsSaved" />

    <!-- Hotkey Cheat Sheet Modal -->
    <HotkeyModal v-model="showHotkeyModal" />

    <!-- Confirmation Modal -->
    <Transition name="modal">
      <div v-if="showConfirmModal" class="modal-overlay" ref="confirmModalRef" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" @click.self="showConfirmModal = false">
        <div class="modal-content">
          <h3 id="confirm-modal-title" class="modal-title">{{ t('modal.confirmTitle') }}</h3>
          <p class="modal-hint">{{ t('modal.confirmHint') }}</p>
          <div class="modal-payload">
            <JsonViewer :data="jsonPayload" :copyable="true" />
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="showConfirmModal = false">
              {{ t('modal.cancel') }}
            </button>
            <button class="btn btn-success" @click="confirmCreate">
              {{ t('modal.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <main class="app-main">
      <div class="grid-layout">
        <!-- LEFT: AI Coach -->
        <div class="col-left">
          <CoachPanel
            :response="coachResponse"
            :is-loading="isCoachLoading"
            :was-cancelled="coachWasCancelled"
            :had-error="coachHadError"
            :stream-speed="coachStreamSpeed"
            :backoff-secs="coachBackoffSecs"
            @cancel="cancelCoach"
            @retry="handleCoachRetry"
            @apply-chip="applyCoachChip"
            @import-templates="handleTemplateImport"
          />
        </div>

        <!-- CENTER: Task Form -->
        <div class="col-center">
          <TaskForm
            :form="form"
            :summary="summary"
            :component-history="componentHistory"
            :computed-summary="computedSummary"
            :quality-score="qualityScore"
            :quality-score-color="qualityScoreColor"
            :quality-score-label="qualityScoreLabel"
            :can-submit="canSubmit"
            :is-submitting="formIsSubmitting"
            :is-coach-loading="isCoachLoading"
            :current-action="formCurrentAction"
            :has-ai-response="!!analyzeResponse"
            :error-message="errorMessage"
            @coach="handleCoachRequest"
            @analyze="handleAnalyze"
            @create="handleCreateClick"
            @reset="handleReset"
            @project-change="onProjectChange"
            @clear-error="errorMessage = ''"
          />
        </div>

        <!-- RIGHT: AI Review + JIRA -->
        <div class="col-right">
          <AIReviewPanel
            :response="analyzeResponse"
            :previous-response="previousAnalyzeResponse"
            :is-analyzing="isAnalyzeLoading"
            :has-error="!!errorMessage && formCurrentAction === 'analyze'"
            :was-cancelled="analyzeWasCancelled"
            :had-error="analyzeHadError"
            :stream-speed="analyzeStreamSpeed"
            :backoff-secs="analyzeBackoffSecs"
            @cancel="cancelAnalyze"
            @retry="handleAnalyzeRetry"
          />

          <JiraResponsePanel
            :response="jiraResponse"
            :is-creating="isSubmitting && currentAction === 'create'"
          />

          <ProcessingSummary
            :ai-response="analyzeResponse"
            :jira-response="jiraResponse"
            :estimated-points="form.estimatedPoints"
          />

          <DevTools
            :payload="jsonPayload"
            :active-model="activeModel"
            :coach-skill-modified="coachSkillModified"
            :analyze-skill-modified="analyzeSkillModified"
            :custom-templates-modified="customTemplatesModified"
            :is-coach-loading="isCoachLoading"
            :is-analyze-loading="isAnalyzeLoading"
            :coach-had-error="coachHadError"
            :analyze-had-error="analyzeHadError"
            :coach-was-cancelled="coachWasCancelled"
            :analyze-was-cancelled="analyzeWasCancelled"
            :coach-stream-speed="coachStreamSpeed"
            :analyze-stream-speed="analyzeStreamSpeed"
            :coach-backoff-secs="coachBackoffSecs"
            :analyze-backoff-secs="analyzeBackoffSecs"
          />

          <TicketHistoryPanel />
        </div>
      </div>
    </main>

    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { WebhookPayload } from '@/types/api'
import { useI18n } from '@/i18n'
import { useForm } from '@/composables/useForm'
import { useWebhook } from '@/composables/useWebhook'
import { useLLM } from '@/composables/useLLM'
import { useToast } from '@/composables/useToast'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { addTicket } from '@/composables/useTicketHistory'
import { getTemplateContent, effectiveTemplates, setCustomTemplates, customTemplatesModified } from '@/config/templates/index'
import type { TemplateDefinition } from '@/types/template'
import { coachSkillModified, analyzeSkillModified } from '@/config/skills/index'
import { getModel } from '@/config/llm'

import AppHeader from '@/components/layout/AppHeader.vue'
import LLMSettings from '@/components/settings/LLMSettings.vue'
import HotkeyModal from '@/components/shared/HotkeyModal.vue'
import TaskForm from '@/components/form/TaskForm.vue'
import CoachPanel from '@/components/panels/CoachPanel.vue'
import AIReviewPanel from '@/components/panels/AIReviewPanel.vue'
import JiraResponsePanel from '@/components/panels/JiraResponsePanel.vue'
import ProcessingSummary from '@/components/panels/ProcessingSummary.vue'
import TicketHistoryPanel from '@/components/panels/TicketHistoryPanel.vue'
import DevTools from '@/components/dev/DevTools.vue'
import ToastContainer from '@/components/shared/ToastContainer.vue'
import JsonViewer from '@/components/shared/JsonViewer.vue'

const { t, isZh } = useI18n()
const { addToast } = useToast()

const {
  form, summary, componentHistory, computedSummary,
  canSubmit, qualityScore, qualityScoreColor, qualityScoreLabel,
  getProjectName, resetForm, addComponentToHistory, restoreDraft
} = useForm()

const {
  isSubmitting, currentAction,
  jiraResponse,
  createJiraTicket, clearResponses
} = useWebhook()

const {
  isCoachLoading, coachResponse, coachWasCancelled, coachHadError,
  coachStreamSpeed, coachBackoffSecs,
  requestCoach, cancelCoach, retryCoach, clearCoachResponse,
  isAnalyzeLoading, analyzeResponse, previousAnalyzeResponse, analyzeWasCancelled, analyzeHadError,
  analyzeStreamSpeed, analyzeBackoffSecs,
  requestAnalyze, cancelAnalyze, retryAnalyze, clearAnalyzeResponse
} = useLLM()

const activeModel = computed(() => getModel())

const errorMessage = ref('')
const showConfirmModal = ref(false)
const showSettingsModal = ref(false)
const showHotkeyModal = ref(false)
const confirmModalRef = ref<HTMLElement>()
const { activate: activateConfirmTrap, deactivate: deactivateConfirmTrap } = useFocusTrap(confirmModalRef)

watch(showConfirmModal, (open) => {
  if (open) nextTick(() => activateConfirmTrap())
  else deactivateConfirmTrap()
})

// Shims so TaskForm buttons reflect both JIRA-submitting and LLM-analyzing states
const formIsSubmitting = computed(() => isSubmitting.value || isAnalyzeLoading.value)
const formCurrentAction = computed(() => isAnalyzeLoading.value ? 'analyze' : currentAction.value)

// Build payload
function buildPayload(action: 'analyze' | 'create' | 'coach' | 'preview'): WebhookPayload {
  return {
    meta: {
      source: 'jira_agent_ui_v8.0',
      timestamp: Date.now(),
      action
    },
    data: {
      project_key: form.projectKey,
      project_name: getProjectName(),
      issue_type: form.issueType,
      summary: computedSummary.value,
      description: form.description,
      assignee: form.assignee,
      estimated_points: form.estimatedPoints
    }
  }
}

// Debounced to avoid JSON.stringify on every keystroke — DevTools tolerates slight staleness
const jsonPayload = ref('')
let _payloadTimer: ReturnType<typeof setTimeout> | null = null
watch(
  [() => form.description, () => form.projectKey, () => form.issueType,
   computedSummary, () => form.assignee, () => form.estimatedPoints],
  () => {
    if (_payloadTimer) clearTimeout(_payloadTimer)
    _payloadTimer = setTimeout(() => {
      jsonPayload.value = JSON.stringify(buildPayload('preview'), null, 2)
    }, 500)
  },
  { immediate: true }
)

// ─── Response persistence ──────────────────────────────────────────────────

const LS_COACH_RESPONSE   = 'coach-last-response'
const LS_ANALYZE_RESPONSE = 'analyze-last-response'
const LS_RESPONSE_SNAPSHOT = 'response-form-snapshot'

function buildFormSnapshot(): string {
  return JSON.stringify({
    project_key: form.projectKey,
    issue_type: form.issueType,
    summary: computedSummary.value,
    description: form.description,
    assignee: form.assignee,
    estimated_points: form.estimatedPoints
  })
}

function saveResponsesToStorage() {
  localStorage.setItem(LS_RESPONSE_SNAPSHOT, buildFormSnapshot())
  if (coachResponse.value !== null)
    localStorage.setItem(LS_COACH_RESPONSE, JSON.stringify(coachResponse.value))
  if (analyzeResponse.value !== null)
    localStorage.setItem(LS_ANALYZE_RESPONSE, JSON.stringify(analyzeResponse.value))
}

function clearResponsesFromStorage() {
  localStorage.removeItem(LS_COACH_RESPONSE)
  localStorage.removeItem(LS_ANALYZE_RESPONSE)
  localStorage.removeItem(LS_RESPONSE_SNAPSHOT)
}

// Invalidate stored responses whenever any snapshot field changes (debounced)
let _clearTimer: ReturnType<typeof setTimeout> | null = null
watch(
  [
    () => form.projectKey,
    () => form.issueType,
    computedSummary,
    () => form.description,
    () => form.assignee,
    () => form.estimatedPoints
  ],
  () => {
    if (_clearTimer) clearTimeout(_clearTimer)
    _clearTimer = setTimeout(clearResponsesFromStorage, 500)
  }
)

function restoreResponsesFromStorage() {
  const snapshot = localStorage.getItem(LS_RESPONSE_SNAPSHOT)
  if (!snapshot || snapshot !== buildFormSnapshot()) return
  try {
    const savedCoach = localStorage.getItem(LS_COACH_RESPONSE)
    const savedAnalyze = localStorage.getItem(LS_ANALYZE_RESPONSE)
    if (savedCoach) coachResponse.value = JSON.parse(savedCoach)
    if (savedAnalyze) analyzeResponse.value = JSON.parse(savedAnalyze)
  } catch { /* ignore malformed entries */ }
}

// Handlers
async function handleAnalyze() {
  if (!canSubmit.value || formIsSubmitting.value) return
  errorMessage.value = ''
  const err = await requestAnalyze(buildPayload('analyze'))
  if (!err) {
    addToast('success', t('toast.analyzeSuccess'))
    addComponentToHistory(summary.component)
    saveResponsesToStorage()
  } else if (err !== 'cancelled') {
    errorMessage.value = err
    addToast('error', err)
  }
}

function handleCreateClick() {
  showConfirmModal.value = true
}

async function confirmCreate() {
  showConfirmModal.value = false
  errorMessage.value = ''
  const err = await createJiraTicket(buildPayload('create'))
  if (err) {
    errorMessage.value = err
    addToast('error', err)
  } else {
    addToast('success', t('toast.createSuccess'))
    const resp = jiraResponse.value as Record<string, unknown> | null
    const key = (resp?.key || (resp?.jira_result as Record<string, unknown>)?.key) as string | undefined
    if (key) {
      addTicket({
        key,
        summary: computedSummary.value,
        project: form.projectKey,
        issueType: form.issueType,
        date: new Date().toISOString()
      })
    }
  }
}

async function handleCoachRequest() {
  if (!canSubmit.value || isCoachLoading.value) return
  errorMessage.value = ''
  const err = await requestCoach(buildPayload('coach'))
  if (!err) {
    addToast('success', t('toast.coachSuccess'))
    saveResponsesToStorage()
  } else if (err !== 'cancelled') {
    errorMessage.value = err
    addToast('error', err)
  }
}

async function handleCoachRetry() {
  errorMessage.value = ''
  const err = await retryCoach()
  if (!err) {
    addToast('success', t('toast.coachSuccess'))
    saveResponsesToStorage()
  } else if (err !== 'cancelled') {
    errorMessage.value = err
    addToast('error', err)
  }
}

async function handleAnalyzeRetry() {
  errorMessage.value = ''
  const err = await retryAnalyze()
  if (!err) {
    addToast('success', t('toast.analyzeSuccess'))
    addComponentToHistory(summary.component)
    saveResponsesToStorage()
  } else if (err !== 'cancelled') {
    errorMessage.value = err
    addToast('error', err)
  }
}

function handleReset() {
  cancelCoach()
  cancelAnalyze()
  resetForm()
  clearResponses()
  clearCoachResponse()
  clearAnalyzeResponse()
  clearResponsesFromStorage()
  errorMessage.value = ''
  addToast('info', t('toast.draftCleared'))
}

function onProjectChange() {
  form.assignee = ''
}

function onSettingsSaved() {
  addToast('success', t('settings.saved'))
}

// Coach chip templates — driven by effective templates (JSON files or localStorage overrides)
function applyCoachChip(chipKey: string) {
  const lang = isZh.value ? 'zh' : 'en'
  const content = getTemplateContent(chipKey, lang)
  if (content) form.description = content
}

function handleTemplateImport(incoming: TemplateDefinition[]) {
  const existingKeys = new Set(effectiveTemplates.value.map(t => t.key))
  const toAdd = incoming.filter(t => t.key && !existingKeys.has(t.key))
  if (toAdd.length === 0) {
    addToast('info', t('toast.noDuplicateTemplates'))
    return
  }
  setCustomTemplates([...effectiveTemplates.value, ...toAdd])
  addToast('success', `${toAdd.length} ${t('toast.templatesImported')}`)
}

// Keyboard shortcuts
function handleKeyboard(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (showHotkeyModal.value) {
      showHotkeyModal.value = false
    } else if (showSettingsModal.value) {
      showSettingsModal.value = false
    } else if (showConfirmModal.value) {
      showConfirmModal.value = false
    }
  } else if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    const tag = (e.target as HTMLElement).tagName
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
      e.preventDefault()
      showHotkeyModal.value = true
    }
  } else if (e.ctrlKey && e.key === ',') {
    e.preventDefault()
    if (!showConfirmModal.value) showSettingsModal.value = true
  } else if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
    e.preventDefault()
    if (analyzeResponse.value) handleCreateClick()
  } else if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault()
    handleAnalyze()
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeyboard)
  const hadDraft = restoreDraft()
  if (hadDraft) {
    addToast('info', t('toast.draftRestored'))
    restoreResponsesFromStorage()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyboard)
})
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-main {
  max-width: 2000px;
  margin: 0 auto;
  padding: 24px;
  flex: 1;
  width: 100%;
}
.grid-layout {
  display: grid;
  grid-template-columns: 3fr 3fr 2fr;
  gap: 20px;
}
.col-left,
.col-center {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.col-left > :deep(*),
.col-center > :deep(*) {
  flex: 1;
  min-height: 0;
}
.col-right {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Confirmation Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5000;
  padding: 24px;
}
.modal-content {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
  padding: 24px;
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: scaleIn 0.2s ease-out;
}
.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.modal-hint {
  font-size: 13px;
  color: var(--text-muted);
}
.modal-payload {
  padding: 12px;
  border-radius: var(--radius-md);
  background-color: var(--bg-tertiary);
  max-height: 400px;
  overflow-y: auto;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Shared button styles */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  border: none;
}
.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}
.btn-ghost:hover {
  background-color: var(--bg-tertiary);
}
.btn-success {
  background-color: var(--accent-green);
  color: white;
}
.btn-success:hover {
  opacity: 0.9;
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@media (max-width: 1024px) {
  .grid-layout {
    grid-template-columns: 1fr;
  }
}
</style>
