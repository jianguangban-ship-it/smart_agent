import { getCoachSkillTaskRaw, getAnalyzeSkillRaw, getResponseFormat } from './index'

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

export const SKILL_REGISTRY: SkillEntry[] = [
  {
    id: 'coach',
    name: 'Task Coach',
    keywords: [
      'review', 'improve', 'suggest', 'help', 'coach', 'guidance', 'advice',
      'jira', 'ticket', 'description', 'requirement', 'task', 'story',
      '审阅', '改进', '建议', '帮助', '教练', '指导',
      '任务', '描述', '需求', '工单'
    ],
    systemPrompt: '',
    getRawPrompt: (lang) => getCoachSkillTaskRaw(lang)
  },
  {
    id: 'analyze',
    name: 'Task Analysis',
    keywords: [
      'analyze', 'analysis', 'evaluate', 'assess', 'score', 'quality', 'check',
      'validate', 'verify', 'audit', 'inspect',
      '分析', '评估', '评分', '质量', '检查', '验证', '审核'
    ],
    systemPrompt: '',
    getRawPrompt: (lang) => getAnalyzeSkillRaw(lang)
  }
]

/** Resolve the effective system prompt for a skill entry */
export function resolveSystemPrompt(skill: SkillEntry, lang: 'zh' | 'en'): string {
  const raw = skill.getRawPrompt ? skill.getRawPrompt(lang) : skill.systemPrompt
  return raw + '\n\n' + getResponseFormat()
}
