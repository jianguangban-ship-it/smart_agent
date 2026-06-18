import type { FastifyInstance } from 'fastify'
import { ring_, subscribe, audit, type LogLevel } from '../logs/log-bus.js'
import { listAuditLog, auditRowToEntry } from '../db.js'

// Events the browser is allowed to record (the JIRA create/update happens
// browser→n8n, bypassing the server, so the client reports it here). Keep this
// list tight — it's an open intranet endpoint.
const CLIENT_EVT_ALLOW = new Set(['jira.create', 'jira.update'])
const MAX_MSG = 300
const MAX_DETAIL_BYTES = 4096

// Activity-log feed for the Config → Activity page. Read-only, open on the
// intranet (same stance as GET /api/tickets). The live tail is SSE; older
// history is paged from the audit_log table.
export async function logRoutes(app: FastifyInstance) {
  // GET /api/logs/stream — Server-Sent Events. Reuses the SSE shape proven in
  // routes/llm.ts: text/event-stream + X-Accel-Buffering:no so the GWM proxy
  // flushes immediately, and a reply.raw 'close' guard to unsubscribe cleanly.
  app.get('/logs/stream', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    })

    const send = (obj: unknown) => {
      if (reply.raw.writableEnded) return // dead/slow client can't stall the bus
      reply.raw.write(`data: ${JSON.stringify(obj)}\n\n`)
    }

    // Replay recent ring buffer so the page isn't empty on open.
    for (const e of ring_()) send(e)

    const unsubscribe = subscribe(send)
    const heartbeat = setInterval(() => {
      if (reply.raw.writableEnded) return
      reply.raw.write(': ping\n\n') // SSE comment keeps the connection alive
    }, 25_000)

    reply.raw.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })

    // Keep the handler open; we end only when the client disconnects.
    return new Promise<void>(() => { /* never resolves; closed via 'close' */ })
  })

  // POST /api/logs/event — the browser records a client-side action (the JIRA
  // create/update, which never reaches the server otherwise). Allowlisted +
  // size-capped; the server stamps source 'ui' and the real client ip.
  app.post<{ Body: { evt?: string; level?: string; msg?: string; detail?: Record<string, unknown> } }>(
    '/logs/event',
    async (req, reply) => {
      const { evt, level, msg, detail } = req.body ?? {}
      if (!evt || !CLIENT_EVT_ALLOW.has(evt)) {
        reply.code(400).send({ error: 'evt_not_allowed' })
        return
      }
      if (detail && JSON.stringify(detail).length > MAX_DETAIL_BYTES) {
        reply.code(400).send({ error: 'detail_too_large' })
        return
      }
      const lvl: LogLevel = level === 'warn' || level === 'error' ? level : 'info'
      const teamKey = typeof detail?.team_key === 'string' ? detail.team_key : undefined
      audit(req.log, evt, {
        level: lvl,
        source: 'ui',
        ip: req.ip,
        team_key: teamKey,
        msg: (msg ?? evt).slice(0, MAX_MSG),
        detail
      })
      reply.send({ ok: true })
    }
  )

  // GET /api/logs — durable history page (filters + beforeId cursor for "load older").
  app.get<{ Querystring: { limit?: string; beforeId?: string; level?: string; evt?: string; q?: string } }>(
    '/logs',
    async (req) => {
      const { limit, beforeId, level, evt, q } = req.query
      const rows = listAuditLog({
        limit: limit ? Number(limit) : undefined,
        beforeId: beforeId ? Number(beforeId) : undefined,
        level, evt, q
      })
      return rows.map(auditRowToEntry)
    }
  )
}
