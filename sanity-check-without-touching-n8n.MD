Good catch — I jumped ahead. Two terminals on this Windows box:

  Terminal 1 — start the server (leave it running)

  Open a PowerShell window:
  - Win+X → "Terminal" or "PowerShell"
  - Or in VS Code: Ctrl+` (backtick)

  Then:
  cd E:\smart_agent_plus
  npm run server

  You should see [quality-grid] listening on http://0.0.0.0:8080. Leave this window open.

  Terminal 2 — run the smoke check

  Open a second PowerShell window (same way as above). PowerShell on Windows aliases curl to Invoke-WebRequest which has different syntax than real curl, so use curl.exe explicitly to force the real one (it
  ships with Windows 10+):

That's PowerShell's quoting hell biting. Real curl.exe is picky about how Windows shells pass quoted args. The cleanest fix on Windows is to use PowerShell's native Invoke-RestMethod instead — no escaping
  needed:

  $body = @{
    issueKey    = "TEST-4"
    issueType   = "Task"
    project     = "X"
    team_key    = "X"
    team        = "X"
    summary     = "hi"
    points      = 0
    assignee    = "x"
    displayName = "x"
    agentCheck  = "hi"
    status      = "A"
    action      = "create"
    timestamp   = "2026-05-15T00:00:00Z"
  } | ConvertTo-Json

  Invoke-RestMethod -Uri http://localhost:8080/api/tickets -Method POST `
    -Headers @{
      "Content-Type" = "application/json"
      "X-API-Key"    = "7a5a3f82061dc79e32d40eba724047fac121c6f842d3d0272fa7249921caec17"
    } `
    -Body $body

  Paste the whole block into Terminal 2 (the second PowerShell), hit Enter.

  Expected output (first time):
  issueKey result
  -------- ------
  TEST-1   created

  Once you've seen the 201/200, you've confirmed the server, port, key, and JSON contract are all good — the only remaining unknown will be n8n itself.

  Run it again → result : updated. Change the key to a wrong value → you'll see a 401 error and PowerShell will throw Invoke-RestMethod : The remote server returned an error: (401) Unauthorized. — that's the
  auth path working.

  Right — EADDRINUSE: address already in use 0.0.0.0:8080 means another process already grabbed port 8080. That's actually why your second-window Invoke-RestMethod succeeded: there's an old server running
  somewhere else (maybe from a prior session, or my earlier background test). It received your POST and logged the line — but to a window you can't see anymore.

  Fix in 3 steps

  1. Find and kill the orphan server (in any PowerShell)

  Get-NetTCPConnection -LocalPort 8080 | Select-Object OwningProcess, State

  That prints the PID. Then:

  Stop-Process -Id <PID-from-above> -Force

  Or as a one-liner if you don't care which process it is:

  Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force }

  2. Restart in Terminal 1

  cd E:\smart_agent_plus
  npm run server

  This time you should see:
  {"level":30,"time":...,"msg":"Server listening at http://0.0.0.0:8080"}
  {"level":30,"time":...,"msg":"quality-grid listening on http://0.0.0.0:8080"}
  Leave Terminal 1 open and visible.


  Confirmed. Here's why npm run server doesn't show the SPA:

  The two-process split (by design)

  ┌─────────────────┬──────────────────────┬─────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │     Script      │     What it runs     │    Port     │                                              Serves the SPA?                                               │
  ├─────────────────┼──────────────────────┼─────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ npm run dev     │ Vite dev server only │ 5173        │ Yes — with hot-reload, source maps, etc. Has a proxy: any /api/* request gets forwarded to localhost:8080. │
  ├─────────────────┼──────────────────────┼─────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ npm run server  │ Fastify only         │ 8080        │ Only if a built dist/ folder exists. In dev there isn't one, so Fastify serves only the API.               │
  ├─────────────────┼──────────────────────┼─────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ npm run dev:all │ Both, side-by-side   │ 5173 + 8080 │ Yes (via Vite).                                                                                            │
  ├─────────────────┼──────────────────────┼─────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ npm run start   │ Fastify on built SPA │ 8080        │ Yes — production mode, after npm run build.                                                                │
  └─────────────────┴──────────────────────┴─────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Look at server/index.ts:27 — if (existsSync(SPA_ROOT)) — Fastify only mounts the static SPA when the dist/ folder is present. In dev you skip the build step, so dist/ is missing, so npm run server exposes only
   /api/*.

  What this means for the n8n test

  n8n always POSTs to port 8080 (the Fastify side) regardless of which script you run. The SPA on 5173 is just a viewer that fetches /api/tickets through Vite's proxy.

  So for the live n8n test you want npm run dev:all — same single terminal will show:
  - Vite startup (blue prefix [vite])
  - Fastify startup (green prefix [server])
  - n8n's POST land as a [server]-prefixed log line with issueKey: "DKKF-..."