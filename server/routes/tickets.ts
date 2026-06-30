import type { FastifyInstance, FastifyBaseLogger } from 'fastify'
import { upsertTicket, listTickets, rowToTicket } from '../db.js'
import { requireApiKey } from '../auth.js'
import { audit } from '../logs/log-bus.js'

// Emit the `ticket.write` audit event for a POST /api/tickets response — this is
// n8n's quality-grid write (the AI verdict for a ticket), NOT the user's create
// action (that's the client-side `jira.create` ping). Called from the onResponse
// hook in index.ts (which has both the body and the final status code):
//   201/200 → OK  (a real issueKey was accepted into the grid)
//   400     → NOK (the `未知KEY` sentinel / pattern reject — no real ticket id),
//                  logged at warn so it stands out.
export function auditTicketResponse(
  log: FastifyBaseLogger,
  code: number,
  body: Partial<TicketBody> | undefined,
  ip?: string
): void {
  if (code !== 201 && code !== 200 && code !== 400) return
  const action = body?.action === 'update' ? 'update' : 'create'
  const ok = code === 201 || code === 200
  const issueKey = body?.issueKey ?? '—'
  const points = typeof body?.points === 'number' ? body.points : undefined
  audit(log, 'ticket.write', {
    level: ok ? 'info' : 'warn',
    source: 'n8n',
    ip,
    team_key: body?.team_key,
    msg: `ticket.write ${issueKey} · ${body?.team_key ?? '?'}${body?.status ? ` · ${body.status}` : ''} · ${ok ? 'OK' : 'NOK'}`,
    detail: {
      outcome: ok ? 'OK' : 'NOK',
      issueKey,
      project: body?.project,
      team_key: body?.team_key,
      points,
      assignee: body?.displayName ?? body?.assignee,  // who the ticket is for
      action,
      actionTime: body?.timestamp,  // n8n ISO time
      verdict: body?.status         // AI quality grade (A/B/C/D/…)
    }
  })
}
import {
  TICKET_BODY_SCHEMA,
  TICKET_RESPONSE_201,
  TICKET_RESPONSE_200,
  type TicketBody
} from '../schemas.js'

export async function ticketRoutes(app: FastifyInstance) {
  // POST /api/tickets — n8n writes here. Spec §2 + §3.
  // onRequest (not preHandler) so a missing X-API-Key returns 401 *before*
  // schema validation could turn it into a 400.
  app.post<{ Body: TicketBody }>('/tickets', {
    onRequest: requireApiKey,
    schema: {
      body: TICKET_BODY_SCHEMA,
      response: {
        200: TICKET_RESPONSE_200,
        201: TICKET_RESPONSE_201
      }
    }
  }, async (req, reply) => {
    // The JIRA audit event is emitted from the onResponse hook in index.ts so
    // that the OK (201/200) and NOK (400 — sentinel key, no real ticket id)
    // cases are handled uniformly with access to the status code.
    const result = upsertTicket(req.body)
    reply
      .code(result === 'created' ? 201 : 200)
      .send({ issueKey: req.body.issueKey, result })
  })

  // GET /api/tickets — feeds the View mode grid. Spec §8 future-ext.
  // Public read; intranet auth is at the deploy layer.
  app.get<{ Querystring: { team_key?: string; status?: string; from?: string; to?: string } }>('/tickets', async (req) => {
    const rows = listTickets(req.query)
    return rows.map(rowToTicket)
  })

}
