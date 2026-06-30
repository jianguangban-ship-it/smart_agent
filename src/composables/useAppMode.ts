import { ref } from 'vue'
import { setCoachSkillEnabled } from '@/composables/useLLM'

export type AppMode = 'explore' | 'task' | 'view' | 'config'

const LS_KEY_MODE = 'app-mode'

export const validModes: AppMode[] = ['explore', 'task', 'view', 'config']

/** Drive coachSkillEnabled from the current mode. */
export function applyModeFlags(mode: AppMode): void {
  // Task is the only mode that uses the structured task-coach skill.
  // Explore is free-chat. View and Config are read-only — no LLM at all.
  setCoachSkillEnabled(mode === 'task')
}

const stored = localStorage.getItem(LS_KEY_MODE)
const initial: AppMode = stored && (validModes as string[]).includes(stored) ? (stored as AppMode) : 'task'

export const appMode = ref<AppMode>(initial)

// Apply flags on startup so coachSkillEnabled matches the restored mode
applyModeFlags(initial)

/**
 * Switch to a new mode. Sets appMode and drives the skill flag.
 * Form/workflow/AI state is preserved on mode switch — only the visible UI changes.
 */
export function setMode(mode: AppMode): void {
  appMode.value = mode
  localStorage.setItem(LS_KEY_MODE, mode)
  applyModeFlags(mode)
}
