import type { AppMode } from '@/composables/useAppMode'
import type { UserRole } from '@/composables/useRole'
import type { ElicitationSet, ReviewStep, ChecklistItem, TraceabilityGap } from './types'

// Explore imports
import { getExploreElicitationSet, buildExploreElicitationPrompt } from './elicitation.explore'

// Task imports
import { getTaskScopingSet, buildTaskScopingPrompt } from './elicitation.task'
import { getReviewChecklist as getTaskChecklist, REVIEW_STEPS as TASK_REVIEW_STEPS } from './review-workflow.task'
import { checkTaskDependencyGaps, buildTaskDependencyContext } from './traceability.task'
import type { TaskLevel } from './traceability.task'

// ── Resolvers ───────────────────────────────────────────────────────────────

// Each resolver returns the Task-flavoured payload only when mode === 'task'.
// 'explore' and 'view' (read-only) both fall through to the no-op default —
// neither runs the structured review/traceability/elicitation flow.
export function getModeElicitationSet(mode: AppMode, role: UserRole, lang: 'zh' | 'en'): ElicitationSet | null {
  if (mode === 'task') return getTaskScopingSet(role, lang)
  if (mode === 'explore') return getExploreElicitationSet(role, lang)
  return null
}

export function getModeElicitationPrompt(mode: AppMode, role: UserRole, lang: 'zh' | 'en'): string {
  if (mode === 'task') return buildTaskScopingPrompt(role, lang)
  if (mode === 'explore') return buildExploreElicitationPrompt(role, lang)
  return ''
}

export function getModeReviewSteps(mode: AppMode): ReviewStep[] {
  return mode === 'task' ? TASK_REVIEW_STEPS : []
}

export function getModeReviewChecklist(mode: AppMode, role: UserRole): ChecklistItem[] {
  return mode === 'task' ? getTaskChecklist(role) : []
}

export function getModeTraceGaps(
  mode: AppMode,
  level: TaskLevel,
  parentId: string
): TraceabilityGap[] {
  return mode === 'task' ? checkTaskDependencyGaps(level, parentId) : []
}

export function getModeTraceContext(
  mode: AppMode,
  level: TaskLevel,
  parentId: string,
  lang: 'zh' | 'en'
): string {
  return mode === 'task' ? buildTaskDependencyContext(level, parentId, lang) : ''
}
