import type { UserRole } from '@/composables/useRole'
import type { RequirementLevel } from './traceability.design'
import type { TaskLevel } from './traceability.task'
import { getLevelDef, REQUIREMENT_LEVELS } from './traceability.design'

/**
 * Traceability Suggestions — builds AI prompts to suggest
 * parent requirements and required downstream artifacts.
 */

/** Build a traceability suggestion prompt for the LLM */
export function buildTraceSuggestPrompt(
  role: UserRole,
  level: RequirementLevel | TaskLevel,
  parentReqId: string,
  description: string,
  lang: 'zh' | 'en'
): string {
  const def = getLevelDef(level)
  const lines: string[] = []

  if (lang === 'zh') {
    lines.push('你是一位需求追溯专家。请基于以下需求描述，提供追溯建议：')
    lines.push('')
    if (def) {
      lines.push(`**当前需求层级**: ${def.labelZh} (${def.aspiceId})`)
      if (parentReqId) {
        lines.push(`**已关联上级需求**: ${parentReqId}`)
      }
    }
    lines.push('')
    lines.push('请分析并建议：')
    lines.push('')

    // Parent suggestion
    if (def && def.parentLevels.length > 0 && !parentReqId) {
      const parentNames = def.parentLevels
        .map(id => REQUIREMENT_LEVELS.find(l => l.id === id))
        .filter(Boolean)
        .map(l => `${l!.labelZh}(${l!.aspiceId})`)
        .join('、')
      lines.push(`### 1. 上级需求建议`)
      lines.push(`此${def.labelZh}应追溯到 ${parentNames} 级别。`)
      lines.push(`请根据描述内容，推测可能的上级需求：`)
      lines.push(`- 建议的上级需求ID格式和内容`)
      lines.push(`- 上级需求的大致描述`)
      lines.push('')
    }

    // Downstream artifacts
    if (def && def.childLevels.length > 0) {
      const childNames = def.childLevels
        .map(id => REQUIREMENT_LEVELS.find(l => l.id === id))
        .filter(Boolean)
        .map(l => `${l!.labelZh}(${l!.aspiceId})`)
        .join('、')
      lines.push(`### 2. 下游产物建议`)
      lines.push(`此${def.labelZh}需要分解为以下产物：${childNames}`)
      lines.push(`请建议需要创建哪些下游工作产品：`)
      lines.push(`- 每个下游产物的简要描述`)
      lines.push(`- 关键验证点`)
      lines.push('')
    }

    // Coverage check
    lines.push('### 3. 追溯完整性检查')
    lines.push('- 是否存在追溯缺口？')
    lines.push('- 是否缺少关键的接口需求或安全需求的追溯？')
    lines.push('- ASPICE 合规性建议')

  } else {
    lines.push('You are a Requirement Traceability Expert. Based on the following requirement description, provide traceability suggestions:')
    lines.push('')
    if (def) {
      lines.push(`**Current Requirement Level**: ${def.labelEn} (${def.aspiceId})`)
      if (parentReqId) {
        lines.push(`**Linked Parent Requirement**: ${parentReqId}`)
      }
    }
    lines.push('')
    lines.push('Please analyze and suggest:')
    lines.push('')

    if (def && def.parentLevels.length > 0 && !parentReqId) {
      const parentNames = def.parentLevels
        .map(id => REQUIREMENT_LEVELS.find(l => l.id === id))
        .filter(Boolean)
        .map(l => `${l!.labelEn} (${l!.aspiceId})`)
        .join(', ')
      lines.push('### 1. Parent Requirement Suggestion')
      lines.push(`This ${def.labelEn} should trace to ${parentNames} level.`)
      lines.push('Based on the description, suggest the likely parent requirement:')
      lines.push('- Suggested parent requirement ID format and content')
      lines.push('- Brief description of what the parent requirement covers')
      lines.push('')
    }

    if (def && def.childLevels.length > 0) {
      const childNames = def.childLevels
        .map(id => REQUIREMENT_LEVELS.find(l => l.id === id))
        .filter(Boolean)
        .map(l => `${l!.labelEn} (${l!.aspiceId})`)
        .join(', ')
      lines.push('### 2. Downstream Artifact Suggestions')
      lines.push(`This ${def.labelEn} should decompose into: ${childNames}`)
      lines.push('Suggest which downstream work products need to be created:')
      lines.push('- Brief description of each downstream artifact')
      lines.push('- Key verification points')
      lines.push('')
    }

    lines.push('### 3. Traceability Completeness Check')
    lines.push('- Are there traceability gaps?')
    lines.push('- Are there missing interface or safety requirement traces?')
    lines.push('- ASPICE compliance recommendations')
  }

  return lines.join('\n')
}
