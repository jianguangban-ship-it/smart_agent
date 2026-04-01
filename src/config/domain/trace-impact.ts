import type { UserRole } from '@/composables/useRole'
import type { RequirementLevel } from './traceability.design'
import type { TaskLevel } from './traceability.task'
import { getLevelDef, REQUIREMENT_LEVELS } from './traceability.design'

/**
 * Impact Analysis — builds AI prompts to analyze the ripple effect
 * when a requirement changes: dependent requirements, test cases,
 * design documents, and cross-team impact.
 */

export function buildImpactAnalysisPrompt(
  role: UserRole,
  level: RequirementLevel | TaskLevel,
  parentReqId: string,
  description: string,
  lang: 'zh' | 'en'
): string {
  const def = getLevelDef(level)
  const lines: string[] = []

  if (lang === 'zh') {
    lines.push('你是一位需求变更影响分析专家。请分析以下需求如果发生变更，会产生哪些影响：')
    lines.push('')
    if (def) {
      lines.push(`**当前需求层级**: ${def.labelZh} (${def.aspiceId})`)
      if (parentReqId) {
        lines.push(`**上级需求**: ${parentReqId}`)
      }
    }
    lines.push('')
    lines.push('请从以下维度进行影响分析：')
    lines.push('')

    // Upstream impact
    if (def && def.parentLevels.length > 0) {
      lines.push('### 1. 上游影响')
      lines.push('- 此变更是否需要更新上级需求？')
      lines.push('- 是否可能违反上级需求的约束或验收标准？')
      lines.push('')
    }

    // Downstream impact
    if (def && def.childLevels.length > 0) {
      const childNames = def.childLevels
        .map(id => REQUIREMENT_LEVELS.find(l => l.id === id))
        .filter(Boolean)
        .map(l => `${l!.labelZh}(${l!.aspiceId})`)
        .join('、')
      lines.push('### 2. 下游影响')
      lines.push(`此需求变更可能影响以下下游产物：${childNames}`)
      lines.push('- 需要更新哪些下游需求或设计文档？')
      lines.push('- 是否需要新增或删除下游产物？')
      lines.push('')
    }

    // Test impact
    lines.push('### 3. 测试影响')
    lines.push('- 需要新增、修改或废弃哪些测试用例？')
    lines.push('- 是否需要回归测试？影响范围？')
    lines.push('- HIL/SIL/MIL 测试是否受影响？')
    lines.push('')

    // Cross-team impact
    lines.push('### 4. 跨团队影响')
    _appendCrossTeamZh(lines, role)
    lines.push('')

    // Safety & compliance
    lines.push('### 5. 安全与合规影响')
    lines.push('- 是否影响功能安全 (ISO 26262) 分析？ASIL 等级是否需要重新评估？')
    lines.push('- 是否需要更新 FMEA、FTA 或安全概念？')
    lines.push('- ASPICE 追溯链是否需要更新？')
    lines.push('')

    // Summary
    lines.push('### 6. 变更影响摘要')
    lines.push('请以表格形式总结：')
    lines.push('| 影响维度 | 影响范围 | 严重程度 | 建议动作 |')
    lines.push('|---------|---------|---------|---------|')

  } else {
    lines.push('You are a Requirement Change Impact Analysis Expert. Analyze the ripple effects if the following requirement changes:')
    lines.push('')
    if (def) {
      lines.push(`**Current Requirement Level**: ${def.labelEn} (${def.aspiceId})`)
      if (parentReqId) {
        lines.push(`**Parent Requirement**: ${parentReqId}`)
      }
    }
    lines.push('')
    lines.push('Analyze the impact from the following dimensions:')
    lines.push('')

    // Upstream
    if (def && def.parentLevels.length > 0) {
      lines.push('### 1. Upstream Impact')
      lines.push('- Does this change require updates to parent requirements?')
      lines.push('- Could it violate constraints or acceptance criteria of upstream requirements?')
      lines.push('')
    }

    // Downstream
    if (def && def.childLevels.length > 0) {
      const childNames = def.childLevels
        .map(id => REQUIREMENT_LEVELS.find(l => l.id === id))
        .filter(Boolean)
        .map(l => `${l!.labelEn} (${l!.aspiceId})`)
        .join(', ')
      lines.push('### 2. Downstream Impact')
      lines.push(`This change may affect downstream artifacts: ${childNames}`)
      lines.push('- Which downstream requirements or design documents need updating?')
      lines.push('- Are new downstream artifacts needed, or should any be removed?')
      lines.push('')
    }

    // Test
    lines.push('### 3. Test Impact')
    lines.push('- Which test cases need to be added, modified, or deprecated?')
    lines.push('- Is regression testing required? What is the scope?')
    lines.push('- Are HIL/SIL/MIL tests affected?')
    lines.push('')

    // Cross-team
    lines.push('### 4. Cross-Team Impact')
    _appendCrossTeamEn(lines, role)
    lines.push('')

    // Safety
    lines.push('### 5. Safety & Compliance Impact')
    lines.push('- Does this affect functional safety analysis (ISO 26262)? Does the ASIL rating need re-evaluation?')
    lines.push('- Do FMEA, FTA, or safety concepts need updating?')
    lines.push('- Does the ASPICE traceability chain need updating?')
    lines.push('')

    // Summary table
    lines.push('### 6. Impact Summary')
    lines.push('Summarize in a table:')
    lines.push('| Impact Dimension | Scope | Severity | Recommended Action |')
    lines.push('|-----------------|-------|----------|-------------------|')
  }

  return lines.join('\n')
}

function _appendCrossTeamZh(lines: string[], role: UserRole) {
  switch (role) {
    case 'system-architect':
      lines.push('- 系统需求变更对软件团队 (SWE)、硬件团队 (HWE)、机械团队 (ME) 的影响')
      lines.push('- 是否需要重新协调接口定义？')
      break
    case 'sw-developer':
      lines.push('- 软件需求变更是否影响硬件接口 (CAN/LIN/SPI 信号定义)？')
      lines.push('- 是否影响系统集成计划？')
      break
    case 'hw-designer':
      lines.push('- 硬件变更是否影响软件驱动层 (BSW/MCAL)？')
      lines.push('- PCB 布局或原理图是否需要同步更新？')
      break
    case 'me-designer':
      lines.push('- 机械变更是否影响 PCB 安装空间或连接器位置？')
      lines.push('- 是否影响散热设计或 IP 防护等级？')
      break
    case 'vv-engineer':
      lines.push('- 验证方法变更是否需要新的测试设备或环境？')
      lines.push('- 是否影响其他团队的验证计划？')
      break
  }
}

function _appendCrossTeamEn(lines: string[], role: UserRole) {
  switch (role) {
    case 'system-architect':
      lines.push('- Impact of system requirement change on SW team (SWE), HW team (HWE), ME team')
      lines.push('- Do interface definitions need re-negotiation?')
      break
    case 'sw-developer':
      lines.push('- Does the SW requirement change affect HW interfaces (CAN/LIN/SPI signal definitions)?')
      lines.push('- Does it affect system integration planning?')
      break
    case 'hw-designer':
      lines.push('- Does the HW change affect SW driver layer (BSW/MCAL)?')
      lines.push('- Do PCB layout or schematics need synchronized updates?')
      break
    case 'me-designer':
      lines.push('- Does the ME change affect PCB mounting space or connector positions?')
      lines.push('- Does it impact thermal design or IP protection rating?')
      break
    case 'vv-engineer':
      lines.push('- Does the verification method change require new test equipment or environments?')
      lines.push('- Does it affect other teams\' verification plans?')
      break
  }
}
