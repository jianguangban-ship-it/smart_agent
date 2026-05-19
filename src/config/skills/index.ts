import { ref, computed } from 'vue'
import { currentLang } from '@/i18n'
import analyzeSkillZh from './analyze-skill-zh.md?raw'
import analyzeSkillEn from './analyze-skill-en.md?raw'
import responseFormatDefault from './response-format.md?raw'
import type { AppMode } from '@/composables/useAppMode'

// ─── Task-mode layer-specific skills ────────────────────────────────────────
import taskSkillSysEn from './coach-skill-task-sys-en.md?raw'
import taskSkillSysZh from './coach-skill-task-sys-zh.md?raw'
import taskSkillSwEn from './coach-skill-task-sw-en.md?raw'
import taskSkillSwZh from './coach-skill-task-sw-zh.md?raw'
import taskSkillAppEn from './coach-skill-task-app-en.md?raw'
import taskSkillAppZh from './coach-skill-task-app-zh.md?raw'
import taskSkillHwEn from './coach-skill-task-hw-en.md?raw'
import taskSkillHwZh from './coach-skill-task-hw-zh.md?raw'
import taskSkillMeEn from './coach-skill-task-me-en.md?raw'
import taskSkillMeZh from './coach-skill-task-me-zh.md?raw'
import taskSkillVVEn from './coach-skill-task-vv-en.md?raw'
import taskSkillVVZh from './coach-skill-task-vv-zh.md?raw'
import taskSkillDevopsEn from './coach-skill-task-devops-en.md?raw'
import taskSkillDevopsZh from './coach-skill-task-devops-zh.md?raw'

const TASK_SKILL_MAP: Record<string, { en: string; zh: string }> = {
  SYS:  { en: taskSkillSysEn, zh: taskSkillSysZh },
  SW:   { en: taskSkillSwEn, zh: taskSkillSwZh },
  APP:  { en: taskSkillAppEn, zh: taskSkillAppZh },
  HW:   { en: taskSkillHwEn, zh: taskSkillHwZh },
  ME:   { en: taskSkillMeEn, zh: taskSkillMeZh },
  VV:   { en: taskSkillVVEn, zh: taskSkillVVZh },
  Devops:  { en: taskSkillDevopsEn, zh: taskSkillDevopsZh },
}

// ─── localStorage keys ──────────────────────────────────────────────────────
const LS_KEY_COACH_SKILL_TASK = 'coach-skill-task'
const LS_KEY_ANALYZE_SKILL    = 'analyze-skill'
const LS_KEY_RESPONSE_FORMAT  = 'response-format'

/** Reactive flags — true when a localStorage override is active */
export const coachSkillTaskModified = ref(localStorage.getItem(LS_KEY_COACH_SKILL_TASK) !== null)
export const analyzeSkillModified = ref(localStorage.getItem(LS_KEY_ANALYZE_SKILL) !== null)
export const responseFormatModified = ref(localStorage.getItem(LS_KEY_RESPONSE_FORMAT) !== null)

// ─── Active task layer (set by useForm layer watcher) ───────────────────────
export const activeTaskLayer = ref('')

/** Full file name of the currently loaded task skill (reactive to layer + language) */
export const activeTaskSkillFile = computed(() => {
  if (!activeTaskLayer.value) return ''
  const layer = activeTaskLayer.value.toLowerCase()
  const lang = currentLang.value
  return `coach-skill-task-${layer}-${lang}.md`
})

/** Human-readable label shown in UI badges */
export const activeTaskSkillName = computed(() => {
  if (!activeTaskLayer.value) return ''
  return `Task Coach (${activeTaskLayer.value})`
})

// ─── Default getters ────────────────────────────────────────────────────────

export function getCoachSkillTaskDefault(lang: 'zh' | 'en', layer?: string): string {
  const key = layer || activeTaskLayer.value || 'SW'
  const entry = TASK_SKILL_MAP[key] ?? TASK_SKILL_MAP['SW']
  return lang === 'zh' ? entry.zh : entry.en
}

export function getAnalyzeSkillDefault(lang: 'zh' | 'en'): string {
  return lang === 'zh' ? analyzeSkillZh : analyzeSkillEn
}

/** Get the response format instructions (appended to all system prompts) */
export function getResponseFormatDefault(): string {
  return responseFormatDefault
}

export function getResponseFormat(): string {
  return localStorage.getItem(LS_KEY_RESPONSE_FORMAT) ?? responseFormatDefault
}

/** Get effective coach skill — uses task coach skill with response format appended */
export function getCoachSkill(_mode: AppMode, lang: 'zh' | 'en'): string {
  const skill = localStorage.getItem(LS_KEY_COACH_SKILL_TASK) ?? getCoachSkillTaskDefault(lang)
  return skill + '\n\n' + getResponseFormat()
}

/** Get effective analyze skill with response format appended */
export function getAnalyzeSkill(_mode: AppMode, lang: 'zh' | 'en'): string {
  const skill = localStorage.getItem(LS_KEY_ANALYZE_SKILL) ?? getAnalyzeSkillDefault(lang)
  return skill + '\n\n' + getResponseFormat()
}

/** Get raw skill content WITHOUT response format (for editing in settings UI) */
export function getAnalyzeSkillRaw(lang: 'zh' | 'en'): string {
  return localStorage.getItem(LS_KEY_ANALYZE_SKILL) ?? getAnalyzeSkillDefault(lang)
}

export function getCoachSkillTaskRaw(lang: 'zh' | 'en'): string {
  return localStorage.getItem(LS_KEY_COACH_SKILL_TASK) ?? getCoachSkillTaskDefault(lang)
}

export function setAnalyzeSkill(content: string): void {
  localStorage.setItem(LS_KEY_ANALYZE_SKILL, content)
  analyzeSkillModified.value = true
}

export function setCoachSkillTask(content: string): void {
  localStorage.setItem(LS_KEY_COACH_SKILL_TASK, content)
  coachSkillTaskModified.value = true
}

export function resetAnalyzeSkill(): void {
  localStorage.removeItem(LS_KEY_ANALYZE_SKILL)
  analyzeSkillModified.value = false
}

export function resetCoachSkillTask(): void {
  localStorage.removeItem(LS_KEY_COACH_SKILL_TASK)
  coachSkillTaskModified.value = false
}

export function setResponseFormat(content: string): void {
  localStorage.setItem(LS_KEY_RESPONSE_FORMAT, content)
  responseFormatModified.value = true
}

export function resetResponseFormat(): void {
  localStorage.removeItem(LS_KEY_RESPONSE_FORMAT)
  responseFormatModified.value = false
}
