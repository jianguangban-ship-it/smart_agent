import { ref } from 'vue'
import { setCoachSkillEnabled, setTaskCoachEnabled } from '@/composables/useLLM'

export type AppMode = 'explore' | 'task'

const LS_KEY_MODE = 'app-mode'

const validModes: AppMode[] = ['explore', 'task']

/** Drive coachSkillEnabled + taskCoachEnabled from the current mode. */
export function applyModeFlags(mode: AppMode): void {
  if (mode === 'explore') {
    setCoachSkillEnabled(false)
    setTaskCoachEnabled(false)
  } else {
    setCoachSkillEnabled(true)
    setTaskCoachEnabled(true)
  }
}

const stored = localStorage.getItem(LS_KEY_MODE)
const initial: AppMode = stored && (validModes as string[]).includes(stored) ? (stored as AppMode) : 'task'

export const appMode = ref<AppMode>(initial)

// Apply flags on startup so coachSkillEnabled/taskCoachEnabled match the restored mode
applyModeFlags(initial)

/**
 * Switch to a new mode. Sets appMode and drives skill flags.
 * Form/workflow/AI state is preserved on mode switch — only the visible UI changes.
 */
export function setMode(mode: AppMode): void {
  appMode.value = mode
  localStorage.setItem(LS_KEY_MODE, mode)
  applyModeFlags(mode)
}
