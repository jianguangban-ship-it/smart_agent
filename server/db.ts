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
