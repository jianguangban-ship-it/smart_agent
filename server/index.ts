import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { ticketRoutes, auditTicketResponse } from './routes/tickets.js'
import { llmRoutes } from './routes/llm.js'
import { transcribeRoutes } from './routes/transcribe.js'
import { configRoutes } from './routes/config.js'
import { logRoutes } from './routes/logs.js'
import { initMCP, getMCPTools } from './mcp/client.js'
import { db } from './db.js'
import { logTap, audit } from './logs/log-bus.js'
import type { TicketBody } from './schemas.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.PORT ?? 8080)
const HOST = process.env.HOST ?? '0.0.0.0'

// Body cap. Default 8 MB (not 1 MB) so multi-modal Explore turns — base64 image
// data URLs (~1.33× of up to 4 MB) plus history — aren't 413'd before the
// handler. Tunable via LLM_BODY_LIMIT_MB.
const BODY_LIMIT_MB = Number(process.env.LLM_BODY_LIMIT_MB ?? 8)
const app = Fastify({
  // logTap forwards every line to stdout unchanged AND taps warn/error into the
  // activity bus (server/logs/log-bus.ts). trustProxy makes req.ip the real
  // client behind the GWM reverse proxy (so audit events record the right IP).
  logger: { level: process.env.LOG_LEVEL ?? 'info', stream: logTap },
  trustProxy: true,
  bodyLimit: BODY_LIMIT_MB * 1024 * 1024
})

// Trip the DB schema migration on boot so first request is fast.
db()

app.register(ticketRoutes, { prefix: '/api' })
app.register(llmRoutes, { prefix: '/api' })
app.register(transcribeRoutes, { prefix: '/api' })
app.register(configRoutes, { prefix: '/api' })
app.register(logRoutes, { prefix: '/api' })

// In production the same container serves the SPA build. In dev, Vite owns the
// UI and proxies /api here — so this block is a no-op when dist/ is absent.
const SPA_ROOT = resolve(__dirname, '..', 'dist')
if (existsSync(SPA_ROOT)) {
  app.register(fastifyStatic, {
    root: SPA_ROOT,
    prefix: '/',
    wildcard: false
  })
  // SPA fallback: any non-/api path that didn't match a file returns index.html.
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api')) {
      reply.code(404).send({ error: 'not_found' })
      return
    }
    reply.sendFile('index.html')
  })
}

// Spec §2.5 — convert ajv validation failures into the documented error shape.
// Stash the details on the request so the onResponse logger can surface them
// in the same one-line summary it logs for every POST.
app.setErrorHandler((err, req, reply) => {
  if (err.validation) {
    const details = err.validation.map(v =>
      `${v.instancePath || '(root)'} ${v.message ?? ''}`.trim()
    )
    ;(req as { qualityValidationDetails?: string[] }).qualityValidationDetails = details
    reply.code(400).send({ error: 'validation', details })
    return
  }
  if (err.statusCode === 413) {
    reply.code(413).send({ error: 'too_large' })
    return
  }
  app.log.error(err)
  reply.code(500).send({ error: 'internal' })
})

// Spec §7 + Activity log — for POST /api/tickets, emit the JIRA audit event.
// This is the user's "create task" action as reported by n8n's callback: it
// carries the real issue key on success, so the feed records it without any
// client code. OK = a real key was accepted (201/200); NOK = n8n produced no
// real ticket id (400 — the `未知KEY` sentinel / pattern reject), logged at warn.
// We do this in onResponse because only here do we have BOTH the body and the
// final status code. 401 (bad API key) is logged separately as auth.fail.
app.addHook('onResponse', (req, reply, done) => {
  if (req.method === 'POST' && req.url?.startsWith('/api/tickets')) {
    auditTicketResponse(app.log, reply.statusCode, req.body as Partial<TicketBody> | undefined, req.ip)
  }
  done()
})

// MCP boot — load tool servers configured in deploy/mcp-servers.json (or
// MCP_CONFIG_PATH). Never rejects: failures degrade to no-tools, and Explore
// mode falls back to plain chat. See server/mcp/client.ts.
await initMCP({ log: app.log })
{
  const n = getMCPTools().length
  audit(app.log, n > 0 ? 'mcp.ready' : 'mcp.disabled', {
    source: 'system',
    msg: n > 0 ? `mcp.ready · ${n} tool${n === 1 ? '' : 's'}` : 'mcp.disabled · no tools',
    detail: { tools: n }
  })
}

app.listen({ port: PORT, host: HOST })
  .then(() => audit(app.log, 'server.start', { source: 'system', msg: `listening on http://${HOST}:${PORT}`, detail: { port: PORT } }))
  .catch(err => {
    app.log.error(err)
    process.exit(1)
  })
