import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import {
  verifyTeamCode, isTeamMemberArray, isStringArray, saveTeam, type TeamMember,
  isProjectMatrixArray, saveProjectMatrix, duplicateComposites, type ProjectMatrixRow
} from '../config-store.js'
import { audit } from '../logs/log-bus.js'

// Single gate key for the whole Project matrix (it isn't per-team). Reuses the
// team-codes.json mechanism: a "projects" entry, or the "*" ops master.
const PROJECTS_GATE = 'projects'

// The Team-page editor (Config mode) writes here. Network is open on the
// intranet; the gate is per-team: the caller must supply that team's edit code.
// A code authorizes ONLY its own team's roster + components — a person with
// HW's code cannot touch DKKF, because every write re-checks the code against
// :key and only that key is spliced into the full map.
export async function configRoutes(app: FastifyInstance) {
  // POST /api/config/team/:key/unlock — UX pre-check that reveals the editor.
  // Real enforcement is on the PUT below, so this is intentionally simple.
  // Generic 401 — don't leak whether a team has a code configured.
  app.post<{ Params: { key: string }; Body: { code?: string } }>(
    '/config/team/:key/unlock',
    async (req, reply) => {
      const ok = verifyTeamCode(req.params.key, req.body?.code)
      audit(req.log, 'team.unlock', {
        source: 'ui', ip: req.ip, team_key: req.params.key,
        msg: `team ${req.params.key} unlock ${ok ? 'ok' : 'rejected'}`,
        detail: { ok }
      })
      if (!ok) {
        reply.code(401).send({ error: 'auth' })
        return
      }
      reply.send({ ok: true })
    }
  )

  // PUT /api/config/team/:key — header x-team-code; body { members, components }.
  // onRequest gate (mirrors tickets.ts) so a bad code 401s before body schema
  // could turn it into a 400.
  app.put<{ Params: { key: string }; Body: { members?: unknown; components?: unknown } }>(
    '/config/team/:key',
    {
      onRequest: async (req: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) => {
        const code = req.headers['x-team-code']
        if (!verifyTeamCode(req.params.key, code)) {
          reply.code(401).send({ error: 'auth' })
        }
      }
    },
    async (req, reply) => {
      const { members, components } = req.body ?? {}
      if (!isTeamMemberArray(members) || !isStringArray(components)) {
        reply.code(400).send({ error: 'validation' })
        return
      }
      // Reject duplicate ids within the team (the UI guards this too).
      const ids = new Set<string>()
      for (const m of members as TeamMember[]) {
        if (ids.has(m.id)) {
          reply.code(400).send({ error: 'validation', detail: `duplicate id ${m.id}` })
          return
        }
        ids.add(m.id)
      }
      const saved = saveTeam(req.params.key, members as TeamMember[], components as string[])
      const names = (list: { name: string }[]) => list.map(m => m.name).join(', ')
      const addPart = saved.added.length ? ` +${saved.added.length} (${names(saved.added)})` : ''
      const remPart = saved.removed.length ? ` −${saved.removed.length} (${names(saved.removed)})` : ''
      audit(req.log, 'team.save', {
        source: 'ui', ip: req.ip, team_key: req.params.key,
        msg: `team ${req.params.key} saved ·${addPart}${remPart} · ${saved.components.length} components`,
        detail: { added: saved.added, removed: saved.removed, memberCount: saved.members.length, componentCount: saved.components.length }
      })
      reply.send(saved)
    }
  )

  // POST /api/config/projects/unlock — UX pre-check for the Project matrix editor.
  app.post<{ Body: { code?: string } }>(
    '/config/projects/unlock',
    async (req, reply) => {
      const ok = verifyTeamCode(PROJECTS_GATE, req.body?.code)
      audit(req.log, 'projects.unlock', {
        source: 'ui', ip: req.ip,
        msg: `projects unlock ${ok ? 'ok' : 'rejected'}`,
        detail: { ok }
      })
      if (!ok) {
        reply.code(401).send({ error: 'auth' })
        return
      }
      reply.send({ ok: true })
    }
  )

  // PUT /api/config/projects — header x-team-code; body { rows }. onRequest gate
  // mirrors the team route (401 before body schema could 400).
  app.put<{ Body: { rows?: unknown } }>(
    '/config/projects',
    {
      onRequest: async (req: FastifyRequest, reply: FastifyReply) => {
        const code = req.headers['x-team-code']
        if (!verifyTeamCode(PROJECTS_GATE, code)) {
          reply.code(401).send({ error: 'auth' })
        }
      }
    },
    async (req, reply) => {
      const { rows } = req.body ?? {}
      if (!isProjectMatrixArray(rows)) {
        reply.code(400).send({ error: 'validation' })
        return
      }
      // Composite codes must be unique (server-side guard mirroring the editor).
      const dups = duplicateComposites(rows as ProjectMatrixRow[])
      if (dups.length > 0) {
        reply.code(400).send({ error: 'duplicate', detail: dups })
        return
      }
      const saved = saveProjectMatrix(rows as ProjectMatrixRow[])
      const codes = (list: string[]) => list.join(', ')
      const addPart = saved.added.length ? ` +${saved.added.length} (${codes(saved.added)})` : ''
      const remPart = saved.removed.length ? ` −${saved.removed.length} (${codes(saved.removed)})` : ''
      audit(req.log, 'projects.save', {
        source: 'ui', ip: req.ip,
        msg: `projects matrix saved ·${addPart}${remPart} · ${saved.rows.length} rows`,
        detail: { added: saved.added, removed: saved.removed, rowCount: saved.rows.length }
      })
      reply.send(saved)
    }
  )
}
