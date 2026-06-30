/**
 * POST /api/llm/transcribe — voice dictation STT endpoint (v10.179).
 *
 * The Explore composer records mic audio (MediaRecorder, webm/opus) and POSTs
 * it here as base64 JSON — no new multipart dependency, mirrors the existing
 * base64-image-in-JSON convention, and a 60 s opus clip is well under the
 * LLM_BODY_LIMIT_MB cap.
 *
 * GWM wire format (cracked 2026-06-10, v10.182): the proxy's STT route is NOT
 * OpenAI-compatible. It registers ONLY `audio/translations` (transcriptions →
 * FastAPI 404) and expects a JSON body `{ model, audio_url: "data:<mime>;
 * base64,<b64>" }` — multipart uploads crash its JSON parse with a bare 500,
 * which masqueraded as a broken upstream in v10.180. Despite the path name it
 * does NOT translate: Chinese audio → simplified Chinese text (verified).
 * Response: `{ object, model, text, items }` — we read `text`.
 *
 * STT_FORMAT selects the upstream dialect: `gwm-json` (default, matches the
 * default GWM STT_BASE_URL) or `openai-multipart` (standard servers: the
 * tools/local-stt verification server, Speaches, real OpenAI).
 *
 * Auth: same optional `X-Internal-Token` guard as /api/llm/chat.
 */
import type { FastifyInstance } from 'fastify'
import { requireInternalTokenIfConfigured } from './llm.js'
// Importing openai-client also applies the LLMPROXY_INSECURE_TLS side effect
// (NODE_TLS_REJECT_UNAUTHORIZED=0), so this route honors the dev flag the same
// way /api/llm/chat does.
import { LLMPROXY_BASE_URL, LLMPROXY_API_KEY } from '../llm/openai-client.js'

const STT_PATH = process.env.STT_PATH || 'audio/translations'
const STT_MODEL = process.env.STT_MODEL || 'default/whisper-large-v3-turbo'
// v10.181: STT endpoint decoupled from the chat proxy. Defaults keep GWM
// llmproxy, but STT_BASE_URL can point anywhere OpenAI-compatible — e.g. the
// local faster-whisper verification server (tools/local-stt) while GWM's
// upstream is broken, or a future prod sidecar. STT_API_KEY= (empty) sends
// no Authorization header for auth-less local servers.
const STT_BASE_URL = process.env.STT_BASE_URL || LLMPROXY_BASE_URL
const STT_API_KEY = process.env.STT_API_KEY ?? LLMPROXY_API_KEY
// 'gwm-json' = GWM's custom { model, audio_url } JSON body (default — matches
// the default STT_BASE_URL); 'openai-multipart' = standard OpenAI audio API.
const STT_FORMAT = process.env.STT_FORMAT === 'openai-multipart' ? 'openai-multipart' : 'gwm-json'
const UPSTREAM_TIMEOUT_MS = 60_000

interface TranscribeBody { audio: string; mime: string }

const REQUEST_BODY_SCHEMA = {
  type: 'object',
  required: ['audio', 'mime'],
  additionalProperties: false,
  properties: {
    // base64 chars; 7M chars ≈ 5.25 MB raw audio, safely under the 8 MB body cap.
    audio: { type: 'string', minLength: 100, maxLength: 7_000_000 },
    mime: { type: 'string', maxLength: 100 }
  }
} as const

/** A sane filename extension helps the upstream sniff the container format. */
function pickFilename(mime: string): string {
  if (mime.includes('ogg')) return 'audio.ogg'
  if (mime.includes('mp4')) return 'audio.mp4'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'audio.mp3'
  if (mime.includes('wav')) return 'audio.wav'
  return 'audio.webm'
}

export async function transcribeRoutes(app: FastifyInstance) {
  app.post<{ Body: TranscribeBody }>('/llm/transcribe', {
    schema: { body: REQUEST_BODY_SCHEMA },
    onRequest: requireInternalTokenIfConfigured
  }, async (req, reply) => {
    const { audio, mime } = req.body
    const started = Date.now()

    const buf = Buffer.from(audio, 'base64')
    if (buf.length === 0) {
      reply.code(400).send({ error: 'validation', details: ['audio is not valid base64'] })
      return
    }

    // Build the upstream request in the dialect STT_FORMAT selects. Both
    // dialects answer with a JSON object carrying `text`, so parsing below
    // is shared. No `language` param either way: whisper auto-detects and
    // GWM's mount preserves the spoken language (verified: ZH in → ZH out).
    const headers: Record<string, string> = STT_API_KEY
      ? { Authorization: `Bearer ${STT_API_KEY}` }
      : {}
    let body: BodyInit
    if (STT_FORMAT === 'openai-multipart') {
      // Standard OpenAI audio API: multipart upload. Native FormData/Blob
      // (Node ≥ 18) set the boundary header — never set Content-Type manually.
      const form = new FormData()
      form.append('file', new Blob([buf], { type: mime }), pickFilename(mime))
      form.append('model', STT_MODEL)
      form.append('response_format', 'json')
      body = form
    } else {
      // GWM dialect: JSON with a base64 data URL. The SPA already sent
      // base64, so pass it through untouched. Strip mime parameters
      // (";codecs=opus") — a second semicolon confuses data-URL parsers.
      const cleanMime = (mime.split(';')[0] || '').trim() || 'audio/webm'
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify({
        model: STT_MODEL,
        audio_url: `data:${cleanMime};base64,${audio}`
      })
    }

    const url = `${STT_BASE_URL.replace(/\/+$/, '')}/${STT_PATH}`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
      })

      if (!res.ok) {
        const snippet = (await res.text().catch(() => '')).slice(0, 300)
        req.log.error({ status: res.status, snippet, url }, 'llm/transcribe upstream error')
        reply.code(502).send({ error: 'upstream', message: `STT upstream HTTP ${res.status}` })
        return
      }

      const json = await res.json() as { text?: unknown }
      const text = typeof json.text === 'string' ? json.text : ''
      req.log.info(
        { bytes: buf.length, mime, format: STT_FORMAT, ms: Date.now() - started, textLen: text.length },
        'llm/transcribe'
      )
      reply.send({ text })
    } catch (err) {
      // undici wraps the real reason in err.cause (TLS code, ECONNRESET, …) —
      // same diagnostics pattern as llm.ts.
      const cause = (err as { cause?: { code?: string; message?: string } }).cause
      req.log.error({ err, causeCode: cause?.code, causeMsg: cause?.message, url }, 'llm/transcribe upstream error')
      const detail = `${(err as Error).message}${cause?.code ? ` (${cause.code})` : ''}`
      reply.code(502).send({ error: 'upstream', message: detail })
    }
  })
}
