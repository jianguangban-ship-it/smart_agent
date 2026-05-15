// Wire format for the JIRA Quality Grid.
// Mirrors spec §3.1 (E:\n8n-code-JavaScripts\http-port-design.MD).
// The server also returns `updatedAt` (DB write time), distinct from `timestamp` (event time).

export type QualityStatus =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | '格式异常'
  | '未知'

export type QualityAction = 'create' | 'update'

export interface QualityTicket {
  issueKey: string
  issueType: string
  project: string
  team_key: string
  team: string
  summary: string
  points: number
  assignee: string
  displayName: string
  agentCheck: string
  status: QualityStatus | string  // tolerate drift values per spec §3.3
  action: QualityAction
  timestamp: string  // ISO 8601 — event time
  updatedAt?: string // ISO 8601 — DB write time
}

// Canonical taxonomy → display color (spec §3.3).
// Off-taxonomy values render as the gray "drift signal" — spec explicitly
// forbids silently coercing unknown ratings to a known color.
export const STATUS_COLORS: Record<string, string> = {
  A: '#32CD32',
  B: '#1E90FF',
  C: '#FFA500',
  D: '#FF0000',
  '格式异常': '#9932CC',
  '未知': '#808080'
}

export const DRIFT_COLOR = '#808080'

export function colorForStatus(status: string): string {
  return STATUS_COLORS[status] ?? DRIFT_COLOR
}

export function isCanonicalStatus(status: string): boolean {
  return status in STATUS_COLORS
}
