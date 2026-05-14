import { getResponseFormat } from './index'

export interface SkillEntry {
  id: string
  name: string
  keywords: string[]
  systemPrompt: string
  /** Override prompt resolution for built-in skills that have localStorage customization.
   *  Receives current lang and returns the effective raw prompt (checking localStorage first).
   *  If absent, `systemPrompt` is always used as-is (correct for third-party skills). */
  getRawPrompt?: (lang: 'zh' | 'en') => string
  lang?: 'zh' | 'en' | 'both'
}

// Intentionally empty. The earlier entries 'coach' and 'analyze' were the *defaults
// for two separate action buttons* (Task Guidance → coach flow, Analyze Task → analyze
// flow), not specialty skills the coach flow should ever route to. Putting them here
// meant matchSkill could flip a Task Guidance click into the analyze prompt whenever
// a description contained common words like "verify", "check", "quality" or in Chinese
// "分析"/"检查" — see v10.86 changelog. Do not re-add coach/analyze entries here. Use
// this registry only for genuine third-party / specialty skills (e.g. UI/UX Pro Max)
// that legitimately override the default coach prompt.
export const SKILL_REGISTRY: SkillEntry[] = []

/** Resolve the effective system prompt for a skill entry */
export function resolveSystemPrompt(skill: SkillEntry, lang: 'zh' | 'en'): string {
  const raw = skill.getRawPrompt ? skill.getRawPrompt(lang) : skill.systemPrompt
  return raw + '\n\n' + getResponseFormat()
}
