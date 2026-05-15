// JSON Schema for spec §3 — the n8n → /api/tickets request body.
// Fastify validates against this automatically; failures produce a 400.
//
// Spec reference: E:\n8n-code-JavaScripts\http-port-design.MD §3.1–§3.3
export const TICKET_BODY_SCHEMA = {
  type: 'object',
  required: [
    'issueKey', 'issueType', 'project', 'team_key', 'team',
    'summary', 'points', 'assignee', 'displayName',
    'agentCheck', 'status', 'action', 'timestamp'
  ],
  properties: {
    // §3.2 rule 1: must match ^[A-Z]+-\d+$; sentinel "未知KEY" must be rejected.
    issueKey: {
      type: 'string',
      pattern: '^[A-Z]+-\\d+$'
    },
    issueType: { type: 'string', minLength: 1 },
    project: { type: 'string' },
    team_key: { type: 'string', minLength: 1 },
    team: { type: 'string' },
    summary: { type: 'string' },
    // §3.2 rule 4: non-negative integer
    points: { type: 'integer', minimum: 0 },
    assignee: { type: 'string' },
    displayName: { type: 'string' },
    agentCheck: { type: 'string' },
    // §3.2 rule 2 + §3.3 canonical taxonomy
    status: {
      type: 'string',
      enum: ['A', 'B', 'C', 'D', '格式异常', '未知']
    },
    action: { type: 'string', enum: ['create', 'update'] },
    // §3.2 rule 3: ISO 8601 timestamp
    timestamp: { type: 'string', format: 'date-time' }
  },
  // §3.1 — forward compatibility: do not reject unknown fields (v2 may add).
  additionalProperties: true
} as const

export const TICKET_RESPONSE_201 = {
  type: 'object',
  properties: {
    issueKey: { type: 'string' },
    result: { type: 'string', enum: ['created'] }
  }
} as const

export const TICKET_RESPONSE_200 = {
  type: 'object',
  properties: {
    issueKey: { type: 'string' },
    result: { type: 'string', enum: ['updated'] }
  }
} as const

export interface TicketBody {
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
  status: 'A' | 'B' | 'C' | 'D' | '格式异常' | '未知'
  action: 'create' | 'update'
  timestamp: string
}
