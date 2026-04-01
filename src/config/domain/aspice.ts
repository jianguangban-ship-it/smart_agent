import type { UserRole } from '@/composables/useRole'

/**
 * ASPICE Process Awareness — maps ticket types + roles to ASPICE work products
 * and provides required-field suggestions per practice area.
 */

export interface AspiceMapping {
  processId: string
  processEn: string
  processZh: string
  workProductEn: string
  workProductZh: string
}

export interface AspiceSuggestion {
  fieldEn: string
  fieldZh: string
  required: boolean
}

export interface AspiceProfile {
  mapping: AspiceMapping
  suggestions: AspiceSuggestion[]
}

// ─── Mapping table: (role, issueType) → ASPICE process ──────────────────────

type IssueType = 'Story' | 'Task' | 'Bug' | 'Feature'

interface MappingKey {
  roles: UserRole[]
  issueTypes: IssueType[]
  profile: AspiceProfile
}

const ASPICE_MAP: MappingKey[] = [
  // System requirements
  {
    roles: ['system-architect'],
    issueTypes: ['Story'],
    profile: {
      mapping: {
        processId: 'SYS.2',
        processEn: 'System Requirements Analysis',
        processZh: '系统需求分析',
        workProductEn: 'System Requirement Specification',
        workProductZh: '系统需求规格说明'
      },
      suggestions: [
        { fieldEn: 'Parent/stakeholder requirement ID', fieldZh: '上级/利益相关方需求ID', required: true },
        { fieldEn: 'ASIL level (A/B/C/D/QM)', fieldZh: 'ASIL等级（A/B/C/D/QM）', required: true },
        { fieldEn: 'Verification method', fieldZh: '验证方法', required: true },
        { fieldEn: 'Interface references', fieldZh: '接口引用', required: false },
        { fieldEn: 'Acceptance criteria', fieldZh: '验收标准', required: true }
      ]
    }
  },
  {
    roles: ['system-architect'],
    issueTypes: ['Task'],
    profile: {
      mapping: {
        processId: 'SYS.3',
        processEn: 'System Architectural Design',
        processZh: '系统架构设计',
        workProductEn: 'System Architecture Description',
        workProductZh: '系统架构描述'
      },
      suggestions: [
        { fieldEn: 'Architecture element / block', fieldZh: '架构元素/模块', required: true },
        { fieldEn: 'Interface definition', fieldZh: '接口定义', required: true },
        { fieldEn: 'Allocated requirements', fieldZh: '分配的需求', required: true }
      ]
    }
  },
  // Software requirements
  {
    roles: ['sw-developer'],
    issueTypes: ['Story'],
    profile: {
      mapping: {
        processId: 'SWE.1',
        processEn: 'Software Requirements Analysis',
        processZh: '软件需求分析',
        workProductEn: 'Software Requirement Specification',
        workProductZh: '软件需求规格说明'
      },
      suggestions: [
        { fieldEn: 'Parent system requirement ID', fieldZh: '上级系统需求ID', required: true },
        { fieldEn: 'Acceptance criteria', fieldZh: '验收标准', required: true },
        { fieldEn: 'Input/output specification', fieldZh: '输入/输出规格', required: true },
        { fieldEn: 'Error handling behavior', fieldZh: '错误处理行为', required: false },
        { fieldEn: 'Non-functional constraints', fieldZh: '非功能约束', required: false }
      ]
    }
  },
  {
    roles: ['sw-developer'],
    issueTypes: ['Task'],
    profile: {
      mapping: {
        processId: 'SWE.3',
        processEn: 'Software Detailed Design and Unit Construction',
        processZh: '软件详细设计与单元实现',
        workProductEn: 'Software Detailed Design',
        workProductZh: '软件详细设计'
      },
      suggestions: [
        { fieldEn: 'Design approach / algorithm', fieldZh: '设计方案/算法', required: true },
        { fieldEn: 'API contract', fieldZh: 'API契约', required: false },
        { fieldEn: 'Unit test plan', fieldZh: '单元测试计划', required: false }
      ]
    }
  },
  {
    roles: ['sw-developer'],
    issueTypes: ['Bug'],
    profile: {
      mapping: {
        processId: 'SUP.9',
        processEn: 'Problem Resolution Management',
        processZh: '问题解决管理',
        workProductEn: 'Problem Report',
        workProductZh: '问题报告'
      },
      suggestions: [
        { fieldEn: 'Reproduction steps', fieldZh: '复现步骤', required: true },
        { fieldEn: 'Expected vs actual behavior', fieldZh: '期望行为 vs 实际行为', required: true },
        { fieldEn: 'Root cause (if known)', fieldZh: '根因（如已知）', required: false },
        { fieldEn: 'Affected requirement ID', fieldZh: '受影响需求ID', required: false }
      ]
    }
  },
  // Hardware
  {
    roles: ['hw-designer'],
    issueTypes: ['Story'],
    profile: {
      mapping: {
        processId: 'SYS.2',
        processEn: 'System Requirements Analysis (HW)',
        processZh: '系统需求分析（硬件）',
        workProductEn: 'HW Requirement Specification',
        workProductZh: '硬件需求规格说明'
      },
      suggestions: [
        { fieldEn: 'HW/SW interface specification', fieldZh: '硬软件接口规格', required: true },
        { fieldEn: 'Resource constraints (memory, CPU)', fieldZh: '资源约束（内存、CPU）', required: true },
        { fieldEn: 'ASIL level + HW metrics', fieldZh: 'ASIL等级 + 硬件指标', required: true },
        { fieldEn: 'Environmental conditions', fieldZh: '环境条件', required: false }
      ]
    }
  },
  {
    roles: ['hw-designer'],
    issueTypes: ['Task'],
    profile: {
      mapping: {
        processId: 'SYS.3',
        processEn: 'System Architectural Design (HW)',
        processZh: '系统架构设计（硬件）',
        workProductEn: 'HW Architecture Description',
        workProductZh: '硬件架构描述'
      },
      suggestions: [
        { fieldEn: 'Schematic / block diagram reference', fieldZh: '原理图/框图引用', required: true },
        { fieldEn: 'Pin assignment table', fieldZh: '引脚分配表', required: false }
      ]
    }
  },
  // Mechanics
  {
    roles: ['me-designer'],
    issueTypes: ['Story'],
    profile: {
      mapping: {
        processId: 'SYS.2',
        processEn: 'System Requirements Analysis (ME)',
        processZh: '系统需求分析（机械）',
        workProductEn: 'ME Requirement Specification',
        workProductZh: '机械需求规格说明'
      },
      suggestions: [
        { fieldEn: 'Packaging constraints (dimensions, weight)', fieldZh: '封装约束（尺寸、重量）', required: true },
        { fieldEn: 'Environmental specs (IP, temp, vibration)', fieldZh: '环境规格（IP、温度、振动）', required: true },
        { fieldEn: 'Material requirements', fieldZh: '材料要求', required: false },
        { fieldEn: 'Tolerance specifications', fieldZh: '公差规格', required: false }
      ]
    }
  },
  // V&V
  {
    roles: ['vv-engineer'],
    issueTypes: ['Story'],
    profile: {
      mapping: {
        processId: 'SWE.4',
        processEn: 'Software Unit Verification',
        processZh: '软件单元验证',
        workProductEn: 'Test Specification',
        workProductZh: '测试规格说明'
      },
      suggestions: [
        { fieldEn: 'Linked requirement ID', fieldZh: '关联需求ID', required: true },
        { fieldEn: 'Verification method (Test/Analysis/Review/Demo)', fieldZh: '验证方法（测试/分析/评审/演示）', required: true },
        { fieldEn: 'Test environment (HIL/SIL/MIL)', fieldZh: '测试环境（HIL/SIL/MIL）', required: true },
        { fieldEn: 'Pass/fail criteria', fieldZh: '通过/失败标准', required: true },
        { fieldEn: 'Preconditions', fieldZh: '前置条件', required: false }
      ]
    }
  },
  {
    roles: ['vv-engineer'],
    issueTypes: ['Task'],
    profile: {
      mapping: {
        processId: 'SWE.5',
        processEn: 'Software Integration and Integration Test',
        processZh: '软件集成与集成测试',
        workProductEn: 'Integration Test Report',
        workProductZh: '集成测试报告'
      },
      suggestions: [
        { fieldEn: 'Integration scope', fieldZh: '集成范围', required: true },
        { fieldEn: 'Test results summary', fieldZh: '测试结果摘要', required: true }
      ]
    }
  },
  // Change request — all roles
  {
    roles: ['system-architect', 'sw-developer', 'hw-designer', 'me-designer', 'vv-engineer'],
    issueTypes: ['Bug'],
    profile: {
      mapping: {
        processId: 'SUP.10',
        processEn: 'Change Request Management',
        processZh: '变更请求管理',
        workProductEn: 'Change Request',
        workProductZh: '变更请求'
      },
      suggestions: [
        { fieldEn: 'Change reason / justification', fieldZh: '变更原因/依据', required: true },
        { fieldEn: 'Impact analysis', fieldZh: '影响分析', required: true },
        { fieldEn: 'Affected work products', fieldZh: '受影响工作产品', required: false }
      ]
    }
  }
]

/** Get ASPICE profile for a given role + issue type combination */
export function getAspiceProfile(role: UserRole, issueType: IssueType): AspiceProfile | null {
  // Find most specific match (role-specific before the catch-all Bug/SUP.10)
  const match = ASPICE_MAP.find(m =>
    m.roles.includes(role) && m.issueTypes.includes(issueType)
  )
  return match?.profile ?? null
}
