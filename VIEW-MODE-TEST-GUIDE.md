# View Mode — Configuration & Test Guide

Hands-on runbook for writing data to View mode (`POST /api/tickets`) and reading
it back through the grid. Covers the specific failure modes hit during the
initial smoke test so they don't bite again.

Spec source of truth: `E:\n8n-code-JavaScripts\http-port-design.MD` (§2, §3, §6, §10.3).

---

## 1. Prerequisites — one-time setup

### 1.1 Pick the **one** working copy you'll actually run

There are multiple checkouts of this repo on the machine
(`E:\smart_agent_plus\`, `E:\smart_agent\`, `E:\agentic_ept\smart_agent\`).
They each have their **own** `deploy/.env`, `data.sqlite`, and `dist/`.

**Decide which one is "the running copy" and stick to it.** Every command,
every config edit, every test goes through that one directory. Mixing them
caused the 401 on the first attempt.

To confirm which copy a running server belongs to:

```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen |
  Select-Object -ExpandProperty OwningProcess |
  ForEach-Object { (Get-CimInstance Win32_Process -Filter "ProcessId=$_").CommandLine }
```

The output names the directory `tsx watch` was launched from. That is the
running copy. Edit `deploy/.env` **in that directory**, not in a sibling.

### 1.2 Create / verify the API key

In your chosen copy:

```
deploy/.env
─────────────
QUALITY_API_KEY=7a5a3f82061dc79e32d40eba724047fac121c6f842d3d0272fa7249921caec17
```

- One line, no quotes around the value, no trailing spaces.
- Generate a fresh 64-hex key for a new install:
  `-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })`
- This is the same key n8n's **Header Auth** credential will send (spec §10.2).

### 1.3 Boot dev:all

```powershell
cd <your chosen copy>
npm run dev:all
```

This launches Vite on **:5173** and Fastify on **:8080** under a single
`concurrently -k` wrapper. Killing either tears down both.

Vite proxies `/api/*` → `http://localhost:8080` (see `vite.config.ts`), so
both of these reach the same server:

| URL | Path |
|---|---|
| `http://localhost:5173/api/tickets` | via Vite proxy (matches what the SPA uses) |
| `http://localhost:8080/api/tickets`  | direct to Fastify (bypasses the proxy) |

Use **:5173** for normal testing. Switch to **:8080** only when you suspect
Vite is rewriting/stripping something.

---

## 2. Test commands

### 2.1 Happy-path write (spec §10.3 smoke check)

⚠️ **Use the UTF-8 byte pattern below for any body containing non-ASCII**
(Chinese summary / displayName / status `格式异常` / `未知`). Windows PowerShell
5.1's `Invoke-WebRequest -Body $string` defaults to ISO-8859-1 and silently
mangles non-ASCII into `?`, which produces a confusing empty `400` from the
server. See Pitfall G below.

```powershell
$key = "<your key>"
$body = @{
  issueKey="TEST-1"; issueType="Task"
  project="X"; team_key="X"; team="X"
  summary="hi"; points=0
  assignee="x"; displayName="x"
  agentCheck="hi"; status="A"; action="create"
  timestamp="2026-05-21T00:00:00Z"
} | ConvertTo-Json -Compress

$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
Invoke-WebRequest -Uri http://localhost:5173/api/tickets -Method POST `
  -Headers @{ "Content-Type"="application/json; charset=utf-8"; "X-API-Key"=$key } `
  -Body $bytes -UseBasicParsing | Select-Object StatusCode, Content
```

| First call | Re-run | What it proves |
|---|---|---|
| `201 Created`, `{ result: "created" }` | `200 OK`, `{ result: "updated" }` | Endpoint reachable, key correct, idempotency on `issueKey` works (spec §2.3) |

Then open `http://localhost:5173/` → switch to **View** mode → TEST-1 row
appears with a green **A** badge.

### 2.2 A richer fixture (per status grade)

Seed one row per canonical grade so the filter dropdowns and TrendMatrix
exercise every color. Run this **after** 2.1 succeeded:

```powershell
$key = "<your key>"

function Post-Ticket([hashtable]$row) {
  $body = @{
    issueKey=$row.issueKey; issueType="Task"
    project=$row.team; team_key=$row.team_key; team=$row.team
    summary=$row.summary; points=$row.points
    assignee="GW00000000"; displayName="Test User"
    agentCheck="## Sample report`n`nStatus: <font color=`"#1E90FF`">**$($row.status)**</font>"
    status=$row.status; action="create"
    timestamp=(Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  } | ConvertTo-Json -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  try {
    $resp = Invoke-WebRequest -Uri http://localhost:5173/api/tickets -Method POST `
      -Headers @{ "Content-Type"="application/json; charset=utf-8"; "X-API-Key"=$key } `
      -Body $bytes -UseBasicParsing
    [PSCustomObject]@{ issueKey=$row.issueKey; status=$row.status; code=$resp.StatusCode; result=($resp.Content | ConvertFrom-Json).result }
  } catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { '?' }
    [PSCustomObject]@{ issueKey=$row.issueKey; status=$row.status; code=$code; result="ERR" }
  }
}

$rows = @(
  @{ issueKey="DKKF-1001"; status="A"; team_key="DKKF"; team="IDC_PDSW"; summary="Excellent ticket"; points=5 }
  @{ issueKey="DKKF-1002"; status="B"; team_key="DKKF"; team="IDC_PDSW"; summary="Good ticket, minor improvements"; points=3 }
  @{ issueKey="DKKG-1003"; status="C"; team_key="DKKG"; team="IDC_PDSY"; summary="Medium quality"; points=2 }
  @{ issueKey="DKKG-1004"; status="D"; team_key="DKKG"; team="IDC_PDSY"; summary="Needs rewrite"; points=1 }
  @{ issueKey="BSD-1005";  status="格式异常"; team_key="BSD"; team="IDC_SDBS"; summary="Format anomaly"; points=0 }
  @{ issueKey="BSD-1006";  status="未知"; team_key="BSD"; team="IDC_SDBS"; summary="Unknown status"; points=0 }
)
$rows | ForEach-Object { Post-Ticket $_ } | Format-Table -AutoSize
```

In View mode, confirm:

- Each row's badge shows its spec §3.3 color (`A` green, `B` blue, `C` orange,
  `D` red, `格式异常` purple, `未知` gray).
- Filter dropdown **Team** lists DKKF / DKKG / BSD.
- Filter dropdown **Status** filters down to one badge color.
- Free-text search on `Excellent`, `rewrite`, `User` narrows the table.
- Clicking a row opens the modal; the markdown's `<font color>` badge renders
  colored (not stripped).

### 2.3 Negative tests — confirm the endpoint rejects bad input (spec §3.2)

Each of these should return **400** with `{ error: "validation", details: [...] }`:

```powershell
# Lowercase issueKey
$bad = ($body | ConvertFrom-Json); $bad.issueKey = "test-1"
Invoke-RestMethod -Uri http://localhost:5173/api/tickets -Method POST `
  -Headers @{ "Content-Type"="application/json"; "X-API-Key"=$key } `
  -Body ($bad | ConvertTo-Json) -SkipHttpErrorCheck
```

Repeat with: `issueKey="未知KEY"`, `status="一般"`, `timestamp="not-a-date"`,
`points=-3`. Each should 400 and name the failing field in `details`.

**Wrong key → 401:**

```powershell
Invoke-RestMethod -Uri http://localhost:5173/api/tickets -Method POST `
  -Headers @{ "Content-Type"="application/json"; "X-API-Key"="wrong-key" } `
  -Body $body -SkipHttpErrorCheck
# → { error: "auth" }
```

Auth fires **before** body validation — a wrong-key + bad-body request must
still be 401, never 400.

**Body > 1 MB → 413:**

```powershell
$bigBody = ($body | ConvertFrom-Json)
$bigBody.agentCheck = "x" * 1100000
Invoke-RestMethod -Uri http://localhost:5173/api/tickets -Method POST `
  -Headers @{ "Content-Type"="application/json"; "X-API-Key"=$key } `
  -Body ($bigBody | ConvertTo-Json) -SkipHttpErrorCheck
# → { error: "too_large" }
```

### 2.4 Read back via GET (what View mode sees)

```powershell
Invoke-RestMethod -Uri "http://localhost:5173/api/tickets" -Method GET |
  Select-Object issueKey, team_key, status, timestamp |
  Format-Table -AutoSize
```

This is the same JSON the SPA fetches. If a write returned 201 but this list
doesn't include the row, the bug is in the read path / proxy / DB, not the
write path.

---

## 3. Troubleshooting — the failure modes already seen

### Pitfall A — `401 Unauthorized` immediately after editing `deploy/.env`

**Cause.** `server/auth.ts:5` reads `QUALITY_API_KEY` **once at module load**.
`tsx watch` reloads source files but does **not** re-read the env file. If the
server was started before the env file had a value (or before the file existed),
`EXPECTED_KEY` is `""`, and the `!EXPECTED_KEY` branch returns 401 for every
request regardless of the header.

**Fix.** Bounce the server. Easiest: kill the `concurrently` wrapper, which
cascades to both Vite and Fastify:

```powershell
$pid = (Get-NetTCPConnection -LocalPort 8080 -State Listen).OwningProcess
# Walk up to the concurrently parent
$p = Get-CimInstance Win32_Process -Filter "ProcessId=$pid"
while ($p -and $p.CommandLine -notmatch 'concurrently') {
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.ParentProcessId)"
}
if ($p) { Stop-Process -Id $p.ProcessId -Force }
# Then restart from the chosen copy
npm run dev:all
```

Wait for both ports to come up before retesting (`Get-NetTCPConnection -LocalPort 5173,8080 -State Listen`).

### Pitfall B — `401` even though `deploy/.env` looks correct

**Cause.** The server is running from a **different working copy** than the one
whose `deploy/.env` you just edited. Confirmed in §1.1.

**Fix.** Run the PID-to-cwd lookup in §1.1 to identify the right copy, then
edit *that* copy's `deploy/.env`. Or `cd` into your intended copy and restart
dev:all there — the previous instance dies (port conflict surfaces it
immediately).

### Pitfall C — `401` only via `:5173`, but `:8080` direct works

**Cause.** Vite proxy isn't forwarding the `X-API-Key` header. Header names
are case-insensitive over the wire; PowerShell's `Invoke-RestMethod` sends
exactly what you type. Vite's default proxy preserves headers, so this is
rare — but worth a sanity check.

**Fix.** Inspect `vite.config.ts` proxy block. The shipped config simply
forwards `/api` without filtering. If a header-rewrite was added, remove it.

### Pitfall D — `200 OK` from a write that should be `201 Created`

**Cause.** The row was previously created (e.g., from a prior test run). The
endpoint is idempotent on `issueKey` (spec §2.3): first call → 201, every
subsequent → 200. Both are success.

**Fix.** Not a bug. To get 201 again, change `issueKey` (e.g. `TEST-2`) or
delete the row from sqlite.

### Pitfall E — Drift status row missing from the grid

**Cause.** The server enum rejects non-canonical statuses (e.g. `一般`) at
the POST boundary, so a drift row can't be created via the API.

**To exercise the gray drift-signal path** *without* relaxing validation:

```powershell
# 1. Stop dev:all
# 2. Hand-edit the sqlite row (path: deploy/data.sqlite per server/db.ts)
sqlite3 deploy/data.sqlite "UPDATE tickets SET status='一般' WHERE issue_key='TEST-1';"
# 3. Restart dev:all and refresh View mode — TEST-1 should render gray
# 4. After verifying, revert: UPDATE tickets SET status='A' WHERE issue_key='TEST-1';
```

Do **not** add `一般` to `STATUS_COLORS` to make this "easier". The drift
signal only works if drift is genuinely rare and looks broken (spec §3.3).

### Pitfall G — `400` with an empty response body when posting Chinese fields

**Symptom (observed, root cause confirmed).** A POST with `status="格式异常"` or
`status="未知"`, or with Chinese characters anywhere else in the body, returns
`400` and the response body is empty / unreadable. Plain-ASCII rows
(`status="A"`) sent from the same script succeed.

**Cause.** **Windows PowerShell 5.1** — the default on Win10/Win11 — encodes
`Invoke-WebRequest -Body $string` (and `Invoke-RestMethod -Body $string`) as
**ISO-8859-1**. Chinese characters can't be represented in ISO-8859-1 so they
get replaced with literal `?` before hitting the wire. The server receives
`"status":"????"`, which is not in the ajv enum, so validation rejects it with
400. The response body's `details: [...]` array does come back, but
PowerShell's `Invoke-WebRequest` error handler doesn't surface it by default.

**Fix.** Convert the JSON string to UTF-8 bytes explicitly and tell the server
what you sent:

```powershell
$body = $payload | ConvertTo-Json -Compress
$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
Invoke-WebRequest -Uri ... -Method POST -Body $bytes `
  -Headers @{ "Content-Type" = "application/json; charset=utf-8"; "X-API-Key" = $key } `
  -UseBasicParsing
```

This is what §2.1 and §2.2 of this guide use throughout. **Don't** revert to
`-Body $string` for "simpler ASCII-only" requests — make the byte/charset
pattern your default so you can't forget when Chinese sneaks in later.

PowerShell 7+ defaults to UTF-8 and doesn't have this trap. If you're on 7+
you can use `-Body $string` directly — but keep the byte pattern in shared
scripts so they remain portable.

**To peek at the 400 body anyway** (for debugging this or future validation
failures):

```powershell
try {
  Invoke-WebRequest -Uri ... -Method POST -Body $bytes -Headers $h -UseBasicParsing
} catch {
  $r = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
  $r.ReadToEnd()  # → { error: "validation", details: [...] }
}
```

### Pitfall F — `<font color="…">` shows up as raw text in the modal

**Cause.** DOMPurify stripped the `<font>` tag. Spec §6.4 explicitly requires
the color tag to survive sanitization.

**Fix.** In `src/utils/markdown.ts`, ensure the DOMPurify config includes:

```ts
ADD_TAGS: ['font'],
ADD_ATTR: ['color']
```

Then re-test by re-posting `TEST-1` with an `agentCheck` that contains
`<font color="#32CD32">**A**</font>` and reopening the modal. The **A** should
appear green and bold.

---

## 4. Reset to clean slate

```powershell
# Stop dev:all (Ctrl-C the wezterm window, or kill concurrently per Pitfall A)
# Then:
Remove-Item deploy/data.sqlite -Force -ErrorAction SilentlyContinue
npm run dev:all
# DB is recreated empty on first request (server/db.ts runs migrations on boot)
```

After this the grid renders the empty state ("no tickets yet"). Re-seed via §2.

---

## 5. One-line health check (paste into any new PowerShell window)

```powershell
$k="7a5a3f82061dc79e32d40eba724047fac121c6f842d3d0272fa7249921caec17";$j=(@{issueKey="HEALTH-2";issueType="Task";project="X";team_key="X";team="X";`
  summary="[GWM][EDC][TEST][FIN][流程优化问题沟通确认-002样件需求提报流程]";points=0;assignee="x";displayName="x";agentCheck="ping";`
  status="A";action="create";timestamp=(Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")} | ConvertTo-Json -Compress);`
  Invoke-WebRequest -Uri http://localhost:5173/api/tickets -Method POST -UseBasicParsing `
  -Headers @{"Content-Type"="application/json; charset=utf-8";"X-API-Key"=$k} `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($j)) | Select-Object StatusCode, Content
```

Expected: `StatusCode : 201` + `Content : {"issueKey":"HEALTH-1","result":"created"}`
(first call) or `200` + `"updated"` (subsequent). Anything else → walk §3 from
top to bottom.
