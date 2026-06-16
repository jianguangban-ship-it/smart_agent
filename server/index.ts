import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { ticketRoutes } from './routes/tickets.js'
import { llmRoutes } from './routes/llm.js'
import { transcribeRoutes } from './routes/transcribe.js'
import { initMCP } from './mcp/client.js'
import { db } from './db.js'
import type { TicketBody } from './schemas.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.PORT ?? 8080)
const HOST = process.env.HOST ?? '0.0.0.0'

// Body cap. Default 8 MB (not 1 MB) so multi-modal Explore turns — base64 image
// data URLs (~1.33× of up to 4 MB) plus history — aren't 413'd before the
// handler. Tunable via LLM_BODY_LIMIT_MB.
const BODY_LIMIT_MB = Number(process.env.LLM_BODY_LIMIT_MB ?? 8)
const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  bodyLimit: BODY_LIMIT_MB * 1024 * 1024
})

// Trip the DB schema migration on boot so first request is fast.
db()

app.register(ticketRoutes, { prefix: '/api' })
app.register(llmRoutes, { prefix: '/api' })
app.register(transcribeRoutes, { prefix: '/api' })

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

// Spec §7 — per-request summary log for POST /api/tickets so operators can
// see at a glance: which ticket was posted, what verdict, which team, what
// code we returned, and (when validation failed) what the schema rejected.
// agentCheck is intentionally NOT logged — too noisy.
app.addHook('onResponse', (req, reply, done) => {
  if (req.method === 'POST' && req.url?.startsWith('/api/tickets')) {
    const body = req.body as Partial<TicketBody> | undefined
    const details = (req as { qualityValidationDetails?: string[] })
      .qualityValidationDetails
    app.log.info({
      issueKey:   body?.issueKey,
      status:     body?.status,
      team_key:   body?.team_key,
      code:       reply.statusCode,
      latency_ms: Math.round(reply.elapsedTime),
      ...(details ? { validation: details } : {})
    }, 'POST /api/tickets')
  }
  done()
})

// MCP boot — load tool servers configured in deploy/mcp-servers.json (or
// MCP_CONFIG_PATH). Never rejects: failures degrade to no-tools, and Explore
// mode falls back to plain chat. See server/mcp/client.ts.
await initMCP({ log: app.log })

app.listen({ port: PORT, host: HOST })
  .then(() => app.log.info(`quality-grid listening on http://${HOST}:${PORT}`))
  .catch(err => {
    app.log.error(err)
    process.exit(1)
  })
