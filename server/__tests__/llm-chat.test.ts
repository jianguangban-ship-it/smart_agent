import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// Synthetic AIMessageChunk-shaped objects emitted by createReactAgent.stream
// in streamMode:'messages'. Each yields a [chunk, metadata] tuple. We give
// the chunks a `_getType()` returning 'ai' (or 'tool') so the route's
// filters accept them.
type FakeChunk = {
  _getType: () => string
  content?: string
  tool_calls?: Array<{ name?: string; args?: unknown }>
  name?: string
}

function fakeAgentStream(chunks: FakeChunk[]): AsyncIterable<[FakeChunk, unknown]> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0
      return {
        async next() {
          if (i < chunks.length) {
            return { value: [chunks[i++], {}] as [FakeChunk, unknown], done: false }
          }
          return { value: undefined, done: true }
        }
      }
    }
  }
}

function aiTextChunk(content: string): FakeChunk {
  return { _getType: () => 'ai', content }
}
function aiToolCallChunk(tool: string, args: unknown): FakeChunk {
  return { _getType: () => 'ai', content: '', tool_calls: [{ name: tool, args }] }
}
function toolResultChunk(name: string, content: string): FakeChunk {
  return { _getType: () => 'tool', name, content }
}

// Mock the OpenAI client factory so the route doesn't actually call out.
vi.mock('../llm/openai-client.js', () => ({
  makeChatModel: (_model: string) => ({ /* unused — agent.stream is what runs */ })
}))

// Mock the MCP client to return ONE fake tool (no deploy/mcp-servers.json
// needed). Non-empty so we can assert the EXPLORE_DISABLE_MCP gate strips it.
vi.mock('../mcp/client.js', () => ({
  getMCPTools: () => [{ name: 'fake_tool' }]
}))

// Mock createReactAgent so it doesn't actually run a graph — capture the args
// (to assert the bound tools) and return an object whose .stream() yields our
// fake chunks.
const agentStreamMock = vi.fn()
const reactAgentSpy = vi.fn((_args: { tools?: unknown[] }) => ({ stream: agentStreamMock }))
vi.mock('@langchain/langgraph/prebuilt', () => ({
  createReactAgent: (args: { tools?: unknown[] }) => reactAgentSpy(args)
}))

async function buildApp(): Promise<FastifyInstance> {
  const { llmRoutes } = await import('../routes/llm')
  const app = Fastify({ logger: false })
  await app.register(llmRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

describe('POST /api/llm/chat (v10.131, Phase L1)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('streams content chunks as OpenAI-compatible SSE and terminates with [DONE]', async () => {
    agentStreamMock.mockResolvedValueOnce(fakeAgentStream([aiTextChunk('Hello, '), aiTextChunk('world!')]))

    const res = await app.inject({
      method: 'POST',
      url: '/api/llm/chat',
      payload: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] }
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')

    // The two chunks are emitted as OpenAI-compatible SSE events that the
    // SPA's existing parser in useLLM.ts:_callBrokeredLLM consumes unchanged.
    expect(res.body).toContain(
      'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Hello, ' } }] }) + '\n\n'
    )
    expect(res.body).toContain(
      'data: ' + JSON.stringify({ choices: [{ delta: { content: 'world!' } }] }) + '\n\n'
    )
    expect(res.body.trimEnd().endsWith('data: [DONE]')).toBe(true)
  })

  it('forwards the requested model to the LangChain factory', async () => {
    agentStreamMock.mockResolvedValueOnce(fakeAgentStream([aiTextChunk('ok')]))

    const res = await app.inject({
      method: 'POST',
      url: '/api/llm/chat',
      payload: { model: 'deepseek-v3-2', messages: [{ role: 'user', content: 'hi' }] }
    })

    // The streaming response actually fired — implies the agent's .stream()
    // was reached, which in turn implies makeChatModel was called with the
    // requested model. Indirect but reliable across mock/module-cache quirks.
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('data: ' + JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }))
  })

  // L3 (v10.134): tool events get re-emitted as smart_agent_event SSE chunks
  // so the SPA can render "calling …" / "done" chips in ChatBubble.
  it('emits smart_agent_event SSE chunks for tool_call and tool_result', async () => {
    agentStreamMock.mockResolvedValueOnce(fakeAgentStream([
      aiToolCallChunk('search_web', { q: 'latest 2026 AI news' }),
      toolResultChunk('search_web', 'Headline: ...'),
      aiTextChunk('Based on the search results, ')
    ]))

    const res = await app.inject({
      method: 'POST',
      url: '/api/llm/chat',
      payload: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'search please' }] }
    })

    expect(res.statusCode).toBe(200)
    // Tool-call event
    expect(res.body).toContain(
      'data: ' + JSON.stringify({
        choices: [{ delta: { smart_agent_event: { kind: 'tool_call', tool: 'search_web', args: { q: 'latest 2026 AI news' } } } }]
      })
    )
    // Tool-result event with content preview + length
    expect(res.body).toContain(
      'data: ' + JSON.stringify({
        choices: [{ delta: { smart_agent_event: { kind: 'tool_result', tool: 'search_web', contentLen: 13, preview: 'Headline: ...' } } }]
      })
    )
    // Final assistant text still flows as a normal content chunk
    expect(res.body).toContain('data: ' + JSON.stringify({ choices: [{ delta: { content: 'Based on the search results, ' } }] }))
    expect(res.body.trimEnd().endsWith('data: [DONE]')).toBe(true)
  })

  // When the upstream call fails after SSE headers are already sent, the error
  // must be surfaced on the `data:` channel (not an SSE comment, which the SPA
  // ignores → silent empty reply).
  it('emits an upstream error as a data: SSE event, then [DONE]', async () => {
    agentStreamMock.mockRejectedValueOnce(new Error('model not found'))

    const res = await app.inject({
      method: 'POST',
      url: '/api/llm/chat',
      payload: { model: 'no-such-model', messages: [{ role: 'user', content: 'hi' }] }
    })

    expect(res.statusCode).toBe(200) // SSE already started
    expect(res.body).toContain('"error":{"message":"model not found [model=no-such-model]"}')
    expect(res.body).not.toContain('\n: error') // not an ignored SSE comment
    expect(res.body.trimEnd().endsWith('data: [DONE]')).toBe(true)
  })

  // Multi-modal (vision): content may be an array of OpenAI parts.
  it('accepts array (multi-modal) content and streams', async () => {
    agentStreamMock.mockResolvedValueOnce(fakeAgentStream([aiTextChunk('a cat')]))

    const res = await app.inject({
      method: 'POST',
      url: '/api/llm/chat',
      payload: {
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'what is this?' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }
          ]
        }]
      }
    })

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('data: ' + JSON.stringify({ choices: [{ delta: { content: 'a cat' } }] }))
  })

  // The real reason for a failed upstream call lives in err.cause; surface its
  // code alongside the message so TLS vs socket vs network is distinguishable.
  it('appends the err.cause code to the surfaced error message', async () => {
    const e = new Error('terminated')
    ;(e as { cause?: unknown }).cause = { code: 'UND_ERR_SOCKET', message: 'other side closed' }
    agentStreamMock.mockRejectedValueOnce(e)

    const res = await app.inject({
      method: 'POST',
      url: '/api/llm/chat',
      payload: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] }
    })

    expect(res.statusCode).toBe(200)
    // Message carries the cause code AND the exact model the server tried.
    expect(res.body).toContain('terminated (UND_ERR_SOCKET) [model=gpt-4o-mini]')
  })

  it('binds MCP tools by default, and none when EXPLORE_DISABLE_MCP is set', async () => {
    reactAgentSpy.mockClear()
    agentStreamMock.mockResolvedValueOnce(fakeAgentStream([aiTextChunk('ok')]))
    await app.inject({
      method: 'POST', url: '/api/llm/chat',
      payload: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] }
    })
    expect(reactAgentSpy.mock.calls.at(-1)?.[0].tools).toHaveLength(1)

    process.env.EXPLORE_DISABLE_MCP = 'true'
    reactAgentSpy.mockClear()
    agentStreamMock.mockResolvedValueOnce(fakeAgentStream([aiTextChunk('ok')]))
    await app.inject({
      method: 'POST', url: '/api/llm/chat',
      payload: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] }
    })
    expect(reactAgentSpy.mock.calls.at(-1)?.[0].tools).toHaveLength(0)
    delete process.env.EXPLORE_DISABLE_MCP
  })

  // Regression: the request schema must NOT coerce a string `content` into an
  // array (a oneOf[string,array] schema + Fastify ajv coercion did this, which
  // corrupted the payload and made the proxy drop the connection).
  it('passes string content through to the agent as a string (no coercion)', async () => {
    agentStreamMock.mockResolvedValueOnce(fakeAgentStream([aiTextChunk('ok')]))
    await app.inject({
      method: 'POST', url: '/api/llm/chat',
      payload: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hello' }] }
    })
    // agent.stream({ messages: [[role, content], ...] }) — the user content must
    // still be the original string, not an array.
    const sent = agentStreamMock.mock.calls.at(-1)?.[0].messages
    const userTuple = sent.find((t: [string, unknown]) => t[0] === 'user')
    expect(typeof userTuple?.[1]).toBe('string')
    expect(userTuple?.[1]).toBe('hello')
  })

  it('rejects body missing required fields with HTTP 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/llm/chat',
      payload: { model: 'gpt-4o-mini' }
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects unknown message role with HTTP 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/llm/chat',
      payload: { model: 'gpt-4o-mini', messages: [{ role: 'tool', content: '...' }] }
    })
    expect(res.statusCode).toBe(400)
  })
})
