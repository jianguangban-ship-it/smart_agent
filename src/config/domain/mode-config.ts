import type { AppMode } from '@/composables/useAppMode'
import type { UserRole } from '@/composables/useRole'
import type { QualityViolation, ElicitationSet, ReviewStep, ChecklistItem, TraceabilityGap } from './types'

// Explore imports
import { getExploreElicitationSet, buildExploreElicitationPrompt } from './elicitation.explore'

// Task imports
import { getTaskScopingSet, buildTaskScopingPrompt } from './elicitation.task'
import { checkTaskQuality, taskQualityPenalty } from './quality.task'
import { getReviewChecklist as getTaskChecklist, REVIEW_STEPS as TASK_REVIEW_STEPS } from './review-workflow.task'
import { checkTaskDependencyGaps, buildTaskDependencyContext } from './traceability.task'
import type { TaskLevel } from './traceability.task'

// ── Resolvers ───────────────────────────────────────────────────────────────

export function getModeElicitationSet(mode: AppMode, role: UserRole, lang: 'zh' | 'en'): ElicitationSet | null {
  if (mode === 'explore') return getExploreElicitationSet(role, lang)
  return getTaskScopingSet(role, lang)
}

export function getModeElicitationPrompt(mode: AppMode, role: UserRole, lang: 'zh' | 'en'): string {
  if (mode === 'explore') return buildExploreElicitationPrompt(role, lang)
  return buildTaskScopingPrompt(role, lang)
}

export function getModeQualityCheck(mode: AppMode, description: string): QualityViolation[] {
  if (mode === 'explore') return []
  return checkTaskQuality(description)
}

export function getModeQualityPenalty(mode: AppMode, violations: QualityViolation[]): number {
  if (mode === 'explore') return 0
  return taskQualityPenalty(violations)
}

export function getModeReviewSteps(mode: AppMode): ReviewStep[] {
  if (mode === 'explore') return []
  return TASK_REVIEW_STEPS
}

export function getModeReviewChecklist(mode: AppMode, role: UserRole): ChecklistItem[] {
  if (mode === 'explore') return []
  return getTaskChecklist(role)
}

export function getModeTraceGaps(
  mode: AppMode,
  level: TaskLevel,
  parentId: string
): TraceabilityGap[] {
  if (mode === 'explore') return []
  return checkTaskDependencyGaps(level, parentId)
}

export function getModeTraceContext(
  mode: AppMode,
  level: TaskLevel,
  parentId: string,
  lang: 'zh' | 'en'
): string {
  if (mode === 'explore') return ''
  return buildTaskDependencyContext(level, parentId, lang)
}
