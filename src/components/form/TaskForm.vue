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


      <DescriptionEditor v-model="form.description" :incose-violations="incoseViolations" :assumptions="assumptions" />

      <!-- Action Buttons -->
      <div class="form-actions">
        <div class="action-group-left">
        <button
          class="action-btn"
          :class="isCoachLoading ? 'action-cancel' : 'action-reset'"
          :disabled="isSubmitting && !isCoachLoading"
          :title="isCoachLoading ? t('settings.cancel') : t('form.reset')"
          @click="isCoachLoading ? $emit('cancelCoach') : $emit('reset')"
        >
          <Transition name="icon-swap" mode="out-in">
            <!-- Cancel icon (stop square) when coach is streaming -->
            <svg v-if="isCoachLoading" key="cancel" class="action-icon" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <!-- Reset icon (circular arrow) when idle -->
            <svg v-else key="reset" class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </Transition>
        </button>
        <!-- Export dropdown -->
        <div class="export-dropdown" v-if="canSubmit" ref="exportDropdownRef">
          <button class="action-btn action-export" @click="showExportMenu = !showExportMenu" :title="isZh ? '导出' : 'Export'">
            <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
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
          <!-- Coach / Design Guidance -->
          <button
            class="action-btn action-coach"
            :disabled="!canCoachSubmit || isSubmitting || isCoachLoading"
            :title="appMode === 'explore' ? t('coach.requestBtnExplore') : appMode === 'task' ? t('coach.requestBtnTask') : t('coach.requestBtn')"
            @click="$emit('coach')"
          >
            <svg v-if="isCoachLoading" class="action-icon animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
              <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round" opacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
            </svg>
            <svg v-else class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </button>
          <!-- Analyze / Decompose (hidden in free-chat mode) -->
          <button
            v-show="appMode !== 'explore'"
            class="action-btn action-analyze"
            :class="{ dimmed: hasAiResponse }"
            :disabled="!canCoachSubmit || isSubmitting || isCoachLoading || (appMode === 'task' && !hasCoachResponse)"
            :title="t('form.aiAnalyze')"
            @click="$emit('analyze')"
          >
            <svg v-if="isSubmitting && currentAction === 'analyze'" class="action-icon animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
              <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round" opacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
            </svg>
            <svg v-else class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
            </svg>
          </button>
          <!-- Create JIRA — appears after analyze response -->
          <Transition name="fade">
            <button
              v-if="appMode === 'task' && hasAiResponse"
              class="action-btn action-create"
              :disabled="isSubmitting || isCoachLoading || !canCoachSubmit"
              :title="t('form.confirmCreate')"
              @click="$emit('create')"
            >
              <svg v-if="isSubmitting && currentAction === 'create'" class="action-icon animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
                <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round" opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
              </svg>
              <svg v-else class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            </button>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { FormState, SummaryState } from '@/types/form'
import type { QualityViolation, Assumption, TraceabilityGap } from '@/config/domain'
import { useI18n } from '@/i18n'
import { appMode } from '@/composables/useAppMode'
import type { ReviewStatus, ChecklistItem } from '@/config/domain/types'
import BasicInfoSection from './BasicInfoSection.vue'
import SummaryBuilder from './SummaryBuilder.vue'
import DescriptionEditor from './DescriptionEditor.vue'
import ReviewStatusBar from './ReviewStatusBar.vue'

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
  incoseViolations: QualityViolation[]
  assumptions: Assumption[]
  traceabilityGaps: TraceabilityGap[]
  reviewStatus: ReviewStatus
  currentStepIndex: number
  checklist: ChecklistItem[]
  checkedItems: Set<string>
  allChecked: boolean
  checkProgress: number
}>()

defineEmits<{
  coach: []
  analyze: []
  create: []
  reset: []
  cancelCoach: []
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
.form-actions {
  padding: var(--space-4) var(--space-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.action-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Icon-only action buttons */
.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(28px, calc(4.28px + 1.651vw), 48px);
  height: clamp(28px, calc(4.28px + 1.651vw), 48px);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.165, 0.85, 0.45, 1);
  position: relative;
}
.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.action-icon {
  width: var(--icon-sm);
  height: var(--icon-sm);
}

/* Reset — red */
.action-reset {
  background-color: var(--accent-red);
  color: white;
}
.action-reset:hover:not(:disabled) {
  filter: brightness(1.15);
}

/* Writing Guidance — yellow/orange */
.action-coach {
  background-color: var(--accent-orange);
  color: white;
}
.action-coach:hover:not(:disabled) {
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
.action-analyze.dimmed {
  opacity: 0.65;
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

/* Create JIRA — green */
.action-create {
  background-color: var(--accent-green);
  color: white;
  animation: fadeIn 0.3s ease-out;
}
.action-create:hover:not(:disabled) {
  filter: brightness(1.15);
}

/* Cancel (coach streaming) — pulsing red */
.action-cancel {
  background-color: var(--accent-red);
  color: white;
  animation: cancelPulse 1.5s ease-in-out infinite;
}
.action-cancel:hover:not(:disabled) {
  filter: brightness(1.15);
  animation: none;
}
@keyframes cancelPulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--red-border); }
  50% { box-shadow: 0 0 0 4px transparent; }
}

/* Icon swap transition */
.icon-swap-enter-active,
.icon-swap-leave-active {
  transition: all 0.15s ease;
}
.icon-swap-enter-from {
  opacity: 0;
  transform: scale(0.6) rotate(-90deg);
}
.icon-swap-leave-to {
  opacity: 0;
  transform: scale(0.6) rotate(90deg);
}

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
