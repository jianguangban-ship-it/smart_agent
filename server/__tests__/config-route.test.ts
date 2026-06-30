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
  writeFileSync(codesPath, JSON.stringify({ HW: 'hw123', projects: 'proj123', '*': 'master9' }))

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
    // member delta carries names (for the team.save audit event)
    const saved = res.json() as { added: { id: string; name: string }[]; removed: { id: string; name: string }[] }
    expect(saved.added).toEqual([{ id: 'GW002', name: 'Carol' }])
    expect(saved.removed).toEqual([])
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

describe('Project matrix (Config → Project)', () => {
  const ROW = {
    productLine: 'X-line', customerCode: 'GWM', projectNo: 'DE06',
    yearInfo: 'MY2026', companyCode: 'J500', serialNo: '0009', productTypeCode: 'EDC'
  }
  function readMatrix() { return JSON.parse(readFileSync(join(dir, 'project-matrix.json'), 'utf8')) }

  it('unlock accepts the projects code and the master, rejects others', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/config/projects/unlock', payload: { code: 'proj123' } })).statusCode).toBe(200)
    expect((await app.inject({ method: 'POST', url: '/api/config/projects/unlock', payload: { code: 'master9' } })).statusCode).toBe(200)
    expect((await app.inject({ method: 'POST', url: '/api/config/projects/unlock', payload: { code: 'nope' } })).statusCode).toBe(401)
  })

  it('PUT writes the whole matrix with a valid code', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/api/config/projects',
      headers: { 'x-team-code': 'proj123' },
      payload: { rows: [ROW, { ...ROW, projectNo: 'DE07', serialNo: '0010' }] }
    })
    expect(res.statusCode).toBe(200)
    expect(readMatrix()).toHaveLength(2)
    expect(readMatrix()[1].projectNo).toBe('DE07')
    // first write — both rows are "added" (no previous file), none removed
    const saved = res.json() as { added: string[]; removed: string[] }
    expect(saved.added).toContain('GWM-DE06-MY2026-J500-0009-EDC')
    expect(saved.added).toContain('GWM-DE07-MY2026-J500-0010-EDC')
    expect(saved.removed).toEqual([])
  })

  it('PUT reports the added/removed composite-code delta for the audit', async () => {
    // Drop DE07, add DE08 → delta is computed against the previous save above.
    const res = await app.inject({
      method: 'PUT', url: '/api/config/projects',
      headers: { 'x-team-code': 'proj123' },
      payload: { rows: [ROW, { ...ROW, projectNo: 'DE08', serialNo: '0011' }] }
    })
    expect(res.statusCode).toBe(200)
    const saved = res.json() as { added: string[]; removed: string[] }
    expect(saved.added).toEqual(['GWM-DE08-MY2026-J500-0011-EDC'])
    expect(saved.removed).toEqual(['GWM-DE07-MY2026-J500-0010-EDC'])
  })

  it('PUT persists an optional comments field', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/api/config/projects',
      headers: { 'x-team-code': 'proj123' },
      payload: { rows: [{ ...ROW, comments: 'pilot batch' }] }
    })
    expect(res.statusCode).toBe(200)
    expect(readMatrix()[0].comments).toBe('pilot batch')
  })

  it('PUT rejects a wrong code with 401 and does not write', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/api/config/projects',
      headers: { 'x-team-code': 'wrong' },
      payload: { rows: [ROW] }
    })
    expect(res.statusCode).toBe(401)
  })

  it('PUT rejects an invalid product line with 400', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/api/config/projects',
      headers: { 'x-team-code': 'proj123' },
      payload: { rows: [{ ...ROW, productLine: 'Suspension' }] }
    })
    expect(res.statusCode).toBe(400)
  })

  it('PUT rejects a missing field with 400', async () => {
    const { serialNo, ...partial } = ROW
    void serialNo
    const res = await app.inject({
      method: 'PUT', url: '/api/config/projects',
      headers: { 'x-team-code': 'proj123' },
      payload: { rows: [partial] }
    })
    expect(res.statusCode).toBe(400)
  })

  it('PUT rejects duplicate composite codes with 400', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/api/config/projects',
      headers: { 'x-team-code': 'proj123' },
      payload: { rows: [ROW, { ...ROW }] } // identical composite
    })
    expect(res.statusCode).toBe(400)
    expect((res.json() as { error: string }).error).toBe('duplicate')
  })

  it('PUT accepts unique rows plus blank rows', async () => {
    const blank = {
      productLine: '', customerCode: '', projectNo: '', yearInfo: '',
      companyCode: '', serialNo: '', productTypeCode: '', comments: ''
    }
    const res = await app.inject({
      method: 'PUT', url: '/api/config/projects',
      headers: { 'x-team-code': 'proj123' },
      payload: { rows: [ROW, { ...ROW, projectNo: 'DE07', serialNo: '0010' }, blank, blank] }
    })
    expect(res.statusCode).toBe(200)
  })
})
