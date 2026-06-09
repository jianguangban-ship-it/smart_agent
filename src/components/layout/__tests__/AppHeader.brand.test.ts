import { describe, it, expect, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'

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

import AppHeader from '../AppHeader.vue'
import { useI18n } from '@/i18n'

const stubs = { SprintIndicator: true }

describe('AppHeader EAX brand mark', () => {
  it('renders the EAX wordmark with an emphasized X and aria-label', () => {
    const wrapper = mount(AppHeader, { global: { stubs } })
    const title = wrapper.find('.brand-eax')
    expect(title.exists()).toBe(true)
    expect(title.attributes('aria-label')).toBe('EAX')
    expect(title.text()).toBe('EAX')
    expect(wrapper.find('.brand-x').exists()).toBe(true)
    expect(wrapper.find('.brand-x').text()).toBe('X')
  })

  it('renders three dots colored to match the E/A/X letters', () => {
    const wrapper = mount(AppHeader, { global: { stubs } })
    expect(wrapper.find('.dot-e').exists()).toBe(true)
    expect(wrapper.find('.dot-a').exists()).toBe(true)
    expect(wrapper.find('.dot-x').exists()).toBe(true)
  })

  it('keeps the brand mark as EAX regardless of language toggle', () => {
    const { setLang } = useI18n()
    setLang('zh')
    const wrapper = mount(AppHeader, { global: { stubs } })
    expect(wrapper.find('.brand-eax').text()).toBe('EAX')
    setLang('en')
  })

  it('no longer renders the old AGec logo spans', () => {
    const wrapper = mount(AppHeader, { global: { stubs } })
    expect(wrapper.find('.logo-a').exists()).toBe(false)
    expect(wrapper.find('.logo-ec').exists()).toBe(false)
  })
})
