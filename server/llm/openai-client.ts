/**
 * Server-side ChatOpenAI factory (Phase L1 of MCP rollout).
 *
 * The Smart Agent SPA used to call the LLM provider directly from the browser
 * with the API key sitting in localStorage. As of v10.131 the call goes through
 * the Fastify backend → GWM LLM Proxy (`llmproxy.gwm.cn/v1`). This module is
 * the single place that constructs the LangChain `ChatOpenAI` client; the
 * route handler in `server/routes/llm.ts` calls `makeChatModel(model).stream()`.
 *
 * Env vars (set in `deploy/.env`, see `deploy/.env.example`):
 *   LLMPROXY_BASE_URL  default `https://llmproxy.gwm.cn/v1` — OpenAI-compatible
 *   LLMPROXY_API_KEY   required — same key authorizes both LLM and MCP services
 */
import { ChatOpenAI } from '@langchain/openai'

const DEFAULT_BASE_URL = 'https://llmproxy.gwm.cn/v1'

export const LLMPROXY_BASE_URL = process.env.LLMPROXY_BASE_URL || DEFAULT_BASE_URL
export const LLMPROXY_API_KEY = process.env.LLMPROXY_API_KEY ?? ''

// Dev escape hatch: the Node server ships its own CA bundle and may not trust a
// corporate proxy cert that the browser does (browser → Task works, server →
// Explore fails with "Connection error."). Setting LLMPROXY_INSECURE_TLS skips
// cert verification for ALL of this process's TLS — DEV ONLY. The
// production-correct fix is NODE_EXTRA_CA_CERTS=<corp-root-ca.pem> set in the
// real environment before Node starts.
export const LLMPROXY_INSECURE_TLS = /^(1|true|yes)$/i.test(process.env.LLMPROXY_INSECURE_TLS ?? '')
if (LLMPROXY_INSECURE_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  // eslint-disable-next-line no-console
  console.warn('[smart_agent] LLMPROXY_INSECURE_TLS is ON — TLS certificate verification is DISABLED. Dev only; do NOT use in production.')
}

if (!LLMPROXY_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[smart_agent] LLMPROXY_API_KEY is not set — LLM calls via /api/llm/chat will fail')
}

// Boot diagnostic so operators can verify the Explore path's transport (the SPA
// "LLM Settings" do NOT drive this — Explore uses these server env vars).
// eslint-disable-next-line no-console
console.info(`[smart_agent] LLM proxy: ${LLMPROXY_BASE_URL} (key ${LLMPROXY_API_KEY ? 'set' : 'MISSING'}, insecureTLS ${LLMPROXY_INSECURE_TLS ? 'on' : 'off'})`)

/**
 * Build a streaming-capable ChatOpenAI client. Model is per-request so the
 * SPA's existing model picker continues to drive which underlying model the
 * GWM proxy routes to.
 */
export function makeChatModel(model: string): ChatOpenAI {
  return new ChatOpenAI({
    model,
    apiKey: LLMPROXY_API_KEY,
    configuration: { baseURL: LLMPROXY_BASE_URL }
  })
}
