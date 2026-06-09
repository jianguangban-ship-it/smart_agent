# Phase L1 Smoke Test — Brokered LLM (`/api/llm/chat`)

v10.131 moves the LLM call from "browser → provider" to "browser → Fastify → `llmproxy.gwm.cn/v1`". No user-visible UX change is intended. This guide walks through verifying that's what actually happened, against the live GWM proxy.

## Prerequisites

1. You're on the GWM intranet (or VPN) so `llmproxy.gwm.cn` is reachable.
2. You have your GWM LLM proxy api_key handy (the same one that authorizes the MCP service shown in the `MCP-Service.jpg` screenshot).

## Setup

1. **Configure environment.** Copy `deploy/.env.example` to `deploy/.env` (or update the existing one) and fill in:
   ```env
   LLMPROXY_BASE_URL=https://llmproxy.gwm.cn/v1
   LLMPROXY_API_KEY=<paste-your-key-here>
   # Leave INTERNAL_API_TOKEN blank for dev. Set it in prod if you want the
   # /api/llm/chat route gated by a shared-secret header.
   ```
   The Fastify server reads this on boot via `--env-file-if-exists=deploy/.env` (already wired in `package.json`'s `start` and `server` scripts).

2. **Start both Vite + Fastify in dev mode.**
   ```sh
   npm run dev:all
   ```
   You should see two colored log streams: Vite on port 5173, Fastify on port 8080. Vite proxies `/api/*` → `localhost:8080` (`vite.config.ts:16–23`).

## Tests

### 1. Task mode — coach should respond as before

1. Open `http://localhost:5173` in your browser.
2. Switch to **Task mode** if it's not already active.
3. Fill in any task description, e.g. "Add a new login screen with two-factor auth."
4. Click the orange **Coach** Send button (or press **Enter** in the composer).
5. **Expected:** the coach panel streams a response token-by-token, exactly like before v10.131. Indistinguishable from the v10.130 experience.

### 2. Explore mode — same check

1. Switch to **Explore mode**.
2. Type "Briefly explain ASPICE V-model." into the composer.
3. Press **Enter**.
4. **Expected:** Explore chat streams a response. Same UX as before.

### 3. DevTools — verify the request actually goes through Fastify

1. Open DevTools → **Network** tab → filter `Fetch/XHR`.
2. Send another coach turn.
3. **Expected:** you see a request to `localhost:5173/api/llm/chat` (in dev — Vite proxies to Fastify at 8080). The request **should NOT** go to `open.bigmodel.cn`, `api.openai.com`, or `llmproxy.gwm.cn` directly from the browser.
4. Click the request → **Headers** tab. Confirm:
   - Method: `POST`
   - No `Authorization: Bearer …` header (the key now lives server-side).
   - `Content-Type: application/json`.
5. **Response** tab: confirm the response is `text/event-stream` SSE with `data: {"choices":[{"delta":{"content":"…"}}]}\n\n` lines, terminated by `data: [DONE]`.

### 4. DevTools → Application → Local Storage — keys gone

1. Open DevTools → **Application** → **Local Storage** → your origin.
2. **Expected:** keys `glm-api-key`, `glm-model`, `provider-url` may still exist (we kept the values for one release) but **nothing in the LLM call path reads them anymore**. To prove it: clear `glm-api-key` entirely and reload; the chat still works.

### 5. Settings modal — Provider URL + API key fields are gone

1. Open the Settings modal (gear icon in the header).
2. **Expected:**
   - Where "Provider Base URL" and "API Key" + "Test" button used to be, there's now a single info panel:
     - EN: "Chat requests are brokered through the company LLM gateway. The provider URL and API key are configured server-side; contact ops to change them."
     - ZH: "所有对话请求由公司 LLM 网关代理转发。服务商地址和 API Key 配置在服务端，如需修改请联系运维。"
   - The **Model Name** picker is still there.
   - All Skills / Templates / Response Format sections unchanged.

### 6. Model selection still works

1. In Settings, change the model from `glm-4.7-flash` to `default/deepseek-v3-2` (or whatever your GWM proxy supports).
2. Save and send a coach turn.
3. **Expected:** the response actually comes from the new model (you may notice tone or length shifts). The model is passed through to `/api/llm/chat` and forwarded to the proxy unchanged.

### 7. Error path — bad api_key surfaces sensibly

1. Stop the server. Edit `deploy/.env` and set `LLMPROXY_API_KEY=intentionally-wrong`.
2. Restart with `npm run dev:all`.
3. Send a coach turn.
4. **Expected:** the LLM proxy returns 401 → the SPA shows the (updated) error message: "LLM gateway rejected the request (auth). Contact ops if this persists." / "LLM 网关拒绝了请求（认证失败）。如持续出现请联系运维。"
5. **Restore the real key** and restart.

## What this does NOT yet do

- **No MCP, no web search, no agent loop.** All of that is Phase L2 onward.
- **No tool-call / tool-result rendering in chat bubbles.** Phase L4.
- **No settings UI for MCP servers.** Phase L4/L5.

If all 7 checks above pass, L1 is good and we're cleared to start L2.
