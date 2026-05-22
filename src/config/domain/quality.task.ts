import type { QualityViolation } from './types'

export type TaskQualityRuleId = 'actionable' | 'scoped' | 'complete' | 'estimated' | 'acceptance'

// ── Detection patterns ──────────────────────────────────────────────────────

const ACTIONABLE_VERBS = /\b(implement|create|fix|update|add|remove|refactor|test|verify|design|review|write|build|configure|deploy|investigate|analyze|migrate|升级|修复|添加|删除|重构|测试|验证|设计|评审|编写|构建|配置|部署|调查|分析|迁移)\b/i

const CONJUNCTION_SPLIT = /\b(and also|; and|; also|, and also)\b/i
const MULTI_TASK = /\b(also need to|additionally|furthermore|moreover|另外|此外|同时还需要)\b/i

const INCOMPLETE_PATTERN = /\b(TBD|TBC|TODO|FIXME|to be (decided|confirmed|determined|defined|specified|discussed)|undefined|not yet (defined|determined|specified)|待定|待确认|待讨论|待补充|未定义|未确定)\b/ig

const EFFORT_PATTERN = /\b(\d+\s*(point|pt|hour|hr|day|story point|SP|点|小时|天|人天|人时)|estimated|estimate|effort|工作量|估算)\b/i

const AC_PATTERN = /\b(acceptance criteria|AC:|given .+ when .+ then|pass.?fail|done when|complete when|验收标准|完成标准|通过条件)\b/i

// ── Check functions ─────────────────────────────────────────────────────────

function checkActionable(desc: string): QualityViolation | null {
  if (desc.length < 10) return null
  if (!ACTIONABLE_VERBS.test(desc)) {
    return {
      ruleId: 'actionable',
      titleEn: 'Actionable',
      titleZh: '可执行',
      messageEn: 'No clear action verb found — start with what needs to be done (implement, fix, add, test, ...)',
      messageZh: '未发现明确的动作动词 — 请以需要做什么开头（实现、修复、添加、测试……）',
      severity: 'warning'
    }
  }
  return null
}

function checkScoped(desc: string): QualityViolation | null {
  if (CONJUNCTION_SPLIT.test(desc) || MULTI_TASK.test(desc)) {
    return {
      ruleId: 'scoped',
      titleEn: 'Scoped',
      titleZh: '范围明确',
      messageEn: 'Multiple tasks detected in one ticket — consider splitting into separate items',
      messageZh: '检测到单个工单包含多个任务 — 建议拆分为独立条目',
      severity: 'warning'
    }
  }
  return null
}

function checkComplete(desc: string): QualityViolation | null {
  const matches: string[] = []
  const pattern = new RegExp(INCOMPLETE_PATTERN.source, 'ig')
  let m: RegExpExecArray | null
  while ((m = pattern.exec(desc)) !== null) {
    if (!matches.includes(m[0])) matches.push(m[0])
  }
  if (matches.length > 0) {
    return {
      ruleId: 'complete',
      titleEn: 'Complete',
      titleZh: '完整性',
      messageEn: `Incomplete markers found: ${matches.join(', ')}`,
      messageZh: `发现未完成标记：${matches.join('、')}`,
      severity: 'error',
      matches
    }
  }
  return null
}

function checkEstimated(desc: string): QualityViolation | null {
  if (desc.length < 30) return null
  if (!EFFORT_PATTERN.test(desc)) {
    return {
      ruleId: 'estimated',
      titleEn: 'Estimated',
      titleZh: '已估算',
      messageEn: 'No effort estimate found — add story points, hours, or effort estimate',
      messageZh: '未发现工作量估算 — 请添加故事点、工时或工作量估算',
      severity: 'warning'
    }
  }
  return null
}

function checkAcceptance(desc: string): QualityViolation | null {
  if (desc.length < 80) return null
  if (!AC_PATTERN.test(desc)) {
    return {
      ruleId: 'acceptance',
      titleEn: 'Acceptance Criteria',
      titleZh: '验收标准',
      messageEn: 'No acceptance criteria found — add clear done/pass conditions',
      messageZh: '未发现验收标准 — 请添加明确的完成/通过条件',
      severity: 'warning'
    }
  }
  return null
}

// ── Public API ──────────────────────────────────────────────────────────────

export function checkTaskQuality(description: string): QualityViolation[] {
  const desc = description.trim()
  if (!desc) return []

  const violations: QualityViolation[] = []
  const actionable = checkActionable(desc)
  if (actionable) violations.push(actionable)
  const scoped = checkScoped(desc)
  if (scoped) violations.push(scoped)
  const complete = checkComplete(desc)
  if (complete) violations.push(complete)
  const estimated = checkEstimated(desc)
  if (estimated) violations.push(estimated)
  const acceptance = checkAcceptance(desc)
  if (acceptance) violations.push(acceptance)
  return violations
}

export function taskQualityPenalty(violations: QualityViolation[]): number {
  let penalty = 0
  for (const v of violations) {
    if (v.severity === 'error') penalty += 5
    else penalty += 3
  }
  return Math.min(penalty, 15)
}
