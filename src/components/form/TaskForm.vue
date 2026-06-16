<template>
  <div class="task-form">
    <!-- Error Banner -->
    <Transition name="slide-fade">
      <div v-if="errorMessage" class="error-banner">
        <div class="error-content">
          <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path stroke-linecap="round" d="M12 8v4m0 4h.01"/>
          </svg>
          <span class="error-text">{{ errorMessage }}</span>
        </div>
        <button class="error-close" @click="$emit('clearError')">
          <svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </Transition>

    <div class="form-card">
      <!-- Scrollable form sections (the task description moved to the pinned
           coach-panel composer; this column scrolls internally under the
           viewport lock while .form-actions stays pinned below). -->
      <div class="form-scroll">
        <ReviewStatusBar v-show="appMode === 'task'"
          :review-status="reviewStatus"
          :current-step-index="currentStepIndex"
          :checklist="checklist"
          :checked-items="checkedItems"
          :all-checked="allChecked"
          :check-progress="checkProgress"
          @toggle-check="$emit('toggleCheck', $event)"
          @approve="$emit('approve')"
        />

        <BasicInfoSection v-show="appMode !== 'explore'"
          :form="form"
          @project-change="$emit('projectChange')"
        />

        <SummaryBuilder v-show="appMode !== 'explore'"
          :summary="summary"
          :component-history="componentHistory"
          :computed-summary="computedSummary"
          :quality-score="qualityScore"
          :quality-score-color="qualityScoreColor"
          :quality-score-label="qualityScoreLabel"
        />

        <!-- Slim agent strip — directly under the Live Preview, bottom of the
             middle column (replaces the removed DevTools Agent State) -->
        <AgentInfo
          v-show="appMode === 'task'"
          :jira-response="jiraResponse"
          :is-task-coach-loading="isTaskCoachLoading"
          :task-coach-stream-speed="taskCoachStreamSpeed"
          :task-coach-had-error="taskCoachHadError"
          :task-coach-was-cancelled="taskCoachWasCancelled"
          :task-coach-backoff-secs="taskCoachBackoffSecs"
          :is-analyze-loading="isAnalyzeLoading"
          :analyze-stream-speed="analyzeStreamSpeed"
          :analyze-had-error="analyzeHadError"
          :analyze-was-cancelled="analyzeWasCancelled"
          :analyze-backoff-secs="analyzeBackoffSecs"
        />

        <!-- Bottom-of-column extras (Ticket History, Batch) — App owns their
             state; slotted here so no prop/event re-plumbing through TaskForm. -->
        <slot name="form-extras" />
      </div>

      <!-- Action Buttons (pinned at the bottom of the center column) -->
      <div class="form-actions">
        <div class="action-group-left">
        <!-- Send / Stop — relocated from CoachPanel (v10.125). One slot,
             two states: idle = orange Send (emits coach), streaming =
             red Stop (emits cancelCoach). This is now the sole cancel
             surface during streaming. -->
        <button
          v-if="!isCoachLoading"
          class="action-btn action-coach"
          :disabled="!canCoachSubmit"
          :title="t('coach.requestBtnTask') + ' (Enter)'"
          @click="$emit('coach')"
        >
          <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          <span class="action-label">{{ t('coach.exploreSend') }}</span>
        </button>
        <button
          v-else
          class="action-btn action-stop"
          :title="t('coach.exploreStop')"
          @click="$emit('cancelCoach')"
        >
          <svg class="action-icon" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          <span class="action-label">{{ t('coach.exploreStop') }}</span>
        </button>
        <!-- Reset — icon-only. Stays as Reset (disabled while streaming);
             the Send/Stop button above is the sole cancel surface (v10.125). -->
        <button
          class="action-btn action-btn--icon action-reset"
          :disabled="isSubmitting || isCoachLoading"
          :title="t('form.reset')"
          @click="$emit('reset')"
        >
          <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
        <!-- Export dropdown — label + chevron flag this as a menu. -->
        <div class="export-dropdown" v-if="canSubmit" ref="exportDropdownRef">
          <button class="action-btn action-export" @click="showExportMenu = !showExportMenu" :title="isZh ? '导出' : 'Export'">
            <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <span class="action-label">{{ isZh ? '导出' : 'Export' }}</span>
            <svg class="action-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <Transition name="fade">
            <div v-if="showExportMenu" class="export-menu">
              <button class="export-item" @click="$emit('exportMarkdown'); showExportMenu = false">
                <span class="export-dot" style="background:var(--text-muted)"></span> Markdown
              </button>
              <button class="export-item" @click="$emit('exportReqIF'); showExportMenu = false">
                <span class="export-dot" style="background:var(--accent-blue)"></span> ReqIF
              </button>
              <button class="export-item" @click="$emit('exportExcel'); showExportMenu = false">
                <span class="export-dot" style="background:var(--accent-green)"></span> Excel CSV
              </button>
            </div>
          </Transition>
        </div>
        </div>
        <div class="action-group">
          <!-- Coach trigger moved to the pinned composer Send button in
               CoachPanel; this column keeps Analyze/Create/Reset/Export. -->
          <!-- Analyze / Decompose (hidden in free-chat mode). Sparkles icon
               reads as "AI" better than the previous flask. Hotkey hint
               surfaces the existing Ctrl+Shift+Enter binding. -->
          <!-- Analyze / Cancel — one slot, two states (mirrors Send/Stop):
               idle = Analyze (emits analyze); running = red Cancel (emits
               cancelAnalyze). The action bar is now the sole cancel surface
               during analysis, so the in-panel Cancel was removed (v10.207). -->
          <button
            v-if="appMode !== 'explore' && !isAnalyzeLoading"
            class="action-btn action-analyze"
            :class="{ dimmed: hasAiResponse }"
            :disabled="!canCoachSubmit || isSubmitting || isCoachLoading || (appMode === 'task' && !hasCoachResponse)"
            :title="t('form.aiAnalyze') + ' (Ctrl+Shift+Enter)'"
            @click="$emit('analyze')"
          >
            <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <!-- Sparkles: a big four-point star + a small one -->
              <path d="M12 3 L13.6 8.4 L19 10 L13.6 11.6 L12 17 L10.4 11.6 L5 10 L10.4 8.4 Z" />
              <path d="M18 16 L18.7 18.3 L21 19 L18.7 19.7 L18 22 L17.3 19.7 L15 19 L17.3 18.3 Z" />
            </svg>
            <span class="action-label">{{ t('form.aiAnalyze') }}</span>
          </button>
          <button
            v-else-if="appMode !== 'explore' && isAnalyzeLoading"
            class="action-btn action-stop"
            :title="t('settings.cancel')"
            @click="$emit('cancelAnalyze')"
          >
            <svg class="action-icon" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <span class="action-label">{{ t('settings.cancel') }}</span>
          </button>
          <!-- Create JIRA — always rendered (in Task mode) and held in a
               reserved slot via `.invisible-slot`; it fades in once an
               analyze response exists, so the action bar never jumps. -->
          <button
            v-show="appMode === 'task'"
            class="action-btn action-create"
            :class="{ 'invisible-slot': !hasAiResponse }"
            :disabled="!hasAiResponse || isSubmitting || isCoachLoading || !canCoachSubmit"
            :title="t('form.confirmCreate') + ' (Ctrl+Shift+C)'"
            @click="$emit('create')"
          >
            <svg v-if="isSubmitting && currentAction === 'create'" class="action-icon animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
              <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round" opacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
            </svg>
            <svg v-else class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            <span class="action-label">{{ t('form.confirmCreate') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { FormState, SummaryState } from '@/types/form'
import type { TraceabilityGap } from '@/config/domain'
import { useI18n } from '@/i18n'
import { appMode } from '@/composables/useAppMode'
import type { ReviewStatus, ChecklistItem } from '@/config/domain/types'
import BasicInfoSection from './BasicInfoSection.vue'
import SummaryBuilder from './SummaryBuilder.vue'
import ReviewStatusBar from './ReviewStatusBar.vue'
import AgentInfo from './AgentInfo.vue'

defineProps<{
  form: FormState
  summary: SummaryState
  componentHistory: string[]
  computedSummary: string
  qualityScore: number
  qualityScoreColor: string
  qualityScoreLabel: string
  canSubmit: boolean
  canCoachSubmit: boolean
  isSubmitting: boolean
  isCoachLoading: boolean
  currentAction: string
  hasAiResponse: boolean
  hasCoachResponse: boolean
  errorMessage: string
  traceabilityGaps: TraceabilityGap[]
  reviewStatus: ReviewStatus
  currentStepIndex: number
  checklist: ChecklistItem[]
  checkedItems: Set<string>
  allChecked: boolean
  checkProgress: number
  jiraResponse?: unknown
  isTaskCoachLoading?: boolean
  taskCoachStreamSpeed?: number
  taskCoachHadError?: boolean
  taskCoachWasCancelled?: boolean
  taskCoachBackoffSecs?: number
  isAnalyzeLoading?: boolean
  analyzeStreamSpeed?: number
  analyzeHadError?: boolean
  analyzeWasCancelled?: boolean
  analyzeBackoffSecs?: number
}>()

defineEmits<{
  coach: []
  analyze: []
  create: []
  reset: []
  cancelCoach: []
  cancelAnalyze: []
  projectChange: []
  clearError: []
  suggestLinks: []
  impactAnalysis: []
  toggleCheck: [itemId: string]
  approve: []
  exportMarkdown: []
  exportReqIF: []
  exportExcel: []
}>()

const { t, isZh } = useI18n()
const showExportMenu = ref(false)
const exportDropdownRef = ref<HTMLElement>()

function handleClickOutside(e: MouseEvent) {
  if (exportDropdownRef.value && !exportDropdownRef.value.contains(e.target as Node)) {
    showExportMenu.value = false
  }
}
onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<style scoped>
.task-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.error-banner {
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--accent-red);
  background-color: var(--red-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.error-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.error-icon {
  width: var(--font-xl);
  height: var(--font-xl);
  color: var(--accent-red);
  flex-shrink: 0;
}
.error-text {
  font-size: var(--font-lg);
  color: var(--accent-red);
}
.error-close {
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  transition: background-color 0.15s;
}
.error-close:hover {
  background-color: rgba(255,255,255,0.1);
}
.close-icon {
  width: var(--font-xl);
  height: var(--font-xl);
}
.form-card {
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.form-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.form-actions {
  padding: var(--space-4) var(--space-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  border-top: 1px solid var(--border-color);
}
.action-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Icon-only action buttons */
/* All action buttons share the composer's 44px row height (matches the
   .coach-send/.explore-send heights set in v10.118/v10.120) so the left
   and right columns read as one horizontal band. Labels sit beside the
   icon; icon-only variants use .action-btn--icon (fixed square). */
.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 44px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: opacity 0.2s ease, filter 0.2s ease, background-color 0.15s, box-shadow 0.15s;
  position: relative;
  white-space: nowrap;
}
.action-btn--icon {
  width: 44px;
  padding: 0;
}
/* Disabled = "not available yet" → desaturate + fade (clearly different
   from .dimmed below, which means "already used, still available"). */
.action-btn:disabled {
  opacity: 0.4;
  filter: grayscale(0.55);
  cursor: not-allowed;
}
.action-icon {
  width: var(--icon-sm);
  height: var(--icon-sm);
  flex-shrink: 0;
}
.action-label {
  font-size: var(--font-base);
  font-weight: 600;
  color: inherit;
}
.action-chevron {
  width: 10px;
  height: 10px;
  opacity: 0.85;
  flex-shrink: 0;
}
/* Reserved-space placeholder — keeps the slot in layout so the bar never
   jumps when Create fades in. */
.invisible-slot {
  opacity: 0;
  pointer-events: none;
}

/* Reset — red */
.action-reset {
  background-color: var(--accent-red);
  color: white;
}
.action-reset:hover:not(:disabled) {
  filter: brightness(1.15);
}

/* Send / Writing Guidance — orange */
.action-coach {
  background-color: var(--accent-orange);
  color: white;
}
.action-coach:hover:not(:disabled) {
  filter: brightness(1.15);
}

/* Stop — red, paired state of the Send slot during coach streaming. */
.action-stop {
  background-color: var(--accent-red);
  color: white;
}
.action-stop:hover:not(:disabled) {
  filter: brightness(1.15);
}

/* Analyze — blue */
.action-analyze {
  background-color: var(--accent-blue);
  color: white;
}
.action-analyze:hover:not(:disabled) {
  filter: brightness(1.15);
}
/* "Already used, still available" — keep color, just fade. Color preserved
   so it visually differs from :disabled (which adds grayscale). */
.action-analyze.dimmed {
  opacity: 0.55;
}

/* Deep Review — purple */
.action-deep-review {
  background-color: var(--accent-purple, #7c3aed);
  color: white;
}
.action-deep-review:hover:not(:disabled) {
  filter: brightness(1.15);
}
.action-deep-review.dimmed {
  opacity: 0.65;
}

/* Create JIRA — green. Opacity is transitioned via .invisible-slot for the
   reserved-space fade-in (no entrance animation here, no layout jump). */
.action-create {
  background-color: var(--accent-green);
  color: white;
}
.action-create:hover:not(:disabled) {
  filter: brightness(1.15);
}

/* v10.124: removed .action-cancel + cancelPulse + .icon-swap-* — the
   composer Stop button is now the sole cancel surface during streaming,
   so the right-column Reset stays as Reset (disabled while streaming). */

/* Disabled overrides for colored buttons */
/* Action group left */
.action-group-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Export dropdown */
.export-dropdown {
  position: relative;
}
.action-export {
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}
.action-export:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--accent-blue);
}
.export-menu {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  min-width: 120px;
  padding: 4px;
  border-radius: var(--radius-md);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 10;
}
.export-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  background: transparent;
  color: var(--text-secondary);
  border: none;
  cursor: pointer;
  transition: all 0.1s;
}
.export-item:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}
.export-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.action-reset:disabled,
.action-coach:disabled,
.action-analyze:disabled,
.action-deep-review:disabled,
.action-create:disabled {
  background-color: var(--bg-tertiary);
  color: var(--text-muted);
  filter: none;
}
</style>
