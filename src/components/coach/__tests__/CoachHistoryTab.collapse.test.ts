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
import { addRecord, clearHistory, startNewSession } from '@/composables/useCoachHistory'

const stubs = { ConfirmDialog: true, DownloadModal: true }

beforeEach(() => {
  Object.keys(storage).forEach(k => delete storage[k])
  clearHistory()
  startNewSession('explore')
  addRecord('user', 'EXPLORE_MSG', 'explore')
})

describe('CoachHistoryTab default collapse', () => {
  it('renders session cards collapsed by default (no open attribute)', () => {
    const wrapper = mount(CoachHistoryTab, { props: { channel: 'explore' }, global: { stubs } })
    const details = wrapper.find('.session-group')
    expect(details.exists()).toBe(true)
    expect(details.attributes('open')).toBeUndefined()
  })

  it('still shows the session header (preview + rename) while collapsed', () => {
    const wrapper = mount(CoachHistoryTab, { props: { channel: 'explore' }, global: { stubs } })
    expect(wrapper.find('.session-preview').text()).toBe('EXPLORE_MSG')
    expect(wrapper.find('.session-rename-btn').exists()).toBe(true)
    expect(wrapper.find('.continue-btn').exists()).toBe(true)
  })
})
