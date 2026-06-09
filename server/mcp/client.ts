/**
 * MCP client singleton (v10.133, Phase L2 of the MCP rollout).
 *
 * Loaded once at server boot via {@link initMCP}; exposes the materialized
 * tool list via {@link getMCPTools}. The route handler in
 * `server/routes/llm.ts` reads `getMCPTools()` once per request to build a
 * `createReactAgent` for Explore mode.
 *
 * **Graceful degradation contract:** every failure path — missing config
 * file, malformed JSON, unreachable MCP server, `.getTools()` rejection,
 * **OR `.getTools()` hanging past `MCP_INIT_TIMEOUT_MS` (default 5000ms)** —
 * resolves with an empty tool list and emits a warn log. Explore mode then
 * behaves identically to v10.132 plain chat. MCP failures and slow boots
 * must never break basic chat or block Fastify from starting.
 *
 * **Project rule:** this module is consumed only by the Explore code path
 * (`exploreCoach` in `src/composables/useLLM.ts` → `/api/llm/chat` →
 * `createReactAgent`). Task mode + Analyze stay on the v10.130 direct path
 * and never see these tools. See `feedback_task_mode_no_mcp.md` in auto-memory.
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { MultiServerMCPClient, type Connection } from '@langchain/mcp-adapters'
import type { StructuredToolInterface } from '@langchain/core/tools'

type MCPLog = {
  info: (obj: unknown, msg?: string) => void
  warn: (obj: unknown, msg?: string) => void
  error: (obj: unknown, msg?: string) => void
}

let _tools: StructuredToolInterface[] = []
let _client: MultiServerMCPClient | null = null

/**
 * Substitute `${ENV_VAR}` references inside any string value of a parsed
 * JSON object. Lets the committed `deploy/mcp-servers.json` reference
 * `${LLMPROXY_API_KEY}` so the secret stays in `.env`.
 */
function substituteEnvVars(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, name: string) => process.env[name] ?? '')
  }
  if (Array.isArray(value)) {
    return value.map(substituteEnvVars)
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = substituteEnvVars(v)
    }
    return out
  }
  return value
}

/**
 * Read + substitute + return the inner `mcpServers` map ready for
 * MultiServerMCPClient. Returns null on any non-recoverable error.
 */
async function loadConfig(configPath: string, log: MCPLog): Promise<Record<string, unknown> | null> {
  let raw: string
  try {
    raw = await readFile(configPath, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      log.warn({ configPath }, 'mcp: config file not found — MCP disabled')
    } else {
      log.warn({ configPath, err }, 'mcp: failed to read config — MCP disabled')
    }
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    log.warn({ configPath, err }, 'mcp: config JSON malformed — MCP disabled')
    return null
  }

  const substituted = substituteEnvVars(parsed) as { mcpServers?: Record<string, unknown> } | null
  const servers = substituted?.mcpServers
  if (!servers || typeof servers !== 'object' || Object.keys(servers).length === 0) {
    log.warn({ configPath }, 'mcp: config has no `mcpServers` entries — MCP disabled')
    return null
  }

  return servers
}

/**
 * One-shot init at server boot. Never rejects; failures degrade to an empty
 * tool list and a warn log. Safe to call multiple times (idempotent —
 * subsequent calls noop if `_client` is already populated).
 */
export async function initMCP(opts?: { configPath?: string; log?: MCPLog }): Promise<void> {
  if (_client) return // idempotent
  const log: MCPLog = opts?.log ?? {
    info: (...a) => console.log('[mcp]', ...a),
    warn: (...a) => console.warn('[mcp]', ...a),
    error: (...a) => console.error('[mcp]', ...a)
  }
  const configPath = resolve(opts?.configPath ?? process.env.MCP_CONFIG_PATH ?? 'deploy/mcp-servers.json')

  const servers = await loadConfig(configPath, log)
  if (!servers) {
    _tools = []
    return
  }

  // L2.1 hotfix: race getTools() against a timeout. The SDK has no built-in
  // timeout — if the MCP server is slow/unreachable/sends an incomplete
  // handshake, getTools() can hang forever and block Fastify's boot. Slow
  // hangs are a distinct failure mode from thrown errors; both must degrade
  // to empty tools without blocking app.listen().
  const timeoutMs = Number(process.env.MCP_INIT_TIMEOUT_MS ?? 5000)
  let timeoutHandle: NodeJS.Timeout | undefined
  try {
    const client = new MultiServerMCPClient(servers as Record<string, Connection>)
    const tools = await Promise.race([
      client.getTools(),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error(`mcp: init timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      })
    ])
    _client = client
    _tools = tools as StructuredToolInterface[]
    // L2.2 observability: emit one line per discovered tool so the operator
    // can see exactly what the agent has access to (name + description) and
    // craft prompts likely to invoke them. The rollup line below stays as
    // the summary.
    for (const t of _tools) {
      log.info({ name: t.name, description: t.description }, 'mcp: tool registered')
    }
    log.info(
      { tools: _tools.length, servers: Object.keys(servers).length },
      `mcp: loaded ${_tools.length} tools from ${Object.keys(servers).length} servers`
    )
  } catch (err) {
    log.warn({ err }, 'mcp: failed to connect or timed out — MCP disabled')
    _tools = []
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
  }
}

/**
 * Returns the cached tool list. Empty array if init never ran or failed.
 * Synchronous so the request handler doesn't have to await per-request.
 */
export function getMCPTools(): StructuredToolInterface[] {
  return _tools
}

/**
 * Test-only reset. Lets vitest re-run init with different mocks across tests.
 */
export function _resetMCPForTests(): void {
  _tools = []
  _client = null
}
