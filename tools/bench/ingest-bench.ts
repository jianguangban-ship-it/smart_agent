// Ingest-path (n8n → POST /api/tickets) correctness + latency bench (v10.193).
// Companion to view-bench.ts — run against a server holding a realistically
// sized DB to measure the realtime data-loading path at production scale.
//
// Run:  npx tsx tools/bench/ingest-bench.ts
// Needs the dev server up (npm run server / dev:all) and QUALITY_API_KEY —
// read from the environment, falling back to deploy/.env (same file the dev
// server loads). Writes synthetic PERFTEST-* rows; restore the DB from a
// backup afterwards if it must stay pristine.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = process.env.QUALITY_API_BASE ?? 'http://localhost:8080'

function apiKey(): string {
  if (process.env.QUALITY_API_KEY) return process.env.QUALITY_API_KEY
  const env = readFileSync(resolve(__dirname, '..', '..', 'deploy', '.env'), 'utf8')
  const m = env.match(/^QUALITY_API_KEY=(.+)$/m)
  if (!m) throw new Error('QUALITY_API_KEY not in env or deploy/.env')
  return m[1].trim()
}
const KEY = apiKey()

const ticket = (issueKey: string, status: string, extra: Record<string, unknown> = {}) => ({
  issueKey,
  issueType: 'Task',
  project: 'PERFTEST',
  team_key: 'PERFTEST',
  team: 'PERFTEST (synthetic)',
  summary: `ingest-bench synthetic ticket ${issueKey}`,
  points: 1,
  assignee: 'bench',
  displayName: 'Ingest Bench',
  agentCheck: '## synthetic\nwritten by tools/bench/ingest-bench.ts',
  status,
  action: 'create',
  timestamp: new Date().toISOString(),
  ...extra,
})

async function post(body: unknown, key: string | null = KEY): Promise<{ status: number; ms: number; json?: unknown }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (key !== null) headers['x-api-key'] = key
  const t0 = performance.now()
  const res = await fetch(`${BASE}/api/tickets`, { method: 'POST', headers, body: JSON.stringify(body) })
  const ms = performance.now() - t0
  return { status: res.status, ms, json: await res.json().catch(() => undefined) }
}

async function getAll(): Promise<{ rows: Array<{ issueKey: string; status: string }>; ms: number }> {
  const t0 = performance.now()
  const res = await fetch(`${BASE}/api/tickets?from=2026-01-01T00:00:00Z&to=2027-01-01T00:00:00Z`)
  const rows = await res.json() as Array<{ issueKey: string; status: string }>
  return { rows, ms: performance.now() - t0 }
}

function quantile(ns: number[], q: number): number {
  const s = [...ns].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]
}

let failures = 0
function check(label: string, ok: boolean, detail = ''): void {
  if (!ok) failures++
  console.log(`${ok ? '✓' : '✗ FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const before = await getAll()
  console.log(`baseline: ${before.rows.length} rows, GET ${before.ms.toFixed(0)}ms\n`)

  console.log('--- auth + schema gates ---')
  check('missing key → 401', (await post(ticket('PERFTEST-1', 'A'), null)).status === 401)
  check('wrong key → 401', (await post(ticket('PERFTEST-1', 'A'), 'wrong-key')).status === 401)
  check('bad issueKey pattern → 400', (await post(ticket('未知KEY' as string, 'A'))).status === 400)
  check('off-enum status → 400', (await post(ticket('PERFTEST-1', 'E'))).status === 400)

  console.log('\n--- upsert correctness + POST→visible ---')
  const t0 = performance.now()
  const created = await post(ticket('PERFTEST-9001', 'A'))
  check('create → 201', created.status === 201, `${created.ms.toFixed(0)}ms`)
  let g = await getAll()
  const visibleMs = performance.now() - t0
  const row = g.rows.find(r => r.issueKey === 'PERFTEST-9001')
  check('created row visible in GET', row?.status === 'A', `POST→visible ${visibleMs.toFixed(0)}ms`)

  const updated = await post(ticket('PERFTEST-9001', 'D', { action: 'update' }))
  check('same key again → 200 updated', updated.status === 200 && (updated.json as { result?: string })?.result === 'updated')
  g = await getAll()
  check('update reflected, no duplicate', g.rows.filter(r => r.issueKey === 'PERFTEST-9001').length === 1
    && g.rows.find(r => r.issueKey === 'PERFTEST-9001')?.status === 'D')
  check('row count = baseline + 1', g.rows.length === before.rows.length + 1, `${g.rows.length}`)

  console.log('\n--- burst: 50 sequential upserts (n8n batch) ---')
  const lat: number[] = []
  const statuses = ['A', 'B', 'C', 'D'] as const
  for (let i = 0; i < 50; i++) {
    const r = await post(ticket(`PERFTEST-${9100 + i}`, statuses[i % 4]))
    if (r.status !== 201 && r.status !== 200) check(`burst POST ${i}`, false, `HTTP ${r.status}`)
    lat.push(r.ms)
  }
  console.log(`POST latency: median ${quantile(lat, 0.5).toFixed(1)}ms, p95 ${quantile(lat, 0.95).toFixed(1)}ms, max ${Math.max(...lat).toFixed(1)}ms`)
  const after = await getAll()
  check('all burst rows landed', after.rows.length === before.rows.length + 51, `${after.rows.length} rows`)
  console.log(`GET after burst: ${after.ms.toFixed(0)}ms`)

  console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed.')
  process.exit(failures ? 1 : 0)
}

main()
