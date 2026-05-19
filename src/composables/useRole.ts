import { ref, computed } from 'vue'

export type UserRole = '' | 'system-architect' | 'sw-developer' | 'app-developer' |'hw-designer' | 'me-designer' | 'vv-engineer' | 'devops-engineer'

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
    id: 'app-developer',
    labelEn: 'App Developer',
    labelZh: '应用开发',
    shortEn: 'APP',
    shortZh: '应用',
    contextEn: 'The user is a Vehicle Chassis Control Algorithm Development Engineer. Key focus areas include: vehicle braking and lateral control algorithms, steering control (longitudinal control) algorithms, suspension control (vertical control) algorithms, vehicle motion observer algorithms, and adaptive vehicle motion control algorithms. Additionally, expertise extends to algorithm integration and testing, performance optimization, and cross-platform compatibility.',
    contextZh: '用户是车辆底盘系统控制算法开发工程师。重点关注：车辆制动即横向控制算法、转向控制系统即纵向控制算法、悬架控制系统即垂向控制算法、车辆运动观测器算法、车辆自适应运动控制算法、算法集成和测试、性能优化、以及跨平台兼容性。',
    placeholderEn: 'Describe the application requirement or change request. Include: user interface specifications, user experience considerations, integration points with backend services, performance targets, and platform-specific requirements...',
    placeholderZh: '描述应用需求或变更请求。包含：算法变更要点、接口设计、输入验证规则、预期行为、错误场景、算法集成点、性能目标、以及平台特定需求...'
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
  },
  {
    id: 'devops-engineer',
    labelEn: 'DevOps Engineer',
    labelZh: '研发运维',
    shortEn: 'DevOps',
    shortZh: '运维',
    contextEn: 'The user is a Development & Operations (DevOps) Software Engineer. Focus on: CI/CD pipelines, build and release automation, toolchain and environment configuration, infrastructure-as-code, containerization, deployment strategy, versioning and artifact management, monitoring/observability, and reproducibility of the build & test environment.',
    contextZh: '用户是研发运维（DevOps）软件工程师。重点关注：CI/CD 流水线、构建与发布自动化、工具链与环境配置、基础设施即代码、容器化、部署策略、版本与制品管理、监控/可观测性、以及构建与测试环境的可复现性。',
    placeholderEn: 'Describe the DevOps/automation requirement or change. Include: pipeline stages affected, build/release scope, environment or toolchain config, rollback strategy, monitoring/alerting needs, and reproducibility constraints...',
    placeholderZh: '描述研发运维/自动化需求或变更。包含：受影响的流水线阶段、构建/发布范围、环境或工具链配置、回滚策略、监控/告警需求、以及可复现性约束...'
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
