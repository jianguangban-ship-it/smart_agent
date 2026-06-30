import { ref } from 'vue'
import type { ProjectMatrixRow } from '@/config/projectMatrix'
import { runtimeProjectMatrix } from '@/composables/useRuntimeConfig'

// Client side of the Project-matrix editor. Mirrors useConfigWrite (Team): the
// whole matrix is gated by a single "projects" edit code the user types once
// ("unlock"). The validated code is kept in sessionStorage and re-sent on save;
// the server re-checks it (verifyTeamCode('projects', …) — a "projects" entry or
// the "*" master in team-codes.json). Intentionally low-value intranet PIN.

const STORAGE_KEY = 'projects_code'
const unlocked = ref(sessionStorage.getItem(STORAGE_KEY) !== null)

export function isProjectsUnlocked(): boolean {
  return unlocked.value
}

/** Validate the projects edit code with the server. */
export async function unlockProjects(code: string): Promise<boolean> {
  try {
    const res = await fetch('/api/config/projects/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
    if (!res.ok) return false
    sessionStorage.setItem(STORAGE_KEY, code)
    unlocked.value = true
    return true
  } catch {
    return false
  }
}

export function lockProjects(): void {
  sessionStorage.removeItem(STORAGE_KEY)
  unlocked.value = false
}

export interface ProjectSaveResult {
  ok: boolean
  status: number
}

/** Persist the whole matrix. On success, splices the result into the live ref. */
export async function saveProjectMatrix(rows: ProjectMatrixRow[]): Promise<ProjectSaveResult> {
  const code = sessionStorage.getItem(STORAGE_KEY)
  if (!code) return { ok: false, status: 401 }
  try {
    const res = await fetch('/api/config/projects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-team-code': code },
      body: JSON.stringify({ rows })
    })
    if (!res.ok) {
      if (res.status === 401) lockProjects() // stale code — force re-unlock
      return { ok: false, status: res.status }
    }
    const saved = await res.json() as { rows: ProjectMatrixRow[] }
    runtimeProjectMatrix.value = saved.rows
    return { ok: true, status: res.status }
  } catch {
    return { ok: false, status: 0 }
  }
}
