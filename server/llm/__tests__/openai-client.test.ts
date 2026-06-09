import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// makeChatModel reads process.env at module-load time, so each test re-imports
// the module after mutating env. This lets us assert that env changes flow
// through into the constructed ChatOpenAI client.
async function loadFreshModule() {
  vi.resetModules()
  return await import('../openai-client')
}

describe('makeChatModel — server LLM factory (v10.131)', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    process.env.LLMPROXY_BASE_URL = 'https://example.test/v1'
    process.env.LLMPROXY_API_KEY = 'test-key-abc'
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('reads LLMPROXY_BASE_URL and LLMPROXY_API_KEY from env at module load', async () => {
    const mod = await loadFreshModule()
    expect(mod.LLMPROXY_BASE_URL).toBe('https://example.test/v1')
    expect(mod.LLMPROXY_API_KEY).toBe('test-key-abc')
  })

  it('falls back to the GWM default base URL when LLMPROXY_BASE_URL is unset', async () => {
    delete process.env.LLMPROXY_BASE_URL
    const mod = await loadFreshModule()
    expect(mod.LLMPROXY_BASE_URL).toBe('https://llmproxy.gwm.cn/v1')
  })

  it('builds a ChatOpenAI configured with the per-call model + the env baseURL', async () => {
    const mod = await loadFreshModule()
    const model = mod.makeChatModel('deepseek-v3-2')
    // ChatOpenAI exposes the model on .model and the baseURL via its client
    // config. Touching internals is brittle, so we just confirm the public
    // .model field; the baseURL is exercised end-to-end by the route test.
    expect(model.model).toBe('deepseek-v3-2')
  })

  it('exports an empty string for LLMPROXY_API_KEY when the env var is unset', async () => {
    delete process.env.LLMPROXY_API_KEY
    const mod = await loadFreshModule()
    expect(mod.LLMPROXY_API_KEY).toBe('')
  })

  it('disables TLS verification when LLMPROXY_INSECURE_TLS is set (dev escape hatch)', async () => {
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
    process.env.LLMPROXY_INSECURE_TLS = 'true'
    const mod = await loadFreshModule()
    expect(mod.LLMPROXY_INSECURE_TLS).toBe(true)
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe('0')
  })

  it('leaves TLS verification untouched when LLMPROXY_INSECURE_TLS is absent', async () => {
    delete process.env.LLMPROXY_INSECURE_TLS
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
    const mod = await loadFreshModule()
    expect(mod.LLMPROXY_INSECURE_TLS).toBe(false)
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined()
  })
})
