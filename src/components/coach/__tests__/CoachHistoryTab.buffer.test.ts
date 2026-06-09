import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
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

import CoachHistoryTab from '../CoachHistoryTab.vue'
import { addRecord, clearHistory, startNewSession, MAX_RECORDS } from '@/composables/useCoachHistory'

const stubs = { ConfirmDialog: true, DownloadModal: true }

function mountExplore() {
  return mount(CoachHistoryTab, { props: { channel: 'explore' }, global: { stubs } })
}

beforeEach(() => {
  Object.keys(storage).forEach(k => delete storage[k])
  clearHistory()
})

describe('CoachHistoryTab buffer indicator', () => {
  it('shows the global count over the cap with a proportional fill', () => {
    startNewSession('explore')
    addRecord('user', 'a', 'explore')
    addRecord('user', 'b', 'explore')
    const wrapper = mountExplore()
    expect(wrapper.find('.buffer-count').text()).toBe(`2 / ${MAX_RECORDS}`)
    const w = (wrapper.find('.buffer-fill').attributes('style') || '')
    expect(w).toContain(`width: ${Math.round((2 / MAX_RECORDS) * 100)}%`)
  })

  it('counts logs from ALL channels (global buffer), not just the viewed channel', () => {
    startNewSession('task')
    addRecord('user', 'task1', 'task')
    addRecord('user', 'task2', 'task')
    startNewSession('explore')
    addRecord('user', 'explore1', 'explore')
    const wrapper = mountExplore()
    // Viewed list is explore-only, but the buffer count includes task records.
    expect(wrapper.find('.buffer-count').text()).toBe(`3 / ${MAX_RECORDS}`)
  })

  it('applies the warn class at/above the warn threshold (180)', () => {
    startNewSession('explore')
    for (let i = 0; i < 180; i++) addRecord('user', `m${i}`, 'explore')
    const wrapper = mountExplore()
    expect(wrapper.find('.buffer-indicator').classes()).toContain('buffer-warn')
    expect(wrapper.find('.buffer-indicator').classes()).not.toContain('buffer-full')
  })

  it('applies the full class and caps at MAX_RECORDS', () => {
    startNewSession('explore')
    for (let i = 0; i < MAX_RECORDS + 10; i++) addRecord('user', `m${i}`, 'explore')
    const wrapper = mountExplore()
    expect(wrapper.find('.buffer-count').text()).toBe(`${MAX_RECORDS} / ${MAX_RECORDS}`)
    expect(wrapper.find('.buffer-indicator').classes()).toContain('buffer-full')
    expect(wrapper.find('.buffer-fill').attributes('style')).toContain('width: 100%')
  })
})
