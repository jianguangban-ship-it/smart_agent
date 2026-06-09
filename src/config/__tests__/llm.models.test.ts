import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

const storage: Record<string, string> = {}
beforeAll(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
    key: () => null, length: 0,
  } as Storage
})

import {
  getModel1, getModel2, getTaskModel, getExploreModel,
  setModel1, setModel2, setExploreModel,
  availableModels, exploreModel, GLM_DEFAULT_MODEL,
  isVisionModel,
} from '@/config/llm'

beforeEach(() => {
  Object.keys(storage).forEach(k => delete storage[k])
  // Reset the singleton refs to a known baseline.
  setModel1('m1')
  setModel2('')
  setExploreModel('m1')
})

describe('two-model config', () => {
  it('migrates the legacy single `glm-model` into Model 1', () => {
    delete storage['model-1']
    storage['glm-model'] = 'legacy-model'
    expect(getModel1()).toBe('legacy-model')
  })

  it('Model 1 falls back to the default when nothing is set', () => {
    delete storage['model-1']
    delete storage['glm-model']
    expect(getModel1()).toBe(GLM_DEFAULT_MODEL)
  })

  it('Task model is always Model 1', () => {
    setModel1('task-x')
    expect(getTaskModel()).toBe('task-x')
  })

  it('availableModels lists both, dropping an empty Model 2', () => {
    setModel1('a'); setModel2('b')
    expect(availableModels.value).toEqual(['a', 'b'])
    setModel2('')
    expect(availableModels.value).toEqual(['a'])
  })

  it('Explore selection persists and is honoured when configured', () => {
    setModel1('a'); setModel2('b')
    setExploreModel('b')
    expect(getExploreModel()).toBe('b')
    expect(storage['explore-model']).toBe('b')
  })

  it('Explore selection falls back to Model 1 when not a configured model', () => {
    setModel1('a'); setModel2('')
    setExploreModel('ghost') // not configured
    expect(getExploreModel()).toBe('a')
  })

  it('reconciles the Explore selection when a settings edit removes it', () => {
    setModel1('a'); setModel2('b')
    setExploreModel('b')
    expect(exploreModel.value).toBe('b')
    setModel2('') // 'b' no longer configured
    expect(exploreModel.value).toBe('a')
  })
})

describe('isVisionModel', () => {
  it('flags vision-capable models (case-insensitive substring)', () => {
    expect(isVisionModel('default/qwen36-35b-a3b')).toBe(true)
    expect(isVisionModel('GPT-4o')).toBe(true)
    expect(isVisionModel('claude-opus-4-8')).toBe(true)
  })
  it('returns false for text-only models', () => {
    expect(isVisionModel('default/minimax-m2-7')).toBe(false)
    expect(isVisionModel('glm-4.7-flash')).toBe(false)
  })
})
