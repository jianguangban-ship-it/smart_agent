import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

const storage: Record<string, string> = {}
beforeAll(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
  } as Storage
})

import AppHeader from '../AppHeader.vue'
import { appMode } from '@/composables/useAppMode'

const SprintStub = { template: '<div />' }

function mountHeader(props: Record<string, unknown> = {}) {
  return mount(AppHeader, {
    props,
    global: { stubs: { SprintIndicator: SprintStub } },
  })
}

afterEach(() => { appMode.value = 'task' })

describe('AppHeader — cross-mode reply chip', () => {
  it('is hidden when readyMode is null', () => {
    appMode.value = 'task'
    expect(mountHeader({ readyMode: null }).find('.reply-chip').exists()).toBe(false)
  })

  it('is hidden when readyMode equals the active mode (no self-noise)', () => {
    appMode.value = 'task'
    expect(mountHeader({ readyMode: 'task' }).find('.reply-chip').exists()).toBe(false)
  })

  it('shows for a background mode and clicking it switches mode', async () => {
    appMode.value = 'task'
    const wrapper = mountHeader({ readyMode: 'explore' })
    const chip = wrapper.find('.reply-chip')
    expect(chip.exists()).toBe(true)
    expect(chip.classes()).toContain('reply-chip--explore')
    expect(chip.text().length).toBeGreaterThan(0)

    await chip.trigger('click')
    expect(appMode.value).toBe('explore') // setMode('explore') fired
  })
})
