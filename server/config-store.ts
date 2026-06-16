// Read/write/validate the web-served runtime config JSON files, plus the
// per-team edit-code gate. Kept separate from the route so the route stays thin
// and this stays unit-testable.
//
// Where things live:
//   CONFIG_DIR  — the web-served config dir we write into. In prod the compose
//                 volume mounts the host's editable store at /app/dist/config,
//                 so writing team-members.json there persists on the host. In
//                 `dev:all` (no build) dist/ is absent and Vite serves
//                 public/config — so we default there. Override per env.
//   CODES_PATH  — team-codes.json. MUST NOT be web-served (it gates writes), so
//                 it lives in the data volume (/app/data) alongside the SQLite
//                 db, NOT under dist/config. Read fresh per request so ops can
//                 edit codes without a restart.
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, copyFileSync, readdirSync, unlinkSync
} from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

export interface TeamMember {
  id: string
  name: string
  role?: string
}

function resolveConfigDir(): string {
  if (process.env.SMART_AGENT_CONFIG_DIR) return resolve(process.env.SMART_AGENT_CONFIG_DIR)
  const dist = join(ROOT, 'dist', 'config')
  const pub = join(ROOT, 'public', 'config')
  // Prod (Docker sets NODE_ENV=production) serves the SPA from dist/ and mounts
  // the editable volume at dist/config — write there.
  if (process.env.NODE_ENV === 'production') return dist
  // Dev: Vite serves /config from public/config, so a stale dist/ left over from
  // an earlier `npm run build` must NOT capture writes (the edit would never show
  // on reload). Prefer public; fall back to dist only if public is absent.
  if (existsSync(pub)) return pub
  return dist
}

function resolveCodesPath(): string {
  if (process.env.TEAM_CODES_PATH) return resolve(process.env.TEAM_CODES_PATH)
  const dbPath = process.env.QUALITY_DB_PATH ?? resolve(ROOT, 'data', 'quality.db')
  return join(dirname(dbPath), 'team-codes.json')
}

export const CONFIG_DIR = resolveConfigDir()
export const CODES_PATH = resolveCodesPath()

const MEMBERS_FILE = 'team-members.json'
const COMPONENTS_FILE = 'components.json'
const BACKUP_DIR = resolve(CONFIG_DIR, '..', 'backups')
const MAX_BACKUPS = 10

// ── JSON read / atomic write ────────────────────────────────────────────────
export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(CONFIG_DIR, file), 'utf8')) as T
}

export function writeJsonAtomic(file: string, data: unknown): void {
  const target = join(CONFIG_DIR, file)
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8')
  renameSync(tmp, target)
}

// Copy the current file aside before we overwrite it. Backups go OUTSIDE the
// web root so rosters aren't double-exposed, and we keep only the newest few.
function backup(file: string): void {
  const src = join(CONFIG_DIR, file)
  if (!existsSync(src)) return
  mkdirSync(BACKUP_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  copyFileSync(src, join(BACKUP_DIR, `${file}.${ts}.bak`))
  const mine = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith(`${file}.`) && f.endsWith('.bak'))
    .sort()
  for (const old of mine.slice(0, Math.max(0, mine.length - MAX_BACKUPS))) {
    try { unlinkSync(join(BACKUP_DIR, old)) } catch { /* best-effort prune */ }
  }
}

// ── Per-team code gate ──────────────────────────────────────────────────────
// team-codes.json shape: { "HW": "hw123", "*": "ops-master" }. A team with no
// entry (and no "*" master) is LOCKED — no code can unlock it. Plaintext is
// intentional: ops-managed file, intranet-only, low-value per-team edit PIN.
export function verifyTeamCode(key: string, code: unknown): boolean {
  if (typeof code !== 'string' || code.length === 0) return false
  let codes: Record<string, unknown>
  try {
    codes = JSON.parse(readFileSync(CODES_PATH, 'utf8')) as Record<string, unknown>
  } catch {
    return false // missing/unreadable codes file ⇒ everything locked
  }
  if (!codes || typeof codes !== 'object') return false
  if (typeof codes[key] === 'string' && code === codes[key]) return true
  if (typeof codes['*'] === 'string' && code === codes['*']) return true
  return false
}

// ── Validators ──────────────────────────────────────────────────────────────
export function isTeamMemberArray(v: unknown): v is TeamMember[] {
  return Array.isArray(v) && v.every(m =>
    m && typeof m === 'object' &&
    typeof (m as TeamMember).id === 'string' && (m as TeamMember).id.length > 0 &&
    typeof (m as TeamMember).name === 'string' && (m as TeamMember).name.length > 0 &&
    ((m as TeamMember).role === undefined || typeof (m as TeamMember).role === 'string')
  )
}

export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(x => typeof x === 'string')
}

// ── The one mutation the route needs ────────────────────────────────────────
// Splice this team's roster + components into the two full maps and persist
// both. Returns what was written so the client can sync its live refs.
export function saveTeam(
  key: string,
  members: TeamMember[],
  components: string[]
): { members: TeamMember[]; components: string[] } {
  const membersMap = readJson<Record<string, TeamMember[]>>(MEMBERS_FILE)
  const componentsMap = readJson<Record<string, string[]>>(COMPONENTS_FILE)

  backup(MEMBERS_FILE)
  membersMap[key] = members
  writeJsonAtomic(MEMBERS_FILE, membersMap)

  backup(COMPONENTS_FILE)
  componentsMap[key] = components
  writeJsonAtomic(COMPONENTS_FILE, componentsMap)

  return { members, components }
}
