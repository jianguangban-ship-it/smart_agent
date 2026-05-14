/**
 * Shared interfaces for mode-specific config variants.
 * Both .design.ts and .task.ts files must conform to these shapes
 * so the resolver returns consistent types.
 */

/** Re-export ElicitationSet shape — both design and task elicitation conform to this */
export interface ElicitationQuestion {
  questionEn: string
  questionZh: string
  hintEn: string
  hintZh: string
}

export interface ElicitationSet {
  titleEn: string
  titleZh: string
  questions: ElicitationQuestion[]
}

/** Review workflow types — shared by both modes */
export type ReviewStatus = 'draft' | 'ai-reviewed' | 'peer-reviewed' | 'approved' | 'jira-created'

export interface ReviewStep {
  id: ReviewStatus
  labelEn: string
  labelZh: string
  iconColor: string
}

export interface ChecklistItem {
  id: string
  labelEn: string
  labelZh: string
}

/** Traceability gap — shared shape */
export interface TraceabilityGap {
  id: string
  messageEn: string
  messageZh: string
  severity: 'warning' | 'info'
}
