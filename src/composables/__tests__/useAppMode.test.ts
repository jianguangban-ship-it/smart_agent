import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/composables/useLLM', () => ({
  setCoachSkillEnabled: vi.fn()
}))

const storage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v },
  removeItem: (k: string) => { delete storage[k] }
})

import { appMode, setMode, applyModeFlags, validModes } from '../useAppMode'
import { setCoachSkillEnabled } from '@/composables/useLLM'

describe('useAppMode', () => {
  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k])
    vi.clearAllMocks()
  })

  it('defaults to "task" when no localStorage value', () => {
    expect(validModes).toContain(appMode.value)
  })

  it('setMode("explore") sets appMode and persists to localStorage', () => {
    setMode('explore')
    expect(appMode.value).toBe('explore')
    expect(storage['app-mode']).toBe('explore')
  })

  it('setMode("task") sets appMode and persists to localStorage', () => {
    setMode('task')
    expect(appMode.value).toBe('task')
    expect(storage['app-mode']).toBe('task')
  })

  it('applyModeFlags explore → coachSkillEnabled=false', () => {
    applyModeFlags('explore')
    expect(setCoachSkillEnabled).toHaveBeenCalledWith(false)
  })

  it('applyModeFlags task → coachSkillEnabled=true', () => {
    applyModeFlags('task')
    expect(setCoachSkillEnabled).toHaveBeenCalledWith(true)
  })

  it('setMode drives applyModeFlags', () => {
    setMode('explore')
    expect(setCoachSkillEnabled).toHaveBeenCalledWith(false)
    setMode('task')
    expect(setCoachSkillEnabled).toHaveBeenCalledWith(true)
  })
})
