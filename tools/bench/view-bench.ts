// View-mode performance benchmark against a real quality DB (v10.192).
//
// Times the client-side hot paths that run on every filter change at the
// actual production row count, plus 10× synthetic scale for headroom:
//   - the filteredTickets predicate scan (useQualityGrid.ts)
//   - summarize()  → Mission Quality chips + Per-Team Trend matrix
//   - buildSeries() incl. predictSeries() → Quality Trend Modelling chart
//
// Run:  npx tsx tools/bench/view-bench.ts
// Reads data/quality.db (or QUALITY_DB_PATH) strictly read-only — never
// opens it writable, never creates WAL sidecars.

import Database from 'better-sqlite3'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rowToTicket, type TicketRow } from '../../server/db.js'
import { summarize } from '@/composables/useQualityGrid'
import { buildSeries } from '@/composables/useQualityModel'
import type { QualityTicket } from '@/types/quality'
import type { PhaseBucket } from '@/composables/useTimingPhase'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.QUALITY_DB_PATH ?? resolve(__dirname, '..', '..', 'data', 'quality.db')

const db = new Database(DB_PATH, { readonly: true })

// --- data profile ----------------------------------------------------------

const total = (db.prepare('SELECT COUNT(*) c FROM tickets').get() as { c: number }).c
const range = db.prepare('SELECT MIN(event_time) a, MAX(event_time) b FROM tickets').get() as { a: string; b: string }
const teams = (db.prepare('SELECT COUNT(DISTINCT team_key) c FROM tickets').get() as { c: number }).c
const blob = db.prepare('SELECT AVG(LENGTH(agent_check)) a, MAX(LENGTH(agent_check)) m FROM tickets').get() as { a: number; m: number }

console.log(`DB: ${DB_PATH}`)
console.log(`rows: ${total}  teams: ${teams}  range: ${range.a} → ${range.b}`)
console.log(`agent_check avg ${(blob.a / 1024).toFixed(2)}KB, max ${(blob.m / 1024).toFixed(1)}KB`)

// --- load tickets the way the server does (listTickets + rowToTicket) -------

const rows = db.prepare('SELECT * FROM tickets ORDER BY event_time DESC').all() as TicketRow[]
const tickets: QualityTicket[] = rows.map(rowToTicket)
const dataEnd = new Date(range.b)

// --- API payload weight (what GET /api/tickets ships, per window) -----------

const MS_PER_DAY = 86_400_000
function windowed(days: number): QualityTicket[] {
  const from = dataEnd.getTime() - days * MS_PER_DAY
  return tickets.filter(t => new Date(t.timestamp).getTime() >= from)
}
for (const [label, set] of [
  ['last 7d', windowed(7)],
  ['last 30d', windowed(30)],
  ['full history', tickets],
] as const) {
  const bytes = Buffer.byteLength(JSON.stringify(set))
  console.log(`payload ${label}: ${set.length} rows, ${(bytes / 1024).toFixed(0)}KB JSON`)
}

// --- bucket shapes matching useTimingPhase ----------------------------------

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function endOfDay(d: Date): Date { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }

function dailyBuckets(days: number): PhaseBucket[] {
  const out: PhaseBucket[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = startOfDay(new Date(dataEnd.getTime() - i * MS_PER_DAY))
    out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, from: d, to: endOfDay(d) })
  }
  return out
}
function weeklyBuckets(weeks: number): PhaseBucket[] {
  const out: PhaseBucket[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const from = startOfDay(new Date(dataEnd.getTime() - (i + 1) * 7 * MS_PER_DAY + MS_PER_DAY))
    const to = endOfDay(new Date(dataEnd.getTime() - i * 7 * MS_PER_DAY + 6 * MS_PER_DAY))
    out.push({ label: `${from.getMonth() + 1}/${from.getDate()}–${to.getMonth() + 1}/${to.getDate()}`, from, to })
  }
  return out
}

const shapes: Array<[string, PhaseBucket[]]> = [
  ['7 daily buckets   (Last 7 days)', dailyBuckets(7)],
  ['5 weekly buckets  (Last 30 days)', weeklyBuckets(5)],
  ['5 sprint buckets  (current PI)', weeklyBuckets(5).map((b, i) => ({ ...b, label: `S${i + 1}` }))],
]

// --- timing harness ----------------------------------------------------------

function median(ns: number[]): number {
  const s = [...ns].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
function bench(fn: () => unknown, iterations = 50): number {
  fn(); fn(); fn() // warm-up
  const samples: number[] = []
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now()
    fn()
    samples.push(performance.now() - t0)
  }
  return median(samples)
}

// The filteredTickets predicate from useQualityGrid.ts, replicated 1:1.
function filterScan(list: QualityTicket[], team: string, status: string, q: string): QualityTicket[] {
  return list.filter(t => {
    if (team && t.team_key !== team) return false
    if (status && t.status !== status) return false
    if (q) {
      const hay = `${t.summary} ${t.displayName} ${t.issueKey}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

function scaled(list: QualityTicket[], factor: number): QualityTicket[] {
  if (factor === 1) return list
  const out: QualityTicket[] = []
  for (let i = 0; i < factor; i++) out.push(...list)
  return out
}

console.log('\n--- compute hot paths (median of 50, ms) ---')
for (const factor of [1, 10]) {
  const set = scaled(tickets, factor)
  console.log(`\n[${factor}× scale = ${set.length} tickets]`)
  console.log(`filter scan (team+status+search): ${bench(() => filterScan(set, 'IDC_PMVBS', 'B', 'sensor')).toFixed(2)}ms`)
  for (const [label, bkts] of shapes) {
    const tSum = bench(() => summarize(set, bkts))
    const tSeries = bench(() => buildSeries(set, bkts))
    console.log(`${label}: summarize ${tSum.toFixed(2)}ms | buildSeries+predict ${tSeries.toFixed(2)}ms`)
  }
}

db.close()
console.log('\ndone.')
