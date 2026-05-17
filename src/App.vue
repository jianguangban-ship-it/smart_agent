<template>
  <div class="app" :class="{ 'app--explore-lock': appMode === 'explore', 'app--task-lock': appMode === 'task' }">
    <AppHeader :is-ai-busy="isAiBusy" @open-settings="showSettingsModal = true" />

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

    <main class="app-main" :class="{ 'app-main--view': appMode === 'view', 'app-main--explore': appMode === 'explore', 'app-main--task': appMode === 'task' }">
      <!-- View mode: full-width JIRA Quality Grid (n8n-fed) -->
      <QualityGridPanel v-if="appMode === 'view'" />

      <!-- Explore mode: full-width chat -->
      <ExploreChat
        v-else-if="appMode === 'explore'"
        :messages="exploreCoachMessages"
        :is-loading="isExploreCoachLoading"
        :had-error="exploreCoachHadError"
        :backoff-secs="exploreCoachBackoffSecs"
        @send="handleExploreSend"
        @cancel="cancelExploreCoach"
        @new-chat="handleExploreNewChat"
        @replay="handleExploreReplay"
        @continue-session="handleExploreContinueSession"
      />

      <div
        v-show="appMode === 'task'"
        class="grid-layout"
        ref="gridRef"
        :style="gridStyle"
      >
        <!-- LEFT: AI Coach -->
        <div class="col-left">
          <CoachPanel
            :messages="taskCoachMessages"
            :is-loading="isTaskCoachLoading"
            :was-cancelled="taskCoachWasCancelled"
            :had-error="taskCoachHadError"
            :stream-speed="taskCoachStreamSpeed"
            :backoff-secs="taskCoachBackoffSecs"
            :description-focused="descFocused"
            :can-coach-submit="canCoachSubmit"
            :is-analyzing="isAnalyzeLoading"
            v-model:description="form.description"
            @cancel="cancelTaskCoach"
            @coach="handleCoachRequest"
            @retry="handleCoachRetry"
            @apply-chip="applyCoachChip"
            @elicit="handleElicitation"
            @conflict-check="handleConflictCheck"
            @import-templates="handleTemplateImport"
            @replay="handleReplay"
            @continue-session="handleContinueSession"
            @desc-focus="descFocused = true"
            @desc-blur="descFocused = false"
          >
            <!-- Task Analysis lives as CoachPanel's Analysis tab (App still
                 owns analyze state — slotted, no prop re-plumbing). -->
            <template #analysis>
              <AIReviewPanel
                :response="analyzeResponse"
                :previous-response="previousAnalyzeResponse"
                :is-analyzing="isAnalyzeLoading"
                :is-deep-review="isDeepReview"
                :has-error="!!errorMessage && formCurrentAction === 'analyze'"
                :was-cancelled="analyzeWasCancelled"
                :had-error="analyzeHadError"
                :stream-speed="analyzeStreamSpeed"
                :backoff-secs="analyzeBackoffSecs"
                :estimated-points="form.estimatedPoints"
                @cancel="cancelAnalyze"
                @retry="handleAnalyzeRetry"
              />
            </template>
          </CoachPanel>
        </div>

        <!-- Drag handle: left | center -->
        <div
          class="col-drag-handle"
          @mousedown="startDrag('left', $event)"
        >
          <div class="drag-grip"></div>
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
            :can-coach-submit="canCoachSubmit"
            :is-submitting="formIsSubmitting"
            :is-coach-loading="isCoachLoading"
            :current-action="formCurrentAction"
            :has-ai-response="!!analyzeResponse"
            :has-coach-response="coachMessages.length > 0 && !isCoachLoading"
            :traceability-gaps="traceabilityGaps"
            :error-message="errorMessage"
            :review-status="reviewStatus"
            :current-step-index="currentStepIndex"
            :checklist="checklist"
            :checked-items="checkedItems"
            :all-checked="allChecked"
            :check-progress="checkProgress"
            :jira-response="jiraResponse"
            @analyze="handleAnalyze"
            @create="handleCreateClick"
            @reset="handleReset"
            @cancel-coach="cancelTaskCoach"
            @project-change="onProjectChange"
            @suggest-links="handleSuggestLinks"
            @impact-analysis="handleImpactAnalysis"
            @toggle-check="toggleCheck"
            @approve="advanceTo('approved')"
            @export-markdown="handleExportMarkdown"
            @export-req-i-f="handleExportReqIF"
            @export-excel="handleExportExcel"
            @clear-error="errorMessage = ''"
          />
        </div>

        <!-- Drag handle: center | right -->
        <div
          class="col-drag-handle"
          @mousedown="startDrag('right', $event)"
        >
          <div class="drag-grip"></div>
        </div>

        <!-- RIGHT: Ticket History + JIRA -->
        <div class="col-right">
          <TicketHistoryPanel
            :last-created-key="lastCreatedKey"
            :is-creating="isSubmitting && currentAction === 'create'"
          />


          <BatchPanel
            :batch-items="batchItems"
            :selected-count="selectedCount"
            @add-current="handleAddCurrentToBatch"
            @clear-batch="clearBatch"
            @toggle-item="toggleBatchItem"
            @toggle-all="toggleBatchAll"
            @remove-item="removeBatchItem"
            @bulk-analyze="handleBulkAnalyze"
            @import-c-s-v="handleBatchImportCSV"
          />
        </div>
      </div>
    </main>

    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { WebhookPayload } from '@/types/api'
import { useI18n } from '@/i18n'
import { useForm } from '@/composables/useForm'
import { useWebhook } from '@/composables/useWebhook'
import { useLLM, coachSkillEnabled, setCoachSkillEnabled } from '@/composables/useLLM'
import { appMode, applyModeFlags } from '@/composables/useAppMode'
import { loadRuntimeConfig, runtimeTeamMembers, runtimeProjects } from '@/composables/useRuntimeConfig'
import { setSelectedProjectName } from '@/composables/useSprint'
import { useToast } from '@/composables/useToast'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { addTicket } from '@/composables/useTicketHistory'
import { useReviewWorkflow } from '@/composables/useReviewWorkflow'
import { useReviewHistory } from '@/composables/useReviewHistory'
import { exportMarkdown, exportReqIF, exportExcelCSV, downloadFile } from '@/utils/exportFormats'
import { useBatchOps } from '@/composables/useBatchOps'
import { getModeElicitationPrompt, buildConflictCheckPrompt, buildTraceSuggestPrompt, buildImpactAnalysisPrompt } from '@/config/domain'
import type { TaskLevel } from '@/config/domain/traceability.task'
import { currentRole } from '@/composables/useRole'
import { useAttachment } from '@/composables/useAttachment'
import { getTemplateContent, effectiveTemplates, setCustomTemplates } from '@/config/templates/index'
import type { TemplateDefinition } from '@/types/template'
import { getSessionRecords, startNewSession } from '@/composables/useCoachHistory'

import AppHeader from '@/components/layout/AppHeader.vue'
import LLMSettings from '@/components/settings/LLMSettings.vue'
import HotkeyModal from '@/components/shared/HotkeyModal.vue'
import TaskForm from '@/components/form/TaskForm.vue'
import CoachPanel from '@/components/panels/CoachPanel.vue'
import AIReviewPanel from '@/components/panels/AIReviewPanel.vue'
// JiraResponsePanel removed in v10.73 — "Creating" indicator moved to TicketHistoryPanel
import TicketHistoryPanel from '@/components/panels/TicketHistoryPanel.vue'
import BatchPanel from '@/components/panels/BatchPanel.vue'
import ToastContainer from '@/components/shared/ToastContainer.vue'
import JsonViewer from '@/components/shared/JsonViewer.vue'
import QualityGridPanel from '@/components/quality/QualityGridPanel.vue'
import ExploreChat from '@/components/chat/ExploreChat.vue'

const { t, isZh } = useI18n()
const { addToast } = useToast()

// ─── Column drag-resize ─────────────────────────────────────────────────────
const gridRef = ref<HTMLElement>()
const LS_COL_SIZES = 'grid-col-sizes'

// Default fractions: left 3, center 3, right 2  (total 8)
const colFractions = ref<[number, number, number]>([3, 3, 2])

// Restore saved sizes
try {
  const saved = localStorage.getItem(LS_COL_SIZES)
  if (saved) {
    const parsed = JSON.parse(saved)
    if (Array.isArray(parsed) && parsed.length === 3) colFractions.value = parsed as [number, number, number]
  }
} catch { /* ignore */ }

const gridStyle = computed(() => {
  const [l, c, r] = colFractions.value
  return {
    gridTemplateColumns: `${l}fr 6px ${c}fr 6px ${r}fr`
  }
})

let dragSide: 'left' | 'right' | null = null
let dragStartX = 0
let dragStartFractions: [number, number, number] = [3, 3, 2]

function startDrag(side: 'left' | 'right', e: MouseEvent) {
  e.preventDefault()
  dragSide = side
  dragStartX = e.clientX
  dragStartFractions = [...colFractions.value] as [number, number, number]
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onDrag(e: MouseEvent) {
  if (!gridRef.value || !dragSide) return
  const gridWidth = gridRef.value.offsetWidth - 12 // subtract 2 handle widths (6px each)
  const totalFr = dragStartFractions[0] + dragStartFractions[1] + dragStartFractions[2]
  const dx = e.clientX - dragStartX
  const dFr = (dx / gridWidth) * totalFr
  const minFr = 1 // minimum column fraction

  const [l, c, r] = dragStartFractions
  if (dragSide === 'left') {
    let newL = l + dFr
    let newC = c - dFr
    if (newL < minFr) { newC += newL - minFr; newL = minFr }
    if (newC < minFr) { newL += newC - minFr; newC = minFr }
    colFractions.value = [+newL.toFixed(3), +newC.toFixed(3), r]
  } else {
    let newC = c + dFr
    let newR = r - dFr
    if (newC < minFr) { newR += newC - minFr; newC = minFr }
    if (newR < minFr) { newC += newR - minFr; newR = minFr }
    colFractions.value = [l, +newC.toFixed(3), +newR.toFixed(3)]
  }
}

function stopDrag() {
  dragSide = null
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  localStorage.setItem(LS_COL_SIZES, JSON.stringify(colFractions.value))
}

const {
  form, summary, componentHistory, computedSummary,
  canSubmit, qualityScore, qualityScoreColor, qualityScoreLabel,
  traceabilityGaps,
  getProjectName, resetForm, addComponentToHistory, restoreDraft
} = useForm()

// Sync selected Agile Team's project name (e.g. "IDC_PDSW") into the
// module-level state read by useSprint's cadenceString. The dropdown
// stores form.projectKey (e.g. "DKKF"); the cadence rule operates on the
// project name string, so we look it up via runtimeProjects.
watch(
  [() => form.projectKey, runtimeProjects],
  ([key]) => {
    const proj = runtimeProjects.value.find(p => p.key === key)
    setSelectedProjectName(proj?.name ?? '')
  },
  { immediate: true }
)

const { attachedFile } = useAttachment()

const {
  isSubmitting, currentAction,
  jiraResponse,
  createJiraTicket, clearResponses
} = useWebhook()

const {
  // task channel
  isTaskCoachLoading, taskCoachMessages, taskCoachWasCancelled, taskCoachHadError,
  taskCoachStreamSpeed, taskCoachBackoffSecs,
  requestTaskCoach, cancelTaskCoach, retryTaskCoach, clearTaskCoach, restoreTaskCoachMessages,
  // explore channel
  isExploreCoachLoading, exploreCoachMessages, exploreCoachWasCancelled, exploreCoachHadError,
  exploreCoachStreamSpeed, exploreCoachBackoffSecs,
  requestExploreCoach, cancelExploreCoach, clearExploreCoach, restoreExploreCoachMessages,
  // back-compat (read-only, active mode)
  isCoachLoading, coachResponse, coachMessages, coachWasCancelled, coachHadError,
  coachStreamSpeed, coachBackoffSecs,
  // analyze (unchanged)
  isAnalyzeLoading, analyzeResponse, previousAnalyzeResponse, analyzeWasCancelled, analyzeHadError,
  analyzeStreamSpeed, analyzeBackoffSecs,
  requestAnalyze, cancelAnalyze, retryAnalyze, clearAnalyzeResponse,
  isDeepReview, requestDeepReview
} = useLLM()

const descFocused = ref(false)

const {
  reviewStatus, currentStepIndex, checklist, checkedItems,
  allChecked, checkProgress, advanceTo, toggleCheck, resetWorkflow
} = useReviewWorkflow()

// Panel UI removed (v10.102) but the learning loop is intentionally kept:
// addReviewRecord still records on ticket creation and feeds
// buildLearningContext() into the Analyze/Deep-Review prompts (useLLM).
const { addRecord: addReviewRecord } = useReviewHistory()

const lastCreatedKey = ref('')

const {
  batchItems, selectedCount,
  addItem: addBatchItem, removeItem: removeBatchItem,
  toggleItem: toggleBatchItem, toggleAll: toggleBatchAll,
  clearBatch, importCSV: importBatchCSV
} = useBatchOps()

const errorMessage = ref('')
const showConfirmModal = ref(false)
const showSettingsModal = ref(false)
const pendingPromptOverride = ref<string | null>(null)

// Per-mode description store — each mode owns its own description so resets are isolated.
// On mode switch, the outgoing description is saved and the incoming one is restored.
const modeDescriptions = reactive<Record<string, string>>({
  explore: '',
  task: '',
  view: ''  // View is read-only — kept for shape consistency, never written
})
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

// Drives the breathing glow on AppHeader's bottom border while AI is streaming
const isAiBusy = computed(() => isCoachLoading.value || isAnalyzeLoading.value)

// Per-mode coach submit guard
const canCoachSubmit = computed(() => {
  switch (appMode.value) {
    case 'explore':
      return !!form.description.trim() || !!attachedFile.value
    case 'task':
      // All task fields required: project + assignee + type + points + 5-part summary + description
      return canSubmit.value && !!form.assignee && !!form.estimatedPoints && !!form.description.trim()
    default:
      return canSubmit.value
  }
})

function buildAssignee(): { name: string; displayName: string } | undefined {
  if (!form.assignee) return undefined
  const member = (runtimeTeamMembers.value[form.projectKey] || [])
    .find(u => u.id === form.assignee)
  return {
    name: form.assignee,
    displayName: member?.name ?? ''
  }
}

// Build payload — for coach/preview, content adapts to Skill and Task-Coach toggles
function buildPayload(action: 'analyze' | 'create' | 'coach' | 'preview' | 'deepReview'): WebhookPayload {
  const meta = { source: 'jira_agent_ui_v8.0', timestamp: Date.now(), action }

  // analyze / create always need the full task fields
  if (action === 'analyze' || action === 'create') {
    return {
      meta,
      data: {
        project_key: form.projectKey,
        project_name: getProjectName(),
        issue_type: form.issueType,
        summary: computedSummary.value,
        description: form.description,
        assignee: buildAssignee(),
        estimated_points: form.estimatedPoints,
        requirement_level: form.requirementLevel !== 'none' ? form.requirementLevel : undefined,
        parent_req_id: form.parentReqId || undefined,
        verification_method: form.verificationMethod || undefined
      }
    }
  }

  // coach / preview — payload driven by appMode
  // For coach action, use pendingPromptOverride if set (tool-triggered chips bypass form.description)
  const desc = (action === 'coach' && pendingPromptOverride.value !== null)
    ? pendingPromptOverride.value
    : form.description

  switch (appMode.value) {
    case 'explore': {
      // Prepend attached file content (markdown) if present
      const exploreDesc = attachedFile.value
        ? `[Attached file: ${attachedFile.value.name}]\n\n${attachedFile.value.content}\n\n---\n\n${desc}`
        : desc
      return { meta, data: { description: exploreDesc } }
    }

    case 'task':
    default:
      return {
        meta,
        data: {
          project_key: form.projectKey,
          project_name: getProjectName(),
          issue_type: form.issueType,
          summary: computedSummary.value,
          description: desc,
          assignee: buildAssignee(),
          estimated_points: form.estimatedPoints
        }
      }
  }
}

// Debounced to avoid JSON.stringify on every keystroke — DevTools tolerates slight staleness
const jsonPayload = ref('')
let _payloadTimer: ReturnType<typeof setTimeout> | null = null
watch(
  [() => form.description, () => form.projectKey, () => form.issueType,
   computedSummary, () => form.assignee, () => form.estimatedPoints,
   coachSkillEnabled, appMode],
  () => {
    if (_payloadTimer) clearTimeout(_payloadTimer)
    _payloadTimer = setTimeout(() => {
      jsonPayload.value = JSON.stringify(buildPayload('preview'), null, 2)
    }, 500)
  },
  { immediate: true }
)

// On mode switch: save outgoing description, restore incoming description.
// Form fields and AI state are preserved — only the description is mode-scoped.
watch(appMode, (newMode, oldMode) => {
  modeDescriptions[oldMode] = form.description
  form.description = modeDescriptions[newMode]
}, { immediate: false })

// ─── Response persistence ──────────────────────────────────────────────────

const LS_COACH_RESPONSE   = 'coach-last-response'
const LS_TASK_RESPONSE    = 'task-last-response'
const LS_EXPLORE_RESPONSE = 'explore-last-response'
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
  if (taskCoachMessages.value.length > 0)
    localStorage.setItem(LS_TASK_RESPONSE, JSON.stringify(taskCoachMessages.value))
  if (exploreCoachMessages.value.length > 0)
    localStorage.setItem(LS_EXPLORE_RESPONSE, JSON.stringify(exploreCoachMessages.value))
  if (analyzeResponse.value !== null)
    localStorage.setItem(LS_ANALYZE_RESPONSE, JSON.stringify(analyzeResponse.value))
}

function clearResponsesFromStorage() {
  localStorage.removeItem(LS_COACH_RESPONSE)
  localStorage.removeItem(LS_TASK_RESPONSE)
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
    const tRaw = localStorage.getItem(LS_TASK_RESPONSE)
    if (tRaw) taskCoachMessages.value = JSON.parse(tRaw)
    const eRaw = localStorage.getItem(LS_EXPLORE_RESPONSE)
    if (eRaw) exploreCoachMessages.value = JSON.parse(eRaw)
    // one-time migration of the legacy single key into the task channel
    const legacy = localStorage.getItem(LS_COACH_RESPONSE)
    if (legacy && !tRaw) {
      taskCoachMessages.value = JSON.parse(legacy)
      localStorage.removeItem(LS_COACH_RESPONSE)
    }
    const savedAnalyze = localStorage.getItem(LS_ANALYZE_RESPONSE)
    if (savedAnalyze) analyzeResponse.value = JSON.parse(savedAnalyze)
  } catch { /* ignore corrupt cache */ }
}

// Handlers
async function handleAnalyze() {
  const analyzeReady = canCoachSubmit.value
  if (!analyzeReady || formIsSubmitting.value) return
  errorMessage.value = ''
  const err = await requestAnalyze(buildPayload('analyze'))
  if (!err) {
    addToast('success', t('toast.analyzeSuccess'))
    addComponentToHistory(summary.component)
    saveResponsesToStorage()
    if (reviewStatus.value === 'draft') advanceTo('ai-reviewed')
  } else if (err !== 'cancelled') {
    errorMessage.value = err
    addToast('error', err)
  }
}

async function handleDeepReview() {
  if (!canSubmit.value || formIsSubmitting.value) return
  errorMessage.value = ''
  const err = await requestDeepReview(buildPayload('deepReview'))
  if (!err) {
    addToast('success', t('toast.analyzeSuccess'))
    addComponentToHistory(summary.component)
    saveResponsesToStorage()
    if (reviewStatus.value === 'draft') advanceTo('ai-reviewed')
  } else if (err !== 'cancelled') {
    errorMessage.value = err
    addToast('error', err)
  }
}

function buildExportData() {
  return {
    form,
    summary,
    computedSummary: computedSummary.value,
    qualityScore: qualityScore.value,
    reviewStatus: reviewStatus.value,
    role: currentRole.value,
    timestamp: new Date().toISOString()
  }
}

function handleExportMarkdown() {
  const content = exportMarkdown(buildExportData())
  const filename = `${computedSummary.value.slice(0, 50).replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}.md`
  downloadFile(content, filename, 'text/markdown;charset=utf-8')
  addToast('success', isZh.value ? '已导出 Markdown' : 'Exported Markdown')
}

function handleExportReqIF() {
  const content = exportReqIF(buildExportData())
  const filename = `requirement-${Date.now()}.reqif`
  downloadFile(content, filename, 'application/xml;charset=utf-8')
  addToast('success', isZh.value ? '已导出 ReqIF' : 'Exported ReqIF')
}

function handleExportExcel() {
  const content = exportExcelCSV(buildExportData())
  const filename = `requirement-${Date.now()}.csv`
  downloadFile(content, filename, 'text/csv;charset=utf-8')
  addToast('success', isZh.value ? '已导出 Excel CSV' : 'Exported Excel CSV')
}

function handleAddCurrentToBatch() {
  addBatchItem({
    summary: computedSummary.value,
    description: form.description,
    issueType: form.issueType as 'Story' | 'Task' | 'Bug' | 'Feature',
    level: form.requirementLevel,
    parentReqId: form.parentReqId || ''
  })
  addToast('success', isZh.value ? '已添加到批量列表' : 'Added to batch list')
}

function handleBatchImportCSV(text: string) {
  const count = importBatchCSV(text)
  if (count > 0) {
    addToast('success', isZh.value ? `已导入 ${count} 条需求` : `Imported ${count} requirements`)
  } else {
    addToast('error', isZh.value ? '导入失败，请检查 CSV 格式' : 'Import failed, check CSV format')
  }
}

async function handleBulkAnalyze() {
  const selected = batchItems.value.filter(b => b.selected)
  if (selected.length === 0) return
  // Analyze first selected item as a demo — full bulk would iterate
  const item = selected[0]
  form.description = item.description
  summary.detail = item.summary
  form.issueType = item.issueType
  form.requirementLevel = item.level
  form.parentReqId = item.parentReqId
  addToast('info', isZh.value ? `已加载批量项: ${item.summary}` : `Loaded batch item: ${item.summary}`)
  await nextTick()
  handleAnalyze()
}

function handleCreateClick() {
  if (!canCoachSubmit.value) return
  // Show the exact payload that will be sent (action: 'create', not 'preview')
  jsonPayload.value = JSON.stringify(buildPayload('create'), null, 2)
  showConfirmModal.value = true
  // Note: duplicate check removed — it sent a 'search' request to n8n which
  // the n8n workflow interpreted as a create action, causing premature ticket creation.
  // Duplicate checking should be done earlier in the workflow, not at create time.
}

async function confirmCreate() {
  showConfirmModal.value = false
  errorMessage.value = ''
  lastCreatedKey.value = ''
  const err = await createJiraTicket(buildPayload('create'))
  if (err) {
    errorMessage.value = err
    addToast('error', err)
  } else {
    addToast('success', t('toast.createSuccess'))
    advanceTo('jira-created')
    const resp = jiraResponse.value as Record<string, unknown> | null
    const key = (resp?.key || (resp?.jira_result as Record<string, unknown>)?.key) as string | undefined
    if (key) {
      lastCreatedKey.value = key
      addTicket({
        key,
        summary: computedSummary.value,
        project: form.projectKey,
        issueType: form.issueType,
        date: new Date().toISOString()
      })
      // Record review history for learning
      const allCheckIds = checklist.value.map(c => c.id)
      const passedIds = allCheckIds.filter(id => checkedItems.value.has(id))
      const failedIds = allCheckIds.filter(id => !checkedItems.value.has(id))
      addReviewRecord({
        ticketKey: key,
        summary: computedSummary.value,
        role: currentRole.value,
        issueType: form.issueType,
        qualityScore: qualityScore.value,
        reviewStatus: reviewStatus.value,
        checklistPassed: passedIds,
        checklistFailed: failedIds
      })
    }
  }
}

async function handleCoachRequest(force = false) {
  if ((!force && !canCoachSubmit.value) || isTaskCoachLoading.value) {
    // Restore mode flags in case a tool handler (elicitation, conflict check, etc.)
    // disabled coachSkillEnabled before calling us — we need to re-assert the mode's
    // canonical flags even on an early return.
    applyModeFlags(appMode.value)
    return
  }
  errorMessage.value = ''
  // Re-clicking Task Guidance starts a new workflow iteration — reset to Draft
  if (appMode.value === 'task' && reviewStatus.value !== 'draft') {
    resetWorkflow()
    lastCreatedKey.value = ''
  }
  const payload = buildPayload('coach')
  pendingPromptOverride.value = null  // consumed — clear so it doesn't affect anything else
  const err = await requestTaskCoach(payload)
  // Re-assert mode flags — tool-triggered handlers may have temporarily overridden coachSkillEnabled
  applyModeFlags(appMode.value)
  if (!err) {
    addToast('success', t('toast.coachSuccess'))
    saveResponsesToStorage()
  } else if (err !== 'cancelled') {
    errorMessage.value = err
    addToast('error', err)
  }
}

// Explore channel — own composer text; does NOT touch form.description.
async function handleExploreSend(text: string) {
  if (!text.trim() || isExploreCoachLoading.value) return
  errorMessage.value = ''
  const payload = buildPayload('coach')
  payload.data.description = text
  const err = await requestExploreCoach(payload)
  if (!err) {
    saveResponsesToStorage()
  } else if (err !== 'cancelled') {
    errorMessage.value = err
    addToast('error', err)
  }
}
function handleExploreNewChat() {
  clearExploreCoach()
  localStorage.removeItem(LS_EXPLORE_RESPONSE)
  startNewSession('explore')
}
function handleExploreReplay(content: string) {
  // Resend the message through the Explore channel (own composer path).
  handleExploreSend(content)
}
function handleExploreContinueSession(sessionId: string) {
  const records = getSessionRecords(sessionId)
  if (records.length === 0) return
  restoreExploreCoachMessages(records)
}

function handleElicitation() {
  const lang = isZh.value ? 'zh' as const : 'en' as const
  pendingPromptOverride.value = getModeElicitationPrompt(appMode.value, currentRole.value, lang)
  // Switch to free-chat mode for interactive Q&A
  if (coachSkillEnabled.value) {
    setCoachSkillEnabled(false)
  }
  nextTick(() => handleCoachRequest(true))
}

function handleSuggestLinks() {
  const lang = isZh.value ? 'zh' as const : 'en' as const
  const prompt = buildTraceSuggestPrompt(
    currentRole.value,
    form.requirementLevel as TaskLevel,
    form.parentReqId,
    form.description,
    lang
  )
  const userDesc = form.description.trim()
  const prefix = lang === 'zh'
    ? '请分析以下需求的追溯关系并给出建议：\n\n'
    : 'Please analyze the traceability of the following requirement and provide suggestions:\n\n'
  form.description = prefix + userDesc + '\n\n---\n\n' + prompt
  if (coachSkillEnabled.value) {
    setCoachSkillEnabled(false)
  }
  nextTick(() => handleCoachRequest())
}

function handleImpactAnalysis() {
  const lang = isZh.value ? 'zh' as const : 'en' as const
  const prompt = buildImpactAnalysisPrompt(
    currentRole.value,
    form.requirementLevel as TaskLevel,
    form.parentReqId,
    form.description,
    lang
  )
  const userDesc = form.description.trim()
  const prefix = lang === 'zh'
    ? '请分析以下需求如果发生变更，会产生哪些波及影响：\n\n'
    : 'Please analyze the ripple effects if the following requirement changes:\n\n'
  form.description = prefix + userDesc + '\n\n---\n\n' + prompt
  if (coachSkillEnabled.value) {
    setCoachSkillEnabled(false)
  }
  nextTick(() => handleCoachRequest())
}

function handleConflictCheck() {
  // Build the full conflict-check prompt with the user's requirements appended.
  // Use pendingPromptOverride so the description field is not touched.
  const lang = isZh.value ? 'zh' as const : 'en' as const
  const systemPrompt = buildConflictCheckPrompt(currentRole.value, lang)
  const userReqs = form.description.trim()
  pendingPromptOverride.value = systemPrompt + '\n\n---\n\n' + userReqs
  // Use free-chat mode so the conflict-check prompt goes directly
  if (coachSkillEnabled.value) {
    setCoachSkillEnabled(false)
  }
  nextTick(() => handleCoachRequest(true))
}

function handleReplay(content: string) {
  form.description = content
  // Force Skill OFF for replay — avoids canSubmit guard when form fields are empty
  if (coachSkillEnabled.value) {
    setCoachSkillEnabled(false)
  }
  nextTick(() => handleCoachRequest())
}

function handleContinueSession(sessionId: string) {
  const records = getSessionRecords(sessionId)
  if (records.length === 0) return
  restoreTaskCoachMessages(records)
}

async function handleCoachRetry() {
  errorMessage.value = ''
  const err = await retryTaskCoach()
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
  errorMessage.value = ''

  if (appMode.value === 'explore') {
    // Explore reset: only clear this mode's description and chat — leave Design/Task untouched
    cancelExploreCoach()
    form.description = ''
    modeDescriptions.explore = ''
    clearExploreCoach()
    localStorage.removeItem(LS_EXPLORE_RESPONSE)
    startNewSession('explore')
  } else {
    // Design / Task reset: clear form, workflow, AI state — leave Explore description untouched
    cancelTaskCoach()
    cancelAnalyze()
    resetForm()
    modeDescriptions[appMode.value] = ''
    clearResponses()
    clearTaskCoach()
    clearAnalyzeResponse()
    clearResponsesFromStorage()
    resetWorkflow()
    lastCreatedKey.value = ''
    startNewSession('task')
  }

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
    handleAnalyze()
  } else if (e.ctrlKey && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
    e.preventDefault()
    if (analyzeResponse.value) handleCreateClick()
  } else if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault()
    handleCoachRequest()
  }
}

// Lifecycle
onMounted(async () => {
  await loadRuntimeConfig()
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
/* Definite-height viewport lock so the PAGE never scrolls — only the inner
   scroll regions do, keeping composers/actions pinned. Shared by Explore and
   Task; do not revert either to relying on .app's min-height. */
.app--explore-lock,
.app--task-lock {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}
.app-main {
  max-width: clamp(1200px, 98vw, 3600px);
  margin: 0 auto;
  padding: var(--space-6) var(--space-1);
  flex: 1;
  width: 100%;
}
/* Bounded full-height region: no vertical padding/growth so the content
   (ExploreChat / the Task grid) fills viewport-minus-header and only its inner
   regions scroll. Keeps the centered max-width + horizontal padding. */
.app-main--explore,
.app-main--task {
  padding-top: 0;
  padding-bottom: 0;
  min-height: 0;
  overflow: hidden;
}
.grid-layout {
  display: grid;
  grid-template-columns: 3fr 6px 3fr 6px 2fr;
  gap: 0;
  transition: grid-template-columns 250ms ease-in-out;
  /* Fill the locked .app-main--task so columns get a definite height and
     scroll internally (Task-only via v-show, so unconditional is safe). */
  height: 100%;
  min-height: 0;
}
.col-left {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: clamp(200px, 15vw, 400px);
}
.col-center {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: clamp(250px, 20vw, 500px);
}
.col-left > :deep(*),
.col-center > :deep(*) {
  flex: 1;
  min-height: 0;
}
.col-right {
  display: flex;
  flex-direction: column;
  /* Right column is not in the .col-left/.col-center flex-children selector, so
     under the viewport lock it scrolls on its own instead of clipping. */
  overflow-y: auto;
  min-height: 0;
  min-width: clamp(150px, 12vw, 350px);
  gap: var(--space-4);
}
/* Drag handles between columns */
.col-drag-handle {
  width: 6px;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 10;
  /* Wider hit area via padding without affecting layout */
  margin: 0 -4px;
  padding: 0 4px;
}
.col-drag-handle:hover .drag-grip,
.col-drag-handle:active .drag-grip {
  background-color: var(--accent-blue);
  opacity: 1;
}
.drag-grip {
  width: 3px;
  height: 48px;
  border-radius: 2px;
  background-color: var(--border-color);
  opacity: 0.5;
  transition: background-color 0.2s, opacity 0.2s;
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
  padding: var(--space-6);
}
.modal-content {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
  padding: var(--space-6);
  max-width: clamp(400px, 35vw, 700px);
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: scaleIn 0.2s ease-out;
}
.modal-title {
  font-size: var(--font-xl);
  font-weight: 600;
  color: var(--text-primary);
}
.modal-hint {
  font-size: var(--font-md);
  color: var(--text-muted);
}
.modal-payload {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background-color: var(--bg-tertiary);
  max-height: 400px;
  overflow-y: auto;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

/* Shared button styles */
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
  font-size: var(--font-lg);
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
    grid-template-columns: 1fr !important;
  }
  .col-drag-handle {
    display: none;
  }
}
</style>
