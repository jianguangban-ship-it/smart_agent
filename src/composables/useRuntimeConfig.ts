import { ref, type Ref } from 'vue'
import type { ProjectConfig, TeamMember } from '@/types/team'
import { PROJECT_CONFIG as FALLBACK_PROJECTS, TEAM_MEMBERS as FALLBACK_MEMBERS } from '@/config/projects'
import {
  PROJECT_MATRIX_FALLBACK, PRODUCT_LINE_OPTIONS, type ProjectMatrixRow
} from '@/config/projectMatrix'
import {
  VEHICLE_OPTIONS as FALLBACK_VEHICLES,
  PRODUCT_OPTIONS as FALLBACK_PRODUCTS,
  LAYER_OPTIONS as FALLBACK_LAYERS,
  DEFAULT_COMPONENTS_BY_PROJECT as FALLBACK_COMPONENTS_BY_PROJECT
} from '@/config/constants'

export interface SummaryOptions {
  vehicles: string[]
  products: string[]
  layers: string[]
}

export type ComponentsByProject = Record<string, string[]>

export type ConfigFileKey = 'projects' | 'team' | 'summary' | 'components' | 'projectMatrix'
export type ConfigFileStatus = 'pending' | 'runtime' | 'fallback' | 'invalid'

const projects = ref<ProjectConfig[]>([...FALLBACK_PROJECTS])
const teamMembers = ref<Record<string, TeamMember[]>>({ ...FALLBACK_MEMBERS })
const summaryOptions = ref<SummaryOptions>({
  vehicles: [...FALLBACK_VEHICLES],
  products: [...FALLBACK_PRODUCTS],
  layers: [...FALLBACK_LAYERS]
})
const componentsByProject = ref<ComponentsByProject>({ ...FALLBACK_COMPONENTS_BY_PROJECT })
const projectMatrix = ref<ProjectMatrixRow[]>([...PROJECT_MATRIX_FALLBACK])
const configLoaded = ref(false)
const configStatus = ref<Record<ConfigFileKey, ConfigFileStatus>>({
  projects: 'pending',
  team: 'pending',
  summary: 'pending',
  components: 'pending',
  projectMatrix: 'pending'
})

interface FetchResult<T> {
  data: T | null
  reason: string | null
}

async function fetchJsonWithReason<T>(url: string): Promise<FetchResult<T>> {
  try {
    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) return { data: null, reason: `HTTP ${res.status}` }
    const data = await res.json() as T
    return { data, reason: null }
  } catch (err) {
    return { data: null, reason: err instanceof Error ? err.message : 'fetch error' }
  }
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(x => typeof x === 'string')
}

function validateProjects(data: unknown): data is ProjectConfig[] {
  if (!Array.isArray(data)) return false
  return data.every(p =>
    p && typeof p === 'object' &&
    typeof (p as ProjectConfig).name === 'string' &&
    typeof (p as ProjectConfig).key === 'string' &&
    typeof (p as ProjectConfig).teamName === 'string'
  )
}

function validateTeamMembers(data: unknown): data is Record<string, TeamMember[]> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  return Object.values(data as Record<string, unknown>).every(list =>
    Array.isArray(list) &&
    list.every(m =>
      m && typeof m === 'object' &&
      typeof (m as TeamMember).id === 'string' &&
      typeof (m as TeamMember).name === 'string'
    )
  )
}

function validateSummaryOptions(data: unknown): data is SummaryOptions {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return isStringArray(d.vehicles) && isStringArray(d.products) && isStringArray(d.layers)
}

function validateComponentsByProject(data: unknown): data is ComponentsByProject {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  return Object.values(data as Record<string, unknown>).every(isStringArray)
}

const PRODUCT_LINE_SET = new Set<string>([...PRODUCT_LINE_OPTIONS, ''])
const PROJECT_MATRIX_FIELDS = ['customerCode', 'projectNo', 'yearInfo', 'companyCode', 'serialNo', 'productTypeCode']
function validateProjectMatrix(data: unknown): data is ProjectMatrixRow[] {
  if (!Array.isArray(data)) return false
  return data.every(r => {
    if (!r || typeof r !== 'object') return false
    const row = r as Record<string, unknown>
    if (typeof row.productLine !== 'string' || !PRODUCT_LINE_SET.has(row.productLine)) return false
    if (row.comments !== undefined && typeof row.comments !== 'string') return false
    return PROJECT_MATRIX_FIELDS.every(f => typeof row[f] === 'string')
  })
}

function warn(file: string, reason: string) {
  console.warn(`[runtime-config] /config/${file}: ${reason} — using fallback`)
}

export async function loadRuntimeConfig(): Promise<void> {
  const cacheBust = `?v=${Date.now()}`
  const [projRes, teamRes, summRes, compRes, matrixRes] = await Promise.all([
    fetchJsonWithReason<unknown>(`/config/projects.json${cacheBust}`),
    fetchJsonWithReason<unknown>(`/config/team-members.json${cacheBust}`),
    fetchJsonWithReason<unknown>(`/config/summary-options.json${cacheBust}`),
    fetchJsonWithReason<unknown>(`/config/components.json${cacheBust}`),
    fetchJsonWithReason<unknown>(`/config/project-matrix.json${cacheBust}`)
  ])

  if (projRes.data === null) {
    warn('projects.json', projRes.reason || 'fetch failed')
    configStatus.value.projects = 'fallback'
  } else if (validateProjects(projRes.data)) {
    projects.value = projRes.data
    configStatus.value.projects = 'runtime'
  } else {
    warn('projects.json', 'invalid shape (expect ProjectConfig[])')
    configStatus.value.projects = 'invalid'
  }

  if (teamRes.data === null) {
    warn('team-members.json', teamRes.reason || 'fetch failed')
    configStatus.value.team = 'fallback'
  } else if (validateTeamMembers(teamRes.data)) {
    teamMembers.value = teamRes.data
    configStatus.value.team = 'runtime'
  } else {
    warn('team-members.json', 'invalid shape (expect Record<projectKey, TeamMember[]>)')
    configStatus.value.team = 'invalid'
  }

  if (summRes.data === null) {
    warn('summary-options.json', summRes.reason || 'fetch failed')
    configStatus.value.summary = 'fallback'
  } else if (validateSummaryOptions(summRes.data)) {
    summaryOptions.value = summRes.data
    configStatus.value.summary = 'runtime'
  } else {
    warn('summary-options.json', 'invalid shape (expect { vehicles, products, layers })')
    configStatus.value.summary = 'invalid'
  }

  if (compRes.data === null) {
    warn('components.json', compRes.reason || 'fetch failed')
    configStatus.value.components = 'fallback'
  } else if (validateComponentsByProject(compRes.data)) {
    componentsByProject.value = compRes.data
    configStatus.value.components = 'runtime'
  } else {
    warn('components.json', 'invalid shape (expect Record<projectKey, string[]>)')
    configStatus.value.components = 'invalid'
  }

  if (matrixRes.data === null) {
    warn('project-matrix.json', matrixRes.reason || 'fetch failed')
    configStatus.value.projectMatrix = 'fallback'
  } else if (validateProjectMatrix(matrixRes.data)) {
    projectMatrix.value = matrixRes.data
    configStatus.value.projectMatrix = 'runtime'
  } else {
    warn('project-matrix.json', 'invalid shape (expect ProjectMatrixRow[])')
    configStatus.value.projectMatrix = 'invalid'
  }

  configLoaded.value = true
  const s = configStatus.value
  console.info(
    `[runtime-config] loaded: projects=${s.projects}, team=${s.team}, summary=${s.summary}, components=${s.components}, projectMatrix=${s.projectMatrix}`
  )
}

export const runtimeProjects: Ref<ProjectConfig[]> = projects
export const runtimeTeamMembers: Ref<Record<string, TeamMember[]>> = teamMembers
export const runtimeSummaryOptions: Ref<SummaryOptions> = summaryOptions
export const runtimeComponentsByProject: Ref<ComponentsByProject> = componentsByProject
export const runtimeProjectMatrix: Ref<ProjectMatrixRow[]> = projectMatrix
export const runtimeConfigLoaded: Ref<boolean> = configLoaded
export const runtimeConfigStatus: Ref<Record<ConfigFileKey, ConfigFileStatus>> = configStatus
