// Source of truth: 2026-sprint-cadence-defintion-v2.1.0.html (Platform Dev Dept, 2025-11-11).
// Each sprint is a 14-day window starting Wed 09:00 and ending the second Tue 21:00.

export type SprintKey = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'DRP'

export interface SprintEntry {
  pi: number
  sprint: SprintKey
  /** Display name, e.g. "26 PI2 S4" */
  name: string
  start: Date
  end: Date
}

function mk(pi: number, sprint: SprintKey, startISO: string, endISO: string): SprintEntry {
  return {
    pi,
    sprint,
    name: `26 PI${pi} ${sprint}`,
    start: new Date(startISO),
    end: new Date(endISO),
  }
}

export const SPRINT_SCHEDULE: SprintEntry[] = [
  mk(1, 'S1',  '2025-12-17T09:00:00', '2025-12-30T21:00:00'),
  mk(1, 'S2',  '2025-12-31T09:00:00', '2026-01-13T21:00:00'),
  mk(1, 'S3',  '2026-01-14T09:00:00', '2026-01-27T21:00:00'),
  mk(1, 'S4',  '2026-01-28T09:00:00', '2026-02-10T21:00:00'),
  mk(1, 'S5',  '2026-02-11T09:00:00', '2026-02-24T21:00:00'),
  mk(1, 'S6',  '2026-02-25T09:00:00', '2026-03-10T21:00:00'),
  mk(1, 'DRP', '2026-03-11T09:00:00', '2026-03-24T21:00:00'),
  mk(2, 'S1',  '2026-03-25T09:00:00', '2026-04-07T21:00:00'),
  mk(2, 'S2',  '2026-04-08T09:00:00', '2026-04-21T21:00:00'),
  mk(2, 'S3',  '2026-04-22T09:00:00', '2026-05-05T21:00:00'),
  mk(2, 'S4',  '2026-05-06T09:00:00', '2026-05-19T21:00:00'),
  mk(2, 'S5',  '2026-05-20T09:00:00', '2026-06-02T21:00:00'),
  mk(2, 'DRP', '2026-06-03T09:00:00', '2026-06-16T21:00:00'),
  mk(3, 'S1',  '2026-06-17T09:00:00', '2026-06-30T21:00:00'),
  mk(3, 'S2',  '2026-07-01T09:00:00', '2026-07-14T21:00:00'),
  mk(3, 'S3',  '2026-07-15T09:00:00', '2026-07-28T21:00:00'),
  mk(3, 'S4',  '2026-07-29T09:00:00', '2026-08-11T21:00:00'),
  mk(3, 'S5',  '2026-08-12T09:00:00', '2026-08-25T21:00:00'),
  mk(3, 'S6',  '2026-08-26T09:00:00', '2026-09-08T21:00:00'),
  mk(3, 'DRP', '2026-09-09T09:00:00', '2026-09-22T21:00:00'),
  mk(4, 'S1',  '2026-09-23T09:00:00', '2026-10-06T21:00:00'),
  mk(4, 'S2',  '2026-10-07T09:00:00', '2026-10-20T21:00:00'),
  mk(4, 'S3',  '2026-10-21T09:00:00', '2026-11-03T21:00:00'),
  mk(4, 'S4',  '2026-11-04T09:00:00', '2026-11-17T21:00:00'),
  mk(4, 'S5',  '2026-11-18T09:00:00', '2026-12-01T21:00:00'),
  mk(4, 'DRP', '2026-12-02T09:00:00', '2026-12-15T21:00:00'),
]

// First and last instants of the published schedule.
export const SCHEDULE_FIRST_START = SPRINT_SCHEDULE[0].start
export const SCHEDULE_LAST_END = SPRINT_SCHEDULE[SPRINT_SCHEDULE.length - 1].end

/**
 * Find the sprint containing `now`. A sprint owns the half-open window
 * [start, nextStart) so the 12-hour overnight gap between sprints is
 * attributed to the sprint that just ended. Returns null if `now` is
 * outside the published 2026 schedule.
 */
export function findSprintAt(now: Date): SprintEntry | null {
  const t = now.getTime()
  if (t < SCHEDULE_FIRST_START.getTime()) return null
  if (t > SCHEDULE_LAST_END.getTime()) return null
  for (let i = 0; i < SPRINT_SCHEDULE.length; i++) {
    const entry = SPRINT_SCHEDULE[i]
    const next = SPRINT_SCHEDULE[i + 1]
    const upper = next ? next.start.getTime() : entry.end.getTime() + 1
    if (t >= entry.start.getTime() && t < upper) return entry
  }
  return null
}

export function getNextSprint(entry: SprintEntry): SprintEntry | null {
  const idx = SPRINT_SCHEDULE.indexOf(entry)
  if (idx < 0 || idx >= SPRINT_SCHEDULE.length - 1) return null
  return SPRINT_SCHEDULE[idx + 1]
}

export function getPreviousSprint(entry: SprintEntry): SprintEntry | null {
  const idx = SPRINT_SCHEDULE.indexOf(entry)
  if (idx <= 0) return null
  return SPRINT_SCHEDULE[idx - 1]
}

/** All sprints in a Planning Interval, schedule order (S1…S6/DRP). */
export function sprintsInPI(pi: number): SprintEntry[] {
  return SPRINT_SCHEDULE.filter(s => s.pi === pi)
}

/**
 * Parse a project name (e.g. "IDC_PDSW") into the cadence department prefix
 * and team-code suffix used by the cadence string. Rule (per v10.89):
 *   1. Project name must start with "IDC_" (the corporate JIRA project prefix).
 *   2. Strip "IDC_" and split: first 2 chars = department, remainder = team.
 *   3. Both pieces must be non-empty.
 * Returns null if the name doesn't fit the pattern (e.g. empty, missing prefix,
 * or remainder shorter than 3 chars).
 *
 * Examples:
 *   "IDC_PDSW"  → { dept: "PD",  team: "SW"  }
 *   "IDC_PDHW"  → { dept: "PD",  team: "HW"  }
 *   "IDC_ADSIM" → { dept: "AD",  team: "SIM" }
 *   "IDC_PMVSS" → { dept: "PM",  team: "VSS" }
 *   "HW"        → null
 */
export function parseProjectCadence(projectName: string): { dept: string; team: string } | null {
  if (!projectName || !projectName.startsWith('IDC_')) return null
  const rest = projectName.slice(4)
  if (rest.length < 3) return null
  const dept = rest.slice(0, 2)
  const team = rest.slice(2)
  if (!dept || !team) return null
  return { dept, team }
}

/**
 * Build the full cadence string from the current sprint and the selected
 * Agile Team's project name. Falls back to `PD_26PI<N>_<Sprint>` (no team
 * suffix) if the project name is empty or doesn't fit the IDC_<dept><team>
 * pattern — keeps the indicator useful even before the user picks a team.
 */
export function getCadenceString(entry: SprintEntry | null, projectName: string): string {
  if (!entry) return ''
  const parsed = parseProjectCadence(projectName)
  if (!parsed) return `PD_26PI${entry.pi}_${entry.sprint}`
  return `${parsed.dept}_26PI${entry.pi}_${entry.sprint}_${parsed.team}`
}
