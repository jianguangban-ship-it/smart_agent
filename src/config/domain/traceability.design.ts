import type { UserRole } from '@/composables/useRole'
import type { TraceabilityGap } from './types'

export type { TraceabilityGap } from './types'

/**
 * Requirement Hierarchy & Traceability Model
 * Defines requirement levels and their relationships per ASPICE.
 *
 * Hierarchy:
 *   Stakeholder Req → System Req → SW/HW Req → Detailed Design → Test Case
 */

export type RequirementLevel =
  | 'stakeholder'
  | 'system'
  | 'software'
  | 'hardware'
  | 'mechanical'
  | 'detailed-design'
  | 'test-case'
  | 'none'

export interface RequirementLevelDef {
  id: RequirementLevel
  labelEn: string
  labelZh: string
  shortEn: string
  shortZh: string
  /** ASPICE process area this level maps to */
  aspiceId: string
  /** Which roles typically create requirements at this level */
  roles: UserRole[]
  /** Valid parent levels (requirements at this level derive from these) */
  parentLevels: RequirementLevel[]
  /** Expected child levels (this level decomposes into these) */
  childLevels: RequirementLevel[]
}

export const REQUIREMENT_LEVELS: RequirementLevelDef[] = [
  {
    id: 'stakeholder',
    labelEn: 'Stakeholder Requirement',
    labelZh: '利益相关方需求',
    shortEn: 'STKH',
    shortZh: '相关方',
    aspiceId: 'SYS.1',
    roles: ['system-architect'],
    parentLevels: [],
    childLevels: ['system']
  },
  {
    id: 'system',
    labelEn: 'System Requirement',
    labelZh: '系统需求',
    shortEn: 'SYS',
    shortZh: '系统',
    aspiceId: 'SYS.2',
    roles: ['system-architect'],
    parentLevels: ['stakeholder'],
    childLevels: ['software', 'hardware', 'mechanical']
  },
  {
    id: 'software',
    labelEn: 'Software Requirement',
    labelZh: '软件需求',
    shortEn: 'SWE',
    shortZh: '软件',
    aspiceId: 'SWE.1',
    roles: ['sw-developer'],
    parentLevels: ['system'],
    childLevels: ['detailed-design', 'test-case']
  },
  {
    id: 'hardware',
    labelEn: 'Hardware Requirement',
    labelZh: '硬件需求',
    shortEn: 'HWE',
    shortZh: '硬件',
    aspiceId: 'SYS.2',
    roles: ['hw-designer'],
    parentLevels: ['system'],
    childLevels: ['detailed-design', 'test-case']
  },
  {
    id: 'mechanical',
    labelEn: 'Mechanical Requirement',
    labelZh: '机械需求',
    shortEn: 'ME',
    shortZh: '机械',
    aspiceId: 'SYS.2',
    roles: ['me-designer'],
    parentLevels: ['system'],
    childLevels: ['detailed-design']
  },
  {
    id: 'detailed-design',
    labelEn: 'Detailed Design',
    labelZh: '详细设计',
    shortEn: 'DD',
    shortZh: '详设',
    aspiceId: 'SWE.3',
    roles: ['sw-developer', 'hw-designer'],
    parentLevels: ['software', 'hardware'],
    childLevels: ['test-case']
  },
  {
    id: 'test-case',
    labelEn: 'Test Case',
    labelZh: '测试用例',
    shortEn: 'TC',
    shortZh: '测试',
    aspiceId: 'SWE.4',
    roles: ['vv-engineer'],
    parentLevels: ['software', 'hardware', 'detailed-design', 'system'],
    childLevels: []
  }
]

/** Get the default requirement level for a role */
export function getDefaultLevel(role: UserRole): RequirementLevel {
  switch (role) {
    case 'system-architect': return 'system'
    case 'sw-developer': return 'software'
    case 'hw-designer': return 'hardware'
    case 'me-designer': return 'mechanical'
    case 'vv-engineer': return 'test-case'
    default: return 'none'
  }
}

/** Get requirement levels applicable to a role */
export function getLevelsForRole(role: UserRole): RequirementLevelDef[] {
  return REQUIREMENT_LEVELS.filter(l => l.roles.includes(role))
}

/** Get a level definition by ID */
export function getLevelDef(level: string): RequirementLevelDef | undefined {
  return REQUIREMENT_LEVELS.find(l => l.id === level)
}

/** Get valid parent levels for a given level */
export function getValidParentLevels(level: RequirementLevel): RequirementLevelDef[] {
  const def = getLevelDef(level)
  if (!def) return []
  return def.parentLevels.map(id => REQUIREMENT_LEVELS.find(l => l.id === id)!).filter(Boolean)
}

// ─── Traceability gap detection ──────────────────────────────────────────────

/** Check for traceability gaps */
export function checkTraceabilityGaps(
  level: RequirementLevel,
  parentReqId: string,
  verificationMethod: string
): TraceabilityGap[] {
  if (level === 'none') return []

  const gaps: TraceabilityGap[] = []
  const def = getLevelDef(level)
  if (!def) return gaps

  // Check: has parent when required
  if (def.parentLevels.length > 0 && !parentReqId.trim()) {
    const parentNames = def.parentLevels
      .map(id => REQUIREMENT_LEVELS.find(l => l.id === id))
      .filter(Boolean)
      .map(l => l!.shortEn)
      .join('/')

    gaps.push({
      id: 'no-parent',
      messageEn: `No parent requirement linked — ${def.shortEn} should trace to ${parentNames}`,
      messageZh: `未关联上级需求 — ${def.shortZh}需求应追溯到${parentNames}级别`,
      severity: 'warning'
    })
  }

  // Check: has verification method when needed (not for stakeholder/detailed-design)
  if (['system', 'software', 'hardware', 'test-case'].includes(level) && !verificationMethod.trim()) {
    gaps.push({
      id: 'no-verification',
      messageEn: 'No verification method specified — required for ASPICE compliance',
      messageZh: '未指定验证方法 — ASPICE 合规要求',
      severity: 'warning'
    })
  }

  // Check: test case without linked requirement
  if (level === 'test-case' && !parentReqId.trim()) {
    gaps.push({
      id: 'orphan-test',
      messageEn: 'Test case has no linked requirement — every test must trace to a requirement',
      messageZh: '测试用例未关联需求 — 每条测试必须追溯到一条需求',
      severity: 'warning'
    })
  }

  return gaps
}

/** Build traceability context for LLM system prompts */
export function buildTraceabilityContext(
  level: RequirementLevel,
  parentReqId: string,
  lang: 'zh' | 'en'
): string {
  if (level === 'none') return ''

  const def = getLevelDef(level)
  if (!def) return ''

  const lines: string[] = []

  if (lang === 'zh') {
    lines.push('## 追溯信息')
    lines.push(`- **需求层级**: ${def.labelZh} (${def.aspiceId})`)
    if (parentReqId) {
      lines.push(`- **上级需求**: ${parentReqId}`)
    }
    if (def.childLevels.length > 0) {
      const children = def.childLevels
        .map(id => REQUIREMENT_LEVELS.find(l => l.id === id)?.labelZh)
        .filter(Boolean)
        .join('、')
      lines.push(`- **下游产物**: ${children}`)
    }
  } else {
    lines.push('## Traceability')
    lines.push(`- **Requirement Level**: ${def.labelEn} (${def.aspiceId})`)
    if (parentReqId) {
      lines.push(`- **Parent Requirement**: ${parentReqId}`)
    }
    if (def.childLevels.length > 0) {
      const children = def.childLevels
        .map(id => REQUIREMENT_LEVELS.find(l => l.id === id)?.labelEn)
        .filter(Boolean)
        .join(', ')
      lines.push(`- **Downstream Artifacts**: ${children}`)
    }
  }

  return lines.join('\n')
}
