import { describe, it, expect } from 'vitest'
import { SKILL_REGISTRY } from '../registry'
import { matchSkill } from '@/utils/skillMatcher'

describe('SKILL_REGISTRY (production)', () => {
  it('does not contain the built-in "coach" entry', () => {
    expect(SKILL_REGISTRY.find(s => s.id === 'coach')).toBeUndefined()
  })

  it('does not contain the built-in "analyze" entry', () => {
    expect(SKILL_REGISTRY.find(s => s.id === 'analyze')).toBeUndefined()
  })

  // Regression for v10.86: pre-fix, any Task description containing 2+ of
  // analyze/quality/check/validate/verify/audit/inspect (or the ZH equivalents)
  // caused matchSkill to flip the coach flow into the analyze prompt. With the
  // production registry now empty, the matcher must return null for these inputs.
  it('matchSkill returns null for analyze-flavored EN descriptions', () => {
    expect(
      matchSkill('verify the API behavior and check quality of validation logic', SKILL_REGISTRY, 'en')
    ).toBeNull()
  })

  it('matchSkill returns null for analyze-flavored ZH descriptions', () => {
    expect(
      matchSkill('需要分析并检查质量评估结果', SKILL_REGISTRY, 'zh')
    ).toBeNull()
  })
})
