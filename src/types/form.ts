import type { ProjectKey } from './team'
import type { TaskLevel } from '@/config/domain/traceability.task'

export interface FormState {
  projectKey: ProjectKey | ''
  issueType: '' | 'Story' | 'Task' | 'Bug' | 'Feature'
  assignee: string
  estimatedPoints: number
  description: string
  /** Task hierarchy level (traceability) */
  requirementLevel: TaskLevel
  /** Parent/source requirement ID (traceability) */
  parentReqId: string
  /** Verification method (traceability) */
  verificationMethod: string
}

export interface SummaryState {
  vehicle: string
  product: string
  layer: string
  component: string
  detail: string
}

export interface TaskTypeConfig {
  value: 'Story' | 'Task' | 'Bug' | 'Feature'
  label: string
  color: string
  bgActive: string
}
