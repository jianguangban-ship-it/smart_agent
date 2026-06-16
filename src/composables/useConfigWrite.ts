import { reactive } from 'vue'
import type { TeamMember } from '@/types/team'
import { runtimeTeamMembers, runtimeComponentsByProject } from '@/composables/useRuntimeConfig'

// Client side of the per-team config editor. Network is open on the intranet;
// editing is gated per team by a code the user types once ("unlock"). We keep
// the validated code in sessionStorage (per team) and re-send it on save — the
// server re-checks it. Codes are low-value per-team edit PINs; sessionStorage
// clears on tab close. Hardening (hash + signed token) is a future option.

const STORAGE_PREFIX = 'team_code_'

// Reactive set of currently-unlocked team keys (drives the editor's locked UI).
const unlockedKeys = reactive<Set<string>>(new Set())

// Re-hydrate unlock state from sessionStorage on module load (survives a Config
// → Explore → Config round-trip within the same tab).
for (let i = 0; i < sessionStorage.length; i++) {
  const k = sessionStorage.key(i)
  if (k?.startsWith(STORAGE_PREFIX)) unlockedKeys.add(k.slice(STORAGE_PREFIX.length))
}

export function isUnlocked(key: string): boolean {
  return unlockedKeys.has(key)
}

// ── Cross-team "Move to" queue ──────────────────────────────────────────────
// Moving a member spans two teams, each gated by its own code. So a move is
// realized in two steps: it's removed from the source draft immediately, and an
// "incoming" entry is queued for the target. When the target team is opened its
// draft merges these in (highlighted); saving the target persists them and
// clears the queue. Module-scoped so it survives switching teams in a session.
const pendingMoves = reactive<Record<string, TeamMember[]>>({})

export function queueMove(toKey: string, member: TeamMember): void {
  const list = pendingMoves[toKey] ?? (pendingMoves[toKey] = [])
  if (!list.some(m => m.id === member.id)) list.push({ ...member })
}

export function getPendingMoves(toKey: string): TeamMember[] {
  return pendingMoves[toKey] ?? []
}

export function clearPendingMoves(toKey: string): void {
  delete pendingMoves[toKey]
}

export function pendingMoveCount(toKey: string): number {
  return pendingMoves[toKey]?.length ?? 0
}

function storedCode(key: string): string | null {
  return sessionStorage.getItem(STORAGE_PREFIX + key)
}

/** Validate a team code with the server. On success the team becomes editable. */
export async function unlockTeam(key: string, code: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/config/team/${encodeURIComponent(key)}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
    if (!res.ok) return false
    sessionStorage.setItem(STORAGE_PREFIX + key, code)
    unlockedKeys.add(key)
    return true
  } catch {
    return false
  }
}

export function lockTeam(key: string): void {
  sessionStorage.removeItem(STORAGE_PREFIX + key)
  unlockedKeys.delete(key)
}

export interface SaveResult {
  ok: boolean
  status: number
  members?: TeamMember[]
  components?: string[]
}

/**
 * Persist a team's roster + components. On success, splices the result into the
 * live runtime refs (new object identity so consumers re-render) so the Assignee
 * dropdown / component datalist update without a reload.
 */
export async function saveTeam(
  key: string,
  members: TeamMember[],
  components: string[]
): Promise<SaveResult> {
  const code = storedCode(key)
  if (!code) return { ok: false, status: 401 }
  try {
    const res = await fetch(`/api/config/team/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-team-code': code },
      body: JSON.stringify({ members, components })
    })
    if (!res.ok) {
      if (res.status === 401) lockTeam(key) // stale code — force re-unlock
      return { ok: false, status: res.status }
    }
    const saved = await res.json() as { members: TeamMember[]; components: string[] }
    runtimeTeamMembers.value = { ...runtimeTeamMembers.value, [key]: saved.members }
    runtimeComponentsByProject.value = { ...runtimeComponentsByProject.value, [key]: saved.components }
    clearPendingMoves(key) // any incoming members are now persisted into this team
    return { ok: true, status: res.status, members: saved.members, components: saved.components }
  } catch {
    return { ok: false, status: 0 }
  }
}
