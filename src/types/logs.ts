// Mirror of the server's LogEntry (server/logs/log-bus.ts). The SSE stream and
// GET /api/logs both send this JSON shape.
export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  id: number
  ts: string
  level: LogLevel
  evt?: string
  msg: string
  source?: string
  ip?: string
  team_key?: string
  detail?: Record<string, unknown>
}

export type LogFilter = 'all' | 'audit' | 'warn' | 'error'
