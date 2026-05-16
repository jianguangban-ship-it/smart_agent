import { describe, it, expect, beforeAll } from 'vitest'
import type { TicketBody } from '../schemas'

// In-memory SQLite — set before the (dynamic) import so db.ts picks it up.
process.env.QUALITY_DB_PATH = ':memory:'

let upsertTicket: typeof import('../db').upsertTicket
let listTickets: typeof import('../db').listTickets

beforeAll(async () => {
  const db = await import('../db')
  upsertTicket = db.upsertTicket
  listTickets = db.listTickets
})

function body(p: Partial<TicketBody>): TicketBody {
  return {
    issueKey: 'X-1', issueType: 'Story', project: 'IDC_PDSW',
    team_key: 'DKKF', team: 'Team', summary: 's', points: 1,
    assignee: 'u', displayName: 'U', agentCheck: 'c', status: 'A',
    action: 'create', timestamp: '2026-05-07T10:00:00Z', ...p,
  }
}

describe('listTickets — event_time range filter', () => {
  beforeAll(() => {
    upsertTicket(body({ issueKey: 'A-1', timestamp: '2026-05-01T10:00:00Z' }))
    upsertTicket(body({ issueKey: 'A-2', timestamp: '2026-05-10T10:00:00Z' }))
    upsertTicket(body({ issueKey: 'A-3', timestamp: '2026-05-20T10:00:00Z' }))
  })

  it('returns only rows within [from, to]', () => {
    const rows = listTickets({ from: '2026-05-05T00:00:00Z', to: '2026-05-15T00:00:00Z' })
    expect(rows.map(r => r.issue_key)).toEqual(['A-2'])
  })

  it('open-ended from returns everything at/after the bound', () => {
    const rows = listTickets({ from: '2026-05-10T00:00:00Z' })
    expect(rows.map(r => r.issue_key).sort()).toEqual(['A-2', 'A-3'])
  })

  it('no range returns all rows, newest-first', () => {
    const rows = listTickets()
    expect(rows.map(r => r.issue_key)).toEqual(['A-3', 'A-2', 'A-1'])
  })
})
