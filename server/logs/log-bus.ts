// In-process activity/audit bus. Two producers feed it:
//   1. audit(log, evt, fields)  — explicit, STRUCTURED critical-action events
//      (config save, ticket create, ...). Pushed directly, no JSON parse.
//   2. logTap                   — Fastify's pino logger `stream`. For every log
//      line it writes straight through to stdout (logging unchanged) and does a
//      cheap `level>=40` substring check; only warn/error (rare) are parsed and
//      pushed. Info/debug — the overwhelming majority — are skipped with no
//      JSON.parse and no allocation, so the always-on overhead is ~one scan.
//
// Consumers: the SSE endpoint replays the ring then subscribes for live entries;
// evt/error entries are also persisted to SQLite for durable history.
import { Writable } from 'node:stream'
import { EventEmitter } from 'node:events'
import type { FastifyBaseLogger } from 'fastify'
import { insertAuditLog } from '../db.js'

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  id: number
  ts: string            // ISO 8601
  level: LogLevel
  evt?: string          // audit event code, e.g. 'team.save'
  msg: string
  source?: string       // 'ui' | 'n8n' | 'system'
  ip?: string
  team_key?: string
  detail?: Record<string, unknown>
}

const RING_SIZE = Math.max(50, Number(process.env.LOG_RING_SIZE ?? 500))

const ring: LogEntry[] = []
const emitter = new EventEmitter()
emitter.setMaxListeners(0) // many SSE viewers shouldn't warn
let seq = 0

// Fields that are pino bookkeeping, not worth surfacing as audit `detail`.
const PINO_META = new Set(['level', 'time', 'pid', 'hostname', 'msg', 'evt', 'source', 'ip', 'team_key', 'v'])

function pushEntry(e: Omit<LogEntry, 'id' | 'ts'> & { id?: number; ts?: string }): LogEntry {
  const entry: LogEntry = {
    id: ++seq,
    ts: e.ts ?? new Date().toISOString(),
    level: e.level,
    msg: e.msg,
    ...(e.evt ? { evt: e.evt } : {}),
    ...(e.source ? { source: e.source } : {}),
    ...(e.ip ? { ip: e.ip } : {}),
    ...(e.team_key ? { team_key: e.team_key } : {}),
    ...(e.detail && Object.keys(e.detail).length ? { detail: e.detail } : {})
  }
  ring.push(entry)
  if (ring.length > RING_SIZE) ring.shift()
  emitter.emit('entry', entry)
  // Durable: persist audit events and any error. Never let a DB hiccup break logging.
  if (entry.evt || entry.level === 'error') {
    try { insertAuditLog(entry) } catch { /* best-effort */ }
  }
  return entry
}

/** Recent entries (oldest→newest) for SSE replay-on-connect. */
export function ring_(): LogEntry[] {
  return ring.slice()
}

/** Subscribe to live entries; returns an unsubscribe fn. */
export function subscribe(fn: (e: LogEntry) => void): () => void {
  emitter.on('entry', fn)
  return () => emitter.off('entry', fn)
}

/**
 * Emit a structured critical-action audit event. Pushed to the bus directly
 * (no parse) and also logged to stdout for ops visibility. logTap skips any line
 * carrying `"evt":`, so an audit line is never double-ingested regardless of its
 * level (a warn-level audit and the tap's warn capture don't collide).
 */
export function audit(
  log: FastifyBaseLogger,
  evt: string,
  fields: { level?: LogLevel; source?: string; ip?: string; team_key?: string; msg?: string; detail?: Record<string, unknown> } = {}
): void {
  const { level = 'info', msg, ...rest } = fields
  pushEntry({ level, evt, msg: msg ?? evt, source: rest.source, ip: rest.ip, team_key: rest.team_key, detail: rest.detail })
  const line = { evt, ...rest }
  if (level === 'error') log.error(line, msg ?? evt)
  else if (level === 'warn') log.warn(line, msg ?? evt)
  else log.info(line, msg ?? evt)
}

/**
 * Fastify logger `stream`: pass-through to stdout, then cheaply capture only
 * warn/error lines into the bus. Wrapped so a parse error can never break logs.
 */
export const logTap = new Writable({
  write(chunk: Buffer, _enc, cb) {
    process.stdout.write(chunk)
    try {
      const text = chunk.toString('utf8')
      for (const line of text.split('\n')) {
        if (!line) continue
        const at = line.indexOf('"level":')
        if (at === -1) continue
        const lvl = parseInt(line.slice(at + 8), 10)
        if (!(lvl >= 40)) continue // skip info/debug WITHOUT parsing
        if (line.includes('"evt":')) continue // audit() already pushed this — no double-ingest
        const o = JSON.parse(line) as Record<string, unknown>
        const detail: Record<string, unknown> = {}
        for (const k of Object.keys(o)) if (!PINO_META.has(k)) detail[k] = o[k]
        pushEntry({
          level: lvl >= 50 ? 'error' : 'warn',
          msg: typeof o.msg === 'string' ? o.msg : '',
          ts: typeof o.time === 'number' ? new Date(o.time).toISOString() : undefined,
          source: typeof o.source === 'string' ? o.source : undefined,
          ip: typeof o.ip === 'string' ? o.ip : undefined,
          team_key: typeof o.team_key === 'string' ? o.team_key : undefined,
          detail
        })
      }
    } catch { /* never break logging */ }
    cb()
  }
})
