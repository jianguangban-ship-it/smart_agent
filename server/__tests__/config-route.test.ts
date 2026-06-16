import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// config-store resolves CONFIG_DIR / CODES_PATH from env at module load, so we
// must set them BEFORE importing the route. A temp dir gives each run a clean,
// real filesystem to assert backups + atomic writes against.
let dir: string
let codesPath: string
let app: FastifyInstance

const MEMBERS = {
  HW: [{ id: 'GW001', name: 'Alice', role: 'Engineer' }],
  DKKF: [{ id: 'GW900', name: 'Bob', role: 'SW Engineer' }]
}
const COMPONENTS = {
  HW: ['PIU', 'MCU'],
  DKKF: ['MCAL']
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cfg-'))
  codesPath = join(dir, 'team-codes.json')
  writeFileSync(join(dir, 'team-members.json'), JSON.stringify(MEMBERS, null, 2))
  writeFileSync(join(dir, 'components.json'), JSON.stringify(COMPONENTS, null, 2))
  writeFileSync(codesPath, JSON.stringify({ HW: 'hw123', '*': 'master9' }))

  process.env.SMART_AGENT_CONFIG_DIR = dir
  process.env.TEAM_CODES_PATH = codesPath

  const { configRoutes } = await import('../routes/config.js')
  app = Fastify()
  await app.register(configRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
  rmSync(dir, { recursive: true, force: true })
  rmSync(join(dir, '..', 'backups'), { recursive: true, force: true }) // store writes here
})

function readMembers() { return JSON.parse(readFileSync(join(dir, 'team-members.json'), 'utf8')) }
function readComponents() { return JSON.parse(readFileSync(join(dir, 'components.json'), 'utf8')) }

describe('POST /api/config/team/:key/unlock', () => {
  it('accepts the team code', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/config/team/HW/unlock', payload: { code: 'hw123' } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })

  it('accepts the master code for any team', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/config/team/DKKF/unlock', payload: { code: 'master9' } })
    expect(res.statusCode).toBe(200)
  })

  it('rejects a wrong code', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/config/team/HW/unlock', payload: { code: 'nope' } })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a team with no configured code', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/config/team/DKKF/unlock', payload: { code: 'hw123' } })
    expect(res.statusCode).toBe(401)
  })
})

describe('PUT /api/config/team/:key', () => {
  it('writes only the target team and leaves others untouched', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config/team/HW',
      headers: { 'x-team-code': 'hw123' },
      payload: { members: [{ id: 'GW001', name: 'Alice Chen', role: 'Sr. Engineer' }, { id: 'GW002', name: 'Carol' }], components: ['PIU', 'MCU', 'CSU'] }
    })
    expect(res.statusCode).toBe(200)
    const members = readMembers()
    expect(members.HW).toHaveLength(2)
    expect(members.HW[0].name).toBe('Alice Chen')
    expect(members.DKKF).toEqual(MEMBERS.DKKF) // untouched
    expect(readComponents().HW).toEqual(['PIU', 'MCU', 'CSU'])
    expect(readComponents().DKKF).toEqual(['MCAL'])
  })

  it('writes a timestamped backup before overwriting', async () => {
    // The store backs up to CONFIG_DIR/../backups. The previous test triggered a
    // write, so a backup of the pre-write file must now exist there.
    const backupDir = join(dir, '..', 'backups')
    expect(existsSync(backupDir)).toBe(true)
    expect(readdirSync(backupDir).some(f => f.startsWith('team-members.json.') && f.endsWith('.bak'))).toBe(true)
  })

  it('rejects a wrong code and does not touch the file', async () => {
    const before = readFileSync(join(dir, 'team-members.json'), 'utf8')
    const res = await app.inject({
      method: 'PUT', url: '/api/config/team/HW',
      headers: { 'x-team-code': 'wrong' },
      payload: { members: [], components: [] }
    })
    expect(res.statusCode).toBe(401)
    expect(readFileSync(join(dir, 'team-members.json'), 'utf8')).toBe(before)
  })

  it('rejects an invalid body shape with 400', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/api/config/team/HW',
      headers: { 'x-team-code': 'hw123' },
      payload: { members: [{ id: 'x' }], components: ['ok'] } // missing name
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects duplicate ids with 400', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/api/config/team/HW',
      headers: { 'x-team-code': 'hw123' },
      payload: { members: [{ id: 'D1', name: 'A' }, { id: 'D1', name: 'B' }], components: [] }
    })
    expect(res.statusCode).toBe(400)
  })
})
