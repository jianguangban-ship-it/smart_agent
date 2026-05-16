import type { FastifyInstance } from 'fastify'
import { upsertTicket, listTickets, rowToTicket } from '../db.js'
import { requireApiKey } from '../auth.js'
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
