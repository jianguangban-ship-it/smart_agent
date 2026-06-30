/**
 * POST /api/llm/chat — brokered LLM streaming endpoint (v10.131, Phase L1).
 *
 * Replaces the previous "browser → LLM provider" call path. The SPA now POSTs
 * `{ model, messages }` here; we use a server-side `ChatOpenAI` against the
 * GWM proxy and re-emit each streamed token as an OpenAI-compatible SSE chunk
 * so the SPA's existing SSE parser in `src/composables/useLLM.ts` is unchanged.
 *
 * Auth: optional `X-Internal-Token` header. If `INTERNAL_API_TOKEN` is set in
 * the environment, the route requires it; if unset, the check is skipped
 * (intranet-only deploy is the security boundary in that case).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { BaseMessage, BaseMessageLike } from '@langchain/core/messages'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { makeChatModel } from '../llm/openai-client.js'
import { getMCPTools } from '../mcp/client.js'
import { audit } from '../logs/log-bus.js'

type ChatRole = 'system' | 'user' | 'assistant'
/** Content is a string (text turn) or OpenAI content parts (multi-modal/vision). */
type ChatContent = string | Array<Record<string, unknown>>
interface ChatMessageBody { role: ChatRole; content: ChatContent }
/** Optional traceability context the SPA attaches for Activity logs. */
interface TeamContext { team_key?: string; project?: string; assignee?: string }
interface ChatRequestBody { model: string; messages: ChatMessageBody[]; context?: TeamContext }

const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN ?? ''

const REQUEST_BODY_SCHEMA = {
  type: 'object',
  required: ['model', 'messages'],
  additionalProperties: false,
  properties: {
    model: { type: 'string', minLength: 1, maxLength: 200 },
    messages: {
      type: 'array',
      minItems: 1,
      maxItems: 200,
      items: {
        type: 'object',
        required: ['role', 'content'],
        additionalProperties: false,
        properties: {
          role: { type: 'string', enum: ['system', 'user', 'assistant'] },
          // Unconstrained: a plain string (text turn) OR an array of OpenAI
          // content parts (multi-modal/vision). We deliberately set NO `type`
          // here — a `oneOf:[string,array]` schema makes Fastify's ajv
          // type-coercion rewrite a string into an array, corrupting the payload
          // (the upstream proxy then drops the connection). The upstream LLM
          // validates the real content shape.
          content: {}
        }
      }
    },
    // Optional traceability context (who/which team is acting) for Activity
    // logs. additionalProperties:false keeps the open intranet endpoint tight.
    context: {
      type: 'object',
      additionalProperties: false,
      properties: {
        team_key: { type: 'string' },
        project: { type: 'string' },
        assignee: { type: 'string' }
      }
    }
  }
} as const

// Exported so sibling routes (transcribe.ts) enforce the same guard.
export async function requireInternalTokenIfConfigured(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!INTERNAL_API_TOKEN) return
  const provided = req.headers['x-internal-token']
  if (provided !== INTERNAL_API_TOKEN) {
    audit(req.log, 'auth.fail', {
      level: 'warn', source: 'ui', ip: req.ip,
      msg: `auth.fail ${req.method} ${req.url} · bad internal token`,
      detail: { route: req.url, reason: 'internal_token' }
    })
    reply.code(401).send({ error: 'auth' })
  }
}

/**
 * Emit a single OpenAI-compatible SSE chunk that the SPA's existing parser
 * (`useLLM.ts:_callGLMStream`) understands without modification.
 *
 * Wire shape: `data: {"choices":[{"delta":{"content":"<token>"}}]}\n\n`
 */
function writeSSEContentChunk(reply: FastifyReply, text: string): void {
  if (!text) return
  const payload = JSON.stringify({ choices: [{ delta: { content: text } }] })
  reply.raw.write(`data: ${payload}\n\n`)
}

/**
 * L3 (v10.134): emit a tool-event chunk alongside the existing content
 * chunks. The wire shape reuses the OpenAI delta envelope but adds a
 * namespaced `smart_agent_event` field — unknown to OpenAI's spec, ignored
 * by any non-aware consumer, parsed by `useLLM.ts:_callBrokeredLLM` into
 * `ToolEvent` entries on the assistant message.
 *
 * Wire shape:
 *   data: {"choices":[{"delta":{"smart_agent_event":{"kind":"tool_call","tool":"<name>","args":{...}}}}]}\n\n
 *   data: {"choices":[{"delta":{"smart_agent_event":{"kind":"tool_result","tool":"<name>","contentLen":N,"preview":"..."}}}]}\n\n
 */
function writeSSEToolEvent(reply: FastifyReply, event: object): void {
  const payload = JSON.stringify({ choices: [{ delta: { smart_agent_event: event } }] })
  reply.raw.write(`data: ${payload}\n\n`)
}

function writeSSEDone(reply: FastifyReply): void {
  reply.raw.write('data: [DONE]\n\n')
}

/**
 * Emit an error on the SSE `data:` channel so the SPA actually sees it. We must
 * NOT use an SSE comment (`: ...`) here: the client only parses `data:` lines,
 * so a comment is silently ignored and the user gets an empty reply with no
 * error. Wire shape: `data: {"error":{"message":"..."}}\n\n`.
 */
function writeSSEError(reply: FastifyReply, message: string): void {
  reply.raw.write(`data: ${JSON.stringify({ error: { message } })}\n\n`)
}

export async function llmRoutes(app: FastifyInstance) {
  app.post<{ Body: ChatRequestBody }>('/llm/chat', {
    schema: { body: REQUEST_BODY_SCHEMA },
    onRequest: requireInternalTokenIfConfigured
  }, async (req, reply) => {
    const { model, messages, context } = req.body

    // SSE headers written directly to the raw socket. We don't call
    // `reply.hijack()` because: (a) the handler stays async and only returns
    // after `reply.raw.end()`, so Fastify never tries to send its own
    // response, and (b) hijack() interferes with `light-my-request`'s
    // response capture in `inject()` tests.
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'  // disable proxy buffering
    })

    // Abort upstream LLM call if the client disconnects mid-stream.
    // Listen on reply.raw, NOT req.raw: req.raw's 'close' fires both on
    // client disconnect AND when the request body has been fully drained
    // (the normal POST lifecycle). For small bodies the body is already
    // drained by the time this handler runs, so listening on req.raw
    // fires ac.abort() on the next tick — before llm.stream() can resolve,
    // causing it to reject with AbortError. reply.raw's 'close' only
    // fires when the response connection actually terminates (client
    // disconnect or our own .end() call); the writableEnded guard makes
    // the latter a no-op.
    const ac = new AbortController()
    reply.raw.on('close', () => {
      if (!reply.raw.writableEnded) ac.abort()
    })

    try {
      const llm = makeChatModel(model)
      // EXPLORE_DISABLE_MCP lets an operator strip tool-binding so the request
      // matches a plain browser completion — for isolating whether the
      // tool-augmented request is what an upstream gateway rejects.
      const disableMcp = /^(1|true|yes)$/i.test(process.env.EXPLORE_DISABLE_MCP ?? '')
      const tools = disableMcp ? [] : getMCPTools()
      // Log the exact request shape so failures are diagnosable: which model the
      // server actually sent (the Explore path uses the server key, not the SPA
      // settings), how many tools were bound, and whether it's a vision turn.
      req.log.info(
        {
          model,
          tools: tools.length,
          multimodal: messages.some(m => Array.isArray(m.content)),
          contentTypes: messages.map(m => Array.isArray(m.content) ? 'array' : typeof m.content),
          team_key: context?.team_key,
          teamInformation: context
        },
        'llm/chat request'
      )
      // ReactAgent runs the tool-use loop server-side: LLM emits tool calls →
      // tools execute → LLM gets results → LLM emits final answer. When
      // `tools` is empty (MCP disabled or unreachable) the agent degrades to
      // a plain LLM passthrough, behaviorally identical to v10.132.
      const agent = createReactAgent({ llm, tools })
      // Content may be a string or OpenAI content parts (vision) — LangChain's
      // ChatOpenAI accepts both via the [role, content] tuple form.
      const llmMessages: BaseMessageLike[] = messages.map(m => [m.role, m.content] as BaseMessageLike)
      const stream = await agent.stream(
        { messages: llmMessages },
        { signal: ac.signal, streamMode: 'messages' }
      )

      for await (const event of stream as AsyncIterable<[BaseMessage, unknown]>) {
        if (ac.signal.aborted) break
        // streamMode:'messages' yields [chunk, metadata] tuples per message
        // chunk emitted during the agent's LLM streams. For L2 we forward
        // ONLY assistant text deltas; tool-call and tool-result chunks are
        // swallowed server-side. L3 will introduce a richer SSE event format
        // so the SPA can render tool events in ChatBubble.
        const chunk = Array.isArray(event) ? event[0] : event
        if (!chunk) continue

        // L2.2 observability: log every tool-call directive and tool result
        // so the operator can confirm from the pino stream that the MCP tool
        // is actually being invoked end-to-end (not just loaded). Logged
        // before the SSE filter so non-text agent events are still visible.
        const chunkType = chunk._getType?.()
        if (chunkType === 'ai') {
          const toolCalls = (chunk as { tool_calls?: Array<{ name?: string; args?: unknown }> }).tool_calls
          if (Array.isArray(toolCalls) && toolCalls.length > 0) {
            for (const tc of toolCalls) {
              req.log.info({ tool: tc.name, args: tc.args }, 'agent: tool_call requested')
              // L3: also push down to the SPA so the user sees a "calling …" chip.
              writeSSEToolEvent(reply, { kind: 'tool_call', tool: tc.name, args: tc.args })
            }
          }
        } else if (chunkType === 'tool') {
          const toolChunk = chunk as { name?: string; content?: unknown }
          const contentStr = typeof toolChunk.content === 'string'
            ? toolChunk.content
            : JSON.stringify(toolChunk.content ?? '')
          const preview = contentStr.slice(0, 200)
          req.log.info(
            { tool: toolChunk.name, contentLen: contentStr.length, preview },
            'agent: tool_result received'
          )
          // L3: emit the tool result for the SPA — flip the corresponding chip
          // from "calling …" to "done" and reveal the content preview.
          writeSSEToolEvent(reply, {
            kind: 'tool_result',
            tool: toolChunk.name,
            contentLen: contentStr.length,
            preview
          })
          continue
        }

        if (chunkType !== 'ai') continue
        let text = ''
        if (typeof chunk.content === 'string') {
          text = chunk.content
        } else if (Array.isArray(chunk.content)) {
          for (const part of chunk.content) {
            if (typeof part === 'string') text += part
            else if (part && typeof part === 'object' && 'text' in part && typeof (part as { text: unknown }).text === 'string') text += (part as { text: string }).text
          }
        }
        if (text) writeSSEContentChunk(reply, text)
      }

      if (!reply.raw.writableEnded) {
        writeSSEDone(reply)
        reply.raw.end()
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Client disconnected; just close the socket.
        if (!reply.raw.writableEnded) reply.raw.end()
        return
      }
      // undici/Node wrap the real reason in `err.cause` (e.g. a TLS code like
      // DEPTH_ZERO_SELF_SIGNED_CERT, or UND_ERR_SOCKET/ECONNRESET). pino doesn't
      // deep-serialize `.cause`, so log it explicitly and append the code to the
      // surfaced message — that's what tells TLS vs network vs proxy apart.
      const cause = (err as { cause?: { code?: string; message?: string } }).cause
      req.log.error({ err, model, causeCode: cause?.code, causeMsg: cause?.message, team_key: context?.team_key, teamInformation: context }, 'llm/chat upstream error')
      const detail = `${(err as Error).message}${cause?.code ? ` (${cause.code})` : ''} [model=${model}]`
      if (!reply.raw.headersSent) {
        reply.code(502).send({ error: 'upstream', message: detail })
        return
      }
      if (!reply.raw.writableEnded) {
        // Headers already sent (SSE started), so surface the error on the
        // `data:` channel the client parses — NOT an SSE comment, which it
        // ignores (would look like an empty reply with no error).
        writeSSEError(reply, detail)
        writeSSEDone(reply)
        reply.raw.end()
      }
    }
  })
}
