import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyBaseLogger } from 'fastify'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// db.ts and log-bus.ts read env at module load, so set everything BEFORE importing.
let dir: string
let app: FastifyInstance
let bus: typeof import('../logs/log-bus.js')
let dbm: typeof import('../db.js')

// Minimal pino-shaped logger for audit() (it only calls .info).
const fakeLog = { info() {}, warn() {}, error() {} } as unknown as FastifyBaseLogger

function pinoLine(level: number, extra: Record<string, unknown> = {}): Buffer {
  return Buffer.from(JSON.stringify({ level, time: Date.now(), pid: 1, hostname: 'h', msg: 'm', ...extra }) + '\n')
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'logs-'))
  process.env.QUALITY_DB_PATH = join(dir, 'q.db')
  process.env.LOG_RING_SIZE = '50'
  process.env.LOG_RETENTION_ROWS = '100'
  process.env.LOG_RETENTION_DAYS = '90'

  dbm = await import('../db.js')
  dbm.db() // trip migration (creates audit_log)
  bus = await import('../logs/log-bus.js')
  const { logRoutes } = await import('../routes/logs.js')
  app = Fastify()
  await app.register(logRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
  // better-sqlite3 keeps the WAL file handle open (no close() exported); on
  // Windows the locked file makes rmSync throw EPERM. Best-effort — the OS temp
  // dir is reclaimed anyway.
  try { rmSync(dir, { recursive: true, force: true }) } catch { /* locked db file */ }
})

describe('log-bus tap filtering', () => {
  it('skips info/debug lines (no ring entry)', () => {
    const before = bus.ring_().length
    bus.logTap.write(pinoLine(30, { evt: 'should.be.ignored.by.tap' }))
    bus.logTap.write(pinoLine(20))
    expect(bus.ring_().length).toBe(before)
  })

  it('captures warn and error lines', () => {
    const before = bus.ring_().length
    bus.logTap.write(pinoLine(40, { msg: 'a warning' }))
    bus.logTap.write(pinoLine(50, { msg: 'an error' }))
    const ring = bus.ring_()
    expect(ring.length).toBe(before + 2)
    expect(ring.at(-2)?.level).toBe('warn')
    expect(ring.at(-1)?.level).toBe('error')
  })
})

describe('audit()', () => {
  it('pushes a structured entry to the ring and persists it', () => {
    bus.audit(fakeLog, 'team.save', { source: 'ui', ip: '10.0.0.1', team_key: 'HW', msg: 'saved', detail: { addedIds: ['X'] } })
    const last = bus.ring_().at(-1)!
    expect(last.evt).toBe('team.save')
    expect(last.team_key).toBe('HW')
    const rows = dbm.listAuditLog({ evt: 'team.save' })
    expect(rows.length).toBeGreaterThan(0)
    expect(JSON.parse(rows[0].detail!)).toEqual({ addedIds: ['X'] })
  })
})

describe('ring buffer cap', () => {
  it('never exceeds LOG_RING_SIZE', () => {
    for (let i = 0; i < 80; i++) bus.audit(fakeLog, 'noise.evt', { msg: String(i) })
    expect(bus.ring_().length).toBeLessThanOrEqual(50)
  })
})

describe('persistence + prune', () => {
  it('prunes to the row cap', () => {
    for (let i = 0; i < 130; i++) dbm.insertAuditLog({ ts: new Date().toISOString(), level: 'info', evt: 'bulk', msg: String(i) })
    dbm.pruneAuditLog()
    const all = dbm.listAuditLog({ limit: 1000 })
    expect(all.length).toBeLessThanOrEqual(100)
  })
})

describe('audit() level + tap evt-skip (no double-ingest)', () => {
  it('audit() honours a warn level', () => {
    bus.audit(fakeLog, 'auth.fail', { level: 'warn', source: 'n8n', ip: '1.2.3.4', msg: 'bad key' })
    const last = bus.ring_().at(-1)!
    expect(last.level).toBe('warn')
    expect(last.evt).toBe('auth.fail')
  })

  it('tap ignores a warn/error line that carries evt (already pushed by audit)', () => {
    const before = bus.ring_().length
    bus.logTap.write(pinoLine(40, { evt: 'team.save' })) // an audit-originated warn line
    bus.logTap.write(pinoLine(50, { evt: 'jira.create' }))
    expect(bus.ring_().length).toBe(before) // both skipped
  })
})

describe('auditTicketResponse → ticket.write (n8n quality-grid write)', () => {
  it('201 → ticket.write OK (info) with grade/points/action', async () => {
    const { auditTicketResponse } = await import('../routes/tickets.js')
    auditTicketResponse(fakeLog, 201, { issueKey: 'EAX-1234', action: 'create', project: 'IDC_SWSS', team_key: 'SWSS', points: 5, status: 'A', timestamp: '2026-06-18T01:00:00Z' }, '10.0.0.9')
    const e = bus.ring_().at(-1)!
    expect(e.evt).toBe('ticket.write')
    expect(e.level).toBe('info')
    expect(e.detail).toMatchObject({ outcome: 'OK', issueKey: 'EAX-1234', verdict: 'A', action: 'create' })
  })

  it('400 → NOK at warn level (no real ticket id)', async () => {
    const { auditTicketResponse } = await import('../routes/tickets.js')
    auditTicketResponse(fakeLog, 400, { issueKey: '未知KEY', action: 'create', team_key: 'SWSS', timestamp: '2026-06-18T01:01:00Z' }, '10.0.0.9')
    const e = bus.ring_().at(-1)!
    expect(e.evt).toBe('ticket.write')
    expect(e.level).toBe('warn')
    expect(e.detail).toMatchObject({ outcome: 'NOK' })
  })

  it('ignores non-2xx/400 codes (e.g. 401 handled as auth.fail elsewhere)', async () => {
    const { auditTicketResponse } = await import('../routes/tickets.js')
    const before = bus.ring_().length
    auditTicketResponse(fakeLog, 401, { issueKey: 'EAX-1' }, '10.0.0.9')
    expect(bus.ring_().length).toBe(before)
  })
})

describe('POST /api/logs/event (client ping, allowlisted)', () => {
  it('accepts an allowlisted evt and records it (source ui)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/logs/event',
      payload: { evt: 'jira.create', msg: 'jira.create SWSS-9 · OK', detail: { outcome: 'OK', issueKey: 'SWSS-9', team_key: 'SWSS' } }
    })
    expect(res.statusCode).toBe(200)
    const e = bus.ring_().at(-1)!
    expect(e.evt).toBe('jira.create')
    expect(e.source).toBe('ui')
    expect(e.detail).toMatchObject({ outcome: 'OK', issueKey: 'SWSS-9' })
  })

  it('rejects a non-allowlisted evt with 400', async () => {
    const before = bus.ring_().length
    const res = await app.inject({ method: 'POST', url: '/api/logs/event', payload: { evt: 'team.save', detail: {} } })
    expect(res.statusCode).toBe(400)
    expect(bus.ring_().length).toBe(before)
  })
})

describe('GET /api/logs', () => {
  it('returns history rows (newest first) and filters by evt', async () => {
    dbm.insertAuditLog({ ts: new Date().toISOString(), level: 'info', evt: 'ticket.create', msg: 'EAX-1' })
    const res = await app.inject({ method: 'GET', url: '/api/logs?evt=ticket.create&limit=10' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<{ evt?: string }>
    expect(body.length).toBeGreaterThan(0)
    expect(body.every(e => e.evt === 'ticket.create')).toBe(true)
  })
})
