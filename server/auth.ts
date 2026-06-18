import type { FastifyRequest, FastifyReply } from 'fastify'
import { audit } from './logs/log-bus.js'

// Spec §2.2 — n8n attaches X-API-Key. Missing/wrong → 401.
// Key is read once at module load; set QUALITY_API_KEY in the environment.
const EXPECTED_KEY = process.env.QUALITY_API_KEY ?? ''

if (!EXPECTED_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[quality-grid] QUALITY_API_KEY is not set — all writes will be rejected')
}

export async function requireApiKey(req: FastifyRequest, reply: FastifyReply) {
  const provided = req.headers['x-api-key']
  if (!EXPECTED_KEY || provided !== EXPECTED_KEY) {
    audit(req.log, 'auth.fail', {
      level: 'warn', source: 'n8n', ip: req.ip,
      msg: `auth.fail ${req.method} ${req.url} · bad/missing X-API-Key`,
      detail: { route: req.url, reason: provided ? 'wrong_key' : 'missing_key' }
    })
    reply.code(401).send({ error: 'auth' })
  }
}
