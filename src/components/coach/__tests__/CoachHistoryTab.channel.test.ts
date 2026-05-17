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
  startNewSession('task')
  addRecord('user', 'TASK_ONLY_MSG', 'task')
  startNewSession('explore')
  addRecord('user', 'EXPLORE_ONLY_MSG', 'explore')
})

describe('CoachHistoryTab channel scoping', () => {
  it('defaults to the task channel', () => {
    const wrapper = mount(CoachHistoryTab, { global: { stubs } })
    expect(wrapper.text()).toContain('TASK_ONLY_MSG')
    expect(wrapper.text()).not.toContain('EXPLORE_ONLY_MSG')
  })

  it('channel="explore" shows only explore records', () => {
    const wrapper = mount(CoachHistoryTab, { props: { channel: 'explore' }, global: { stubs } })
    expect(wrapper.text()).toContain('EXPLORE_ONLY_MSG')
    expect(wrapper.text()).not.toContain('TASK_ONLY_MSG')
  })
})
