import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

// vi.mock factories are hoisted ABOVE top-level const declarations, so we
// can't reference plain `const`s from inside them — vi.hoisted gives us
// shared mock state that the factory can read at hoist time. We use a real
// class for the constructor (vi.fn() called with `new` doesn't reliably
// return the mockImplementation's value) but record constructor calls on a
// spy so tests can still assert on what config was passed.
const mocks = vi.hoisted(() => ({
  getToolsMock: vi.fn(),
  ctorSpy: vi.fn()
}))

vi.mock('@langchain/mcp-adapters', () => {
  return {
    MultiServerMCPClient: class MockMultiServerMCPClient {
      constructor(config: unknown) {
        mocks.ctorSpy(config)
      }
      getTools() {
        return mocks.getToolsMock()
      }
    }
  }
})

// Test-scoped logger sink so we can assert on warn/info calls without
// polluting test output.
function makeFakeLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = resolve(tmpdir(), `smart-agent-mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(dir, { recursive: true })
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('server/mcp/client (v10.133, Phase L2)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset the module-level cache between tests
    const mod = await import('../client')
    mod._resetMCPForTests()
  })

  afterEach(() => {
    delete process.env.LLMPROXY_API_KEY
  })

  it('disables MCP cleanly when the config file is missing', async () => {
    const log = makeFakeLog()
    const { initMCP, getMCPTools } = await import('../client')
    await initMCP({ configPath: resolve(tmpdir(), 'definitely-not-here.json'), log })
    expect(getMCPTools()).toEqual([])
    expect(log.warn).toHaveBeenCalledWith(expect.objectContaining({ configPath: expect.any(String) }), expect.stringContaining('not found'))
    expect(mocks.ctorSpy).not.toHaveBeenCalled()
  })

  it('disables MCP cleanly on malformed JSON', async () => {
    await withTempDir(async (dir) => {
      const configPath = resolve(dir, 'mcp-servers.json')
      await writeFile(configPath, '{ this is not valid json', 'utf8')
      const log = makeFakeLog()
      const { initMCP, getMCPTools } = await import('../client')
      await initMCP({ configPath, log })
      expect(getMCPTools()).toEqual([])
      expect(log.warn).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining('malformed'))
    })
  })

  it('substitutes ${LLMPROXY_API_KEY} inside string values before passing to MultiServerMCPClient', async () => {
    await withTempDir(async (dir) => {
      const configPath = resolve(dir, 'mcp-servers.json')
      await writeFile(configPath, JSON.stringify({
        mcpServers: {
          '4e732ced': {
            transport: 'sse',
            url: 'https://llmproxy.gwm.cn/mcp/4e732ced/sse?api_key=${LLMPROXY_API_KEY}'
          }
        }
      }), 'utf8')

      process.env.LLMPROXY_API_KEY = 'test-key-abc123'
      mocks.getToolsMock.mockResolvedValueOnce([])

      const { initMCP } = await import('../client')
      await initMCP({ configPath, log: makeFakeLog() })

      expect(mocks.ctorSpy).toHaveBeenCalledTimes(1)
      const passed = mocks.ctorSpy.mock.calls[0][0] as Record<string, { url: string }>
      expect(passed['4e732ced'].url).toBe('https://llmproxy.gwm.cn/mcp/4e732ced/sse?api_key=test-key-abc123')
    })
  })

  it('disables MCP cleanly when getTools() rejects (e.g. server unreachable)', async () => {
    await withTempDir(async (dir) => {
      const configPath = resolve(dir, 'mcp-servers.json')
      await writeFile(configPath, JSON.stringify({
        mcpServers: { srv: { transport: 'sse', url: 'https://unreachable.invalid/mcp' } }
      }), 'utf8')

      mocks.getToolsMock.mockRejectedValueOnce(new Error('network'))

      const log = makeFakeLog()
      const { initMCP, getMCPTools } = await import('../client')
      await initMCP({ configPath, log })

      expect(getMCPTools()).toEqual([])
      expect(log.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        expect.stringContaining('failed to connect')
      )
    })
  })

  it('caches the tool list when getTools() resolves', async () => {
    await withTempDir(async (dir) => {
      const configPath = resolve(dir, 'mcp-servers.json')
      await writeFile(configPath, JSON.stringify({
        mcpServers: { srv: { transport: 'sse', url: 'https://example.invalid/mcp' } }
      }), 'utf8')

      const fakeTools = [{ name: 'get_weather', description: 'stub', invoke: vi.fn() }]
      mocks.getToolsMock.mockResolvedValueOnce(fakeTools)

      const log = makeFakeLog()
      const { initMCP, getMCPTools } = await import('../client')
      await initMCP({ configPath, log })

      expect(getMCPTools()).toBe(fakeTools)
      expect(log.info).toHaveBeenCalledWith(
        expect.objectContaining({ tools: 1, servers: 1 }),
        expect.stringContaining('loaded 1 tools from 1 servers')
      )
    })
  })

  it('disables MCP cleanly when mcpServers is empty or missing', async () => {
    await withTempDir(async (dir) => {
      const configPath = resolve(dir, 'mcp-servers.json')
      await writeFile(configPath, JSON.stringify({ mcpServers: {} }), 'utf8')
      const log = makeFakeLog()
      const { initMCP, getMCPTools } = await import('../client')
      await initMCP({ configPath, log })
      expect(getMCPTools()).toEqual([])
      expect(log.warn).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('no `mcpServers` entries')
      )
      expect(mocks.ctorSpy).not.toHaveBeenCalled()
    })
  })

  it('disables MCP cleanly when getTools() hangs past MCP_INIT_TIMEOUT_MS', async () => {
    // L2.1 hotfix regression guard. If this test ever stops timing out,
    // initMCP has lost its boot-hang protection and Fastify is at risk of
    // never reaching app.listen() when the MCP server is unresponsive.
    await withTempDir(async (dir) => {
      const configPath = resolve(dir, 'mcp-servers.json')
      await writeFile(configPath, JSON.stringify({
        mcpServers: { srv: { transport: 'sse', url: 'https://hangs-forever.invalid/mcp' } }
      }), 'utf8')

      // getTools() never resolves — simulates an MCP server that accepts
      // the SSE handshake but never returns the tool list.
      mocks.getToolsMock.mockReturnValueOnce(new Promise(() => { /* never */ }))

      // Force a tiny timeout so the test runs fast. Real prod default is 5000.
      process.env.MCP_INIT_TIMEOUT_MS = '20'

      const log = makeFakeLog()
      const { initMCP, getMCPTools } = await import('../client')
      await initMCP({ configPath, log })

      expect(getMCPTools()).toEqual([])
      expect(log.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.objectContaining({ message: expect.stringContaining('timed out after 20ms') }) }),
        expect.stringContaining('failed to connect or timed out')
      )
      delete process.env.MCP_INIT_TIMEOUT_MS
    })
  })
})
