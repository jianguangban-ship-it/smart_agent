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
      <BasicInfoSection
        :form="form"
        @project-change="$emit('projectChange')"
      />

      <SummaryBuilder
        :summary="summary"
        :component-history="componentHistory"
        :computed-summary="computedSummary"
        :quality-score="qualityScore"
        :quality-score-color="qualityScoreColor"
        :quality-score-label="qualityScoreLabel"
      />

      <DescriptionEditor v-model="form.description" />

      <!-- Action Buttons -->
      <div class="form-actions">
        <button
          class="action-btn action-reset"
          :disabled="isSubmitting || isCoachLoading"
          :title="t('form.reset')"
          @click="$emit('reset')"
        >
          <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
        <div class="action-group">
          <!-- Writing Guidance -->
          <button
            class="action-btn action-coach"
            :disabled="!canCoachSubmit || isSubmitting || isCoachLoading"
            :title="t('coach.requestBtn')"
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
          <!-- Analyze Task (hidden in free-chat mode) -->
          <button
            v-show="coachSkillEnabled"
            class="action-btn action-analyze"
            :class="{ dimmed: hasAiResponse }"
            :disabled="!canSubmit || isSubmitting || isCoachLoading"
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
          <!-- Create JIRA -->
          <Transition name="fade">
            <button
              v-if="hasAiResponse"
              class="action-btn action-create"
              :disabled="isSubmitting || isCoachLoading"
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
import type { FormState, SummaryState } from '@/types/form'
import { useI18n } from '@/i18n'
import { coachSkillEnabled } from '@/composables/useLLM'
import BasicInfoSection from './BasicInfoSection.vue'
import SummaryBuilder from './SummaryBuilder.vue'
import DescriptionEditor from './DescriptionEditor.vue'

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
  errorMessage: string
}>()

defineEmits<{
  coach: []
  analyze: []
  create: []
  reset: []
  projectChange: []
  clearError: []
}>()

const { t } = useI18n()
</script>

<style scoped>
.task-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.error-banner {
  padding: 12px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--accent-red);
  background-color: rgba(248, 81, 73, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.error-content {
  display: flex;
  align-items: center;
  gap: 8px;
}
.error-icon {
  width: 16px;
  height: 16px;
  color: var(--accent-red);
  flex-shrink: 0;
}
.error-text {
  font-size: 14px;
  color: var(--accent-red);
}
.error-close {
  padding: 4px;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  transition: background-color 0.15s;
}
.error-close:hover {
  background-color: rgba(255,255,255,0.1);
}
.close-icon {
  width: 16px;
  height: 16px;
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
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.action-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Icon-only action buttons */
.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}
.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.action-icon {
  width: 18px;
  height: 18px;
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

/* Create JIRA — green */
.action-create {
  background-color: var(--accent-green);
  color: white;
  animation: fadeIn 0.3s ease-out;
}
.action-create:hover:not(:disabled) {
  filter: brightness(1.15);
}

/* Disabled overrides for colored buttons */
.action-reset:disabled,
.action-coach:disabled,
.action-analyze:disabled,
.action-create:disabled {
  background-color: var(--bg-tertiary);
  color: var(--text-muted);
  filter: none;
}
</style>
