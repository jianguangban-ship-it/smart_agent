import { ref, computed } from 'vue'

export type UserRole = '' | 'system-architect' | 'sw-developer' | 'hw-designer' | 'me-designer' | 'vv-engineer'

export interface RoleDefinition {
  id: UserRole
  labelEn: string
  labelZh: string
  shortEn: string
  shortZh: string
  /** Injected into LLM system prompts to adapt AI behavior */
  contextEn: string
  contextZh: string
  /** Role-specific description placeholder */
  placeholderEn: string
  placeholderZh: string
}

export const ROLES: RoleDefinition[] = [
  {
    id: 'system-architect',
    labelEn: 'System Architect',
    labelZh: '系统架构师',
    shortEn: 'SYS',
    shortZh: '架构',
    contextEn: 'The user is a System/Requirement/Architecture Designer. Focus on: requirement completeness, system-level decomposition, interface definitions, functional safety (ASIL allocation), and traceability to stakeholder requirements. Use precise engineering terminology.',
    contextZh: '用户是系统/需求/架构设计师。重点关注：需求完整性、系统级分解、接口定义、功能安全（ASIL分配）、以及与利益相关方需求的可追溯性。使用精确的工程术语。',
    placeholderEn: 'Describe the system requirement, interface specification, or architecture decision. Include: functional scope, input/output signals, safety relevance (ASIL), and traceability to parent requirement...',
    placeholderZh: '描述系统需求、接口规格或架构决策。包含：功能范围、输入/输出信号、安全相关性（ASIL）、以及与上级需求的追溯关系...'
  },
  {
    id: 'sw-developer',
    labelEn: 'SW Developer',
    labelZh: '软件开发',
    shortEn: 'SWE',
    shortZh: '软件',
    contextEn: 'The user is a Software Developer. Focus on: clear acceptance criteria, implementation constraints, API contracts, error handling, testable requirements, and unambiguous specifications. Flag vague or untestable statements.',
    contextZh: '用户是软件开发工程师。重点关注：明确的验收标准、实现约束、API契约、错误处理、可测试需求、以及无歧义的规格说明。标记模糊或不可测试的描述。',
    placeholderEn: 'Describe the software requirement or change request. Include: acceptance criteria, input validation rules, expected behavior, error scenarios, and any API or interface constraints...',
    placeholderZh: '描述软件需求或变更请求。包含：验收标准、输入验证规则、预期行为、错误场景、以及任何API或接口约束...'
  },
  {
    id: 'hw-designer',
    labelEn: 'HW Designer',
    labelZh: '硬件设计',
    shortEn: 'HWE',
    shortZh: '硬件',
    contextEn: 'The user is an ECU Hardware Designer. Focus on: HW/SW interface specifications, pin assignments, resource constraints (memory, CPU, peripherals), power budget, communication protocols (CAN/LIN/Ethernet), EMC requirements, and ASIL decomposition between HW and SW.',
    contextZh: '用户是ECU硬件设计工程师。重点关注：硬软件接口规格、引脚分配、资源约束（内存、CPU、外设）、功耗预算、通信协议（CAN/LIN/以太网）、EMC需求、以及硬软件间的ASIL分解。',
    placeholderEn: 'Describe the hardware requirement or HW/SW interface change. Include: signal definitions, pin assignments, timing constraints, resource budget, communication protocol, and environmental conditions (temp, voltage)...',
    placeholderZh: '描述硬件需求或硬软件接口变更。包含：信号定义、引脚分配、时序约束、资源预算、通信协议、以及环境条件（温度、电压）...'
  },
  {
    id: 'me-designer',
    labelEn: 'Mechanics Designer',
    labelZh: '机械设计',
    shortEn: 'ME',
    shortZh: '机械',
    contextEn: 'The user is a Mechanics Designer. Focus on: mechanical packaging and mounting, thermal management, housing/enclosure design, connector placement, vibration and shock resistance, IP protection rating, material selection, tolerance analysis, and DFM (Design for Manufacturing) constraints.',
    contextZh: '用户是机械设计工程师。重点关注：机械封装与安装、热管理、壳体/外壳设计、连接器布局、抗振动与冲击、IP防护等级、材料选择、公差分析、以及DFM（面向制造的设计）约束。',
    placeholderEn: 'Describe the mechanical design requirement or change. Include: packaging constraints, mounting specifications, thermal requirements, connector/harness interface, environmental conditions (vibration, temperature, IP rating), material requirements, and tolerance specifications...',
    placeholderZh: '描述机械设计需求或变更。包含：封装约束、安装规格、热管理需求、连接器/线束接口、环境条件（振动、温度、IP等级）、材料需求、以及公差规格...'
  },
  {
    id: 'vv-engineer',
    labelEn: 'V&V Engineer',
    labelZh: '验证确认',
    shortEn: 'V&V',
    shortZh: '验证',
    contextEn: 'The user is a Verification & Validation Engineer. Focus on: testability of requirements, verification methods (Review/Analysis/Simulation/Test/Demonstration), test coverage, pass/fail criteria, test environment setup (HIL/SIL/MIL), and traceability from test cases to requirements.',
    contextZh: '用户是验证确认工程师。重点关注：需求的可测试性、验证方法（评审/分析/仿真/测试/演示）、测试覆盖率、通过/失败标准、测试环境搭建（HIL/SIL/MIL）、以及从测试用例到需求的追溯性。',
    placeholderEn: 'Describe the test case, verification activity, or validation finding. Include: verification method (test/analysis/review/demo), pass/fail criteria, test environment (HIL/SIL), preconditions, and linked requirement ID...',
    placeholderZh: '描述测试用例、验证活动或确认发现。包含：验证方法（测试/分析/评审/演示）、通过/失败标准、测试环境（HIL/SIL）、前置条件、以及关联的需求ID...'
  }
]

const LS_KEY_ROLE = 'user-role'

const stored = localStorage.getItem(LS_KEY_ROLE) as UserRole | null
const validIds = ROLES.map(r => r.id)
const initialRole: UserRole = stored && validIds.includes(stored) ? stored : ''

export const currentRole = ref<UserRole>(initialRole)

export function setRole(role: UserRole): void {
  currentRole.value = role
  localStorage.setItem(LS_KEY_ROLE, role)
}

export const currentRoleDefinition = computed(() =>
  ROLES.find(r => r.id === currentRole.value) ?? null
)

/** Get role context string to inject into LLM system prompts */
export function getRoleContext(lang: 'zh' | 'en'): string {
  const def = ROLES.find(r => r.id === currentRole.value)
  if (!def) return ''
  return lang === 'zh' ? def.contextZh : def.contextEn
}

/** Get role-specific description placeholder */
export function getRolePlaceholder(lang: 'zh' | 'en'): string {
  const def = ROLES.find(r => r.id === currentRole.value)
  if (!def) return ''
  return lang === 'zh' ? def.placeholderZh : def.placeholderEn
}
