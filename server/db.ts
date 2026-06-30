import Database from 'better-sqlite3'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TicketBody } from './schemas.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DB_PATH = process.env.QUALITY_DB_PATH ?? resolve(__dirname, '..', 'data', 'quality.db')

let _db: Database.Database | null = null

export function db(): Database.Database {
  if (_db) return _db
  mkdirSync(dirname(DB_PATH), { recursive: true })
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  _db.exec(readFileSync(resolve(__dirname, 'migrations.sql'), 'utf8'))
  return _db
}

export type TicketRow = {
  issue_key: string
  issue_type: string
  team_key: string
  team: string
  project: string
  summary: string
  points: number
  assignee: string
  display_name: string
  agent_check: string
  status: string
  action: string
  event_time: string
  updated_at: string
}

// Single-statement upsert per spec §2.3 — atomic, race-safe.
// Returns 'created' on insert, 'updated' on conflict.
export function upsertTicket(t: TicketBody): 'created' | 'updated' {
  const existed = db()
    .prepare('SELECT 1 FROM tickets WHERE issue_key = ?')
    .get(t.issueKey)

  db().prepare(`
    INSERT INTO tickets (
      issue_key, issue_type, team_key, team, project, summary, points,
      assignee, display_name, agent_check, status, action, event_time, updated_at
    ) VALUES (
      @issueKey, @issueType, @team_key, @team, @project, @summary, @points,
      @assignee, @displayName, @agentCheck, @status, @action, @timestamp, CURRENT_TIMESTAMP
    )
    ON CONFLICT(issue_key) DO UPDATE SET
      issue_type   = excluded.issue_type,
      team_key     = excluded.team_key,
      team         = excluded.team,
      project      = excluded.project,
      summary      = excluded.summary,
      points       = excluded.points,
      assignee     = excluded.assignee,
      display_name = excluded.display_name,
      agent_check  = excluded.agent_check,
      status       = excluded.status,
      action       = excluded.action,
      event_time   = excluded.event_time,
      updated_at   = CURRENT_TIMESTAMP
  `).run(t)

  return existed ? 'updated' : 'created'
}

// Spec §6 grid query — sort newest-first by event_time. Filters optional.
export function listTickets(filter: {
  team_key?: string
  status?: string
  from?: string
  to?: string
} = {}): TicketRow[] {
  const where: string[] = []
  const params: Record<string, unknown> = {}
  if (filter.team_key) { where.push('team_key = @team_key'); params.team_key = filter.team_key }
  if (filter.status)   { where.push('status = @status');     params.status = filter.status }
  // event_time is the n8n ISO-8601 UTC verdict time; TEXT comparison is
  // lexicographic and correct for same-format UTC strings. idx_tickets_event_time serves this.
  if (filter.from) { where.push('event_time >= @from'); params.from = filter.from }
  if (filter.to)   { where.push('event_time <= @to');   params.to   = filter.to }

  const sql = `
    SELECT issue_key, issue_type, team_key, team, project, summary, points,
           assignee, display_name, agent_check, status, action, event_time, updated_at
    FROM tickets
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY event_time DESC
  `
  return db().prepare(sql).all(params) as TicketRow[]
}

// ─── Activity log (v10.228) ──────────────────────────────────────────────────
// Structural input type (avoids importing LogEntry from logs/log-bus, which
// imports this module). detail is stored as a JSON string.
export interface AuditRowIn {
  ts: string
  level: string
  evt?: string
  msg: string
  source?: string
  ip?: string
  team_key?: string
  detail?: Record<string, unknown>
}

export interface AuditRow {
  id: number
  ts: string
  level: string
  evt: string | null
  msg: string
  source: string | null
  ip: string | null
  team_key: string | null
  detail: string | null
}

const LOG_RETENTION_ROWS = Math.max(100, Number(process.env.LOG_RETENTION_ROWS ?? 5000))
const LOG_RETENTION_DAYS = Math.max(1, Number(process.env.LOG_RETENTION_DAYS ?? 90))
let auditInserts = 0

export function insertAuditLog(e: AuditRowIn): void {
  db().prepare(`
    INSERT INTO audit_log (ts, level, evt, msg, source, ip, team_key, detail)
    VALUES (@ts, @level, @evt, @msg, @source, @ip, @team_key, @detail)
  `).run({
    ts: e.ts,
    level: e.level,
    evt: e.evt ?? null,
    msg: e.msg ?? '',
    source: e.source ?? null,
    ip: e.ip ?? null,
    team_key: e.team_key ?? null,
    detail: e.detail ? JSON.stringify(e.detail) : null
  })
  // Throttled prune: never a DELETE on every write.
  if (++auditInserts % 200 === 0) pruneAuditLog()
}

export function listAuditLog(opts: {
  limit?: number
  beforeId?: number
  level?: string
  evt?: string
  q?: string
} = {}): AuditRow[] {
  const where: string[] = []
  const params: Record<string, unknown> = {}
  if (opts.beforeId) { where.push('id < @beforeId'); params.beforeId = opts.beforeId }
  if (opts.level)    { where.push('level = @level'); params.level = opts.level }
  if (opts.evt)      { where.push('evt = @evt');     params.evt = opts.evt }
  if (opts.q)        { where.push('(msg LIKE @q OR detail LIKE @q OR evt LIKE @q)'); params.q = `%${opts.q}%` }
  params.limit = Math.min(Math.max(1, opts.limit ?? 200), 1000)
  const sql = `
    SELECT id, ts, level, evt, msg, source, ip, team_key, detail
    FROM audit_log
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY id DESC
    LIMIT @limit
  `
  return db().prepare(sql).all(params) as AuditRow[]
}

export function pruneAuditLog(): void {
  const d = db()
  // Age-based prune.
  d.prepare(`DELETE FROM audit_log WHERE ts < datetime('now', @age)`).run({ age: `-${LOG_RETENTION_DAYS} days` })
  // Row-cap prune: keep the newest N.
  d.prepare(`
    DELETE FROM audit_log
    WHERE id <= (SELECT MAX(id) FROM audit_log) - @keep
  `).run({ keep: LOG_RETENTION_ROWS })
}

export function auditRowToEntry(r: AuditRow): Record<string, unknown> {
  return {
    id: r.id,
    ts: r.ts,
    level: r.level,
    ...(r.evt ? { evt: r.evt } : {}),
    msg: r.msg,
    ...(r.source ? { source: r.source } : {}),
    ...(r.ip ? { ip: r.ip } : {}),
    ...(r.team_key ? { team_key: r.team_key } : {}),
    ...(r.detail ? { detail: JSON.parse(r.detail) } : {})
  }
}

// Wire-format: snake_case row → spec §3.1 camelCase payload.
export function rowToTicket(r: TicketRow): TicketBody & { updatedAt: string } {
  return {
    issueKey: r.issue_key,
    issueType: r.issue_type,
    project: r.project,
    team_key: r.team_key,
    team: r.team,
    summary: r.summary,
    points: r.points,
    assignee: r.assignee,
    displayName: r.display_name,
    agentCheck: r.agent_check,
    status: r.status as TicketBody['status'],
    action: r.action as TicketBody['action'],
    timestamp: r.event_time,
    updatedAt: r.updated_at
  }
}
