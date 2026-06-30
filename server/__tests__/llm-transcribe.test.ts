/**
 * POST /api/llm/transcribe (v10.179, voice dictation).
 *
 * The route re-encodes base64 JSON audio into multipart/form-data and
 * forwards it to the proxy's faster-whisper. We stub global fetch and assert
 * the upstream URL, auth header, and FormData fields.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// Mock the OpenAI client module: transcribe.ts imports the proxy env exports
// from it (and llm.ts, pulled in for the shared guard, imports makeChatModel).
vi.mock('../llm/openai-client.js', () => ({
  LLMPROXY_BASE_URL: 'https://proxy.test/v1',
  LLMPROXY_API_KEY: 'test-key',
  LLMPROXY_INSECURE_TLS: false,
  makeChatModel: vi.fn()
}))

// llm.ts (guard host) also imports the MCP client — stub it out.
vi.mock('../mcp/client.js', () => ({
  getMCPTools: () => []
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// ~133 base64 chars ≈ 100 raw bytes of fake "audio" — over the schema minLength.
const FAKE_AUDIO_B64 = Buffer.from('x'.repeat(2000)).toString('base64')

function upstreamOk(text = '你好，世界') {
  return {
    ok: true,
    status: 200,
    json: async () => ({ text }),
    text: async () => JSON.stringify({ text })
  }
}

async function buildApp(): Promise<FastifyInstance> {
  const { transcribeRoutes } = await import('../routes/transcribe.js')
  const app = Fastify({ logger: false })
  await app.register(transcribeRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

describe('POST /api/llm/transcribe (v10.179)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.resetModules()
    fetchMock.mockReset()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('forwards audio as GWM JSON ({ model, audio_url }) to <base>/audio/translations', async () => {
    fetchMock.mockResolvedValueOnce(upstreamOk('你好，世界'))

    const res = await app.inject({
      method: 'POST',
      url: '/api/llm/transcribe',
      payload: { audio: FAKE_AUDIO_B64, mime: 'audio/webm;codecs=opus' }
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ text: '你好，世界' })

    // Upstream call shape (v10.182): default dialect = GWM's custom JSON —
    // multipart crashes their JSON parse with a bare 500 (probed 2026-06-10).
    // Default path = translations (the only audio path the proxy registers).
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://proxy.test/v1/audio/translations')
    expect(init.headers).toEqual({
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json'
    })
    const sent = JSON.parse(init.body as string)
    expect(sent.model).toBe('default/whisper-large-v3-turbo')
    // Mime parameters (";codecs=opus") are stripped from the data URL.
    expect(sent.audio_url).toBe(`data:audio/webm;base64,${FAKE_AUDIO_B64}`)
    // No language param: whisper auto-detects (bilingual ZH/EN requirement).
    expect(sent.language).toBeUndefined()
  })

  it('honors STT_PATH and STT_MODEL env overrides (module-scope reads)', async () => {
    vi.stubEnv('STT_PATH', 'audio/transcriptions')
    vi.stubEnv('STT_MODEL', 'custom/whisper-x')
    vi.resetModules()
    const overridden = await buildApp()
    try {
      fetchMock.mockResolvedValueOnce(upstreamOk('hello'))
      const res = await overridden.inject({
        method: 'POST',
        url: '/api/llm/transcribe',
        payload: { audio: FAKE_AUDIO_B64, mime: 'audio/webm' }
      })
      expect(res.statusCode).toBe(200)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://proxy.test/v1/audio/transcriptions')
      expect(JSON.parse(init.body as string).model).toBe('custom/whisper-x')
    } finally {
      vi.unstubAllEnvs()
      await overridden.close()
    }
  })

  // v10.181/v10.182: STT endpoint decoupled — STT_BASE_URL/STT_API_KEY/
  // STT_FORMAT override the GWM defaults so a standard OpenAI-compatible
  // server (tools/local-stt, Speaches) can serve STT while chat stays on GWM.
  it('honors STT_BASE_URL + STT_FORMAT=openai-multipart and omits auth when STT_API_KEY is empty', async () => {
    vi.stubEnv('STT_BASE_URL', 'http://127.0.0.1:8100/v1')
    vi.stubEnv('STT_API_KEY', '')
    vi.stubEnv('STT_FORMAT', 'openai-multipart')
    vi.resetModules()
    const local = await buildApp()
    try {
      fetchMock.mockResolvedValueOnce(upstreamOk('本地转写'))
      const res = await local.inject({
        method: 'POST',
        url: '/api/llm/transcribe',
        payload: { audio: FAKE_AUDIO_B64, mime: 'audio/webm;codecs=opus' }
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ text: '本地转写' })
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('http://127.0.0.1:8100/v1/audio/translations')
      // Auth-less local server: no Authorization header at all.
      expect(init.headers).toEqual({})
      // Standard OpenAI dialect: multipart with file/model/response_format.
      const form = init.body as FormData
      expect(form).toBeInstanceOf(FormData)
      const file = form.get('file') as Blob
      expect(file).toBeInstanceOf(Blob)
      expect(file.type).toBe('audio/webm;codecs=opus')
      expect(form.get('model')).toBe('default/whisper-large-v3-turbo')
      expect(form.get('response_format')).toBe('json')
    } finally {
      vi.unstubAllEnvs()
      await local.close()
    }
  })

  it('requires X-Internal-Token when INTERNAL_API_TOKEN is configured', async () => {
    vi.stubEnv('INTERNAL_API_TOKEN', 'sekret')
    vi.resetModules()
    const guarded = await buildApp()
    try {
      const missing = await guarded.inject({
        method: 'POST',
        url: '/api/llm/transcribe',
        payload: { audio: FAKE_AUDIO_B64, mime: 'audio/webm' }
      })
      expect(missing.statusCode).toBe(401)

      fetchMock.mockResolvedValueOnce(upstreamOk('ok'))
      const withToken = await guarded.inject({
        method: 'POST',
        url: '/api/llm/transcribe',
        headers: { 'x-internal-token': 'sekret' },
        payload: { audio: FAKE_AUDIO_B64, mime: 'audio/webm' }
      })
      expect(withToken.statusCode).toBe(200)
    } finally {
      vi.unstubAllEnvs()
      await guarded.close()
    }
  })

  it('rejects a body missing required fields with HTTP 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/llm/transcribe',
      payload: { mime: 'audio/webm' }
    })
    expect(res.statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects audio shorter than the schema minimum with HTTP 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/llm/transcribe',
      payload: { audio: 'dG9vc2hvcnQ=', mime: 'audio/webm' }
    })
    expect(res.statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps an upstream non-OK response to HTTP 502', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'whisper exploded',
      json: async () => ({})
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/llm/transcribe',
      payload: { audio: FAKE_AUDIO_B64, mime: 'audio/webm' }
    })
    expect(res.statusCode).toBe(502)
    expect(res.json()).toEqual({ error: 'upstream', message: 'STT upstream HTTP 500' })
  })

  it('maps a fetch rejection to HTTP 502 and surfaces the cause code', async () => {
    const e = new Error('fetch failed')
    ;(e as { cause?: unknown }).cause = { code: 'ECONNRESET', message: 'socket hang up' }
    fetchMock.mockRejectedValueOnce(e)
    const res = await app.inject({
      method: 'POST',
      url: '/api/llm/transcribe',
      payload: { audio: FAKE_AUDIO_B64, mime: 'audio/webm' }
    })
    expect(res.statusCode).toBe(502)
    expect(res.json().message).toBe('fetch failed (ECONNRESET)')
  })

  it('returns empty text when the upstream omits the text field', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ something: 'else' }),
      text: async () => '{}'
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/llm/transcribe',
      payload: { audio: FAKE_AUDIO_B64, mime: 'audio/webm' }
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ text: '' })
  })
})
