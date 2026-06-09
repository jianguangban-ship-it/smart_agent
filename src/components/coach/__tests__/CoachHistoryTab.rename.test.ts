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
import { addRecord, clearHistory, startNewSession, getSessionName, coachHistory } from '@/composables/useCoachHistory'

const stubs = { ConfirmDialog: true, DownloadModal: true }

beforeEach(() => {
  Object.keys(storage).forEach(k => delete storage[k])
  clearHistory()
  startNewSession('explore')
  addRecord('user', 'EXPLORE_FIRST_MSG', 'explore')
})

function exploreSessionId(): string {
  return coachHistory.value.find(r => r.channel === 'explore')!.sessionId!
}

describe('CoachHistoryTab rename', () => {
  it('shows the auto-preview by default with a rename pencil', () => {
    const wrapper = mount(CoachHistoryTab, { props: { channel: 'explore' }, global: { stubs } })
    expect(wrapper.text()).toContain('EXPLORE_FIRST_MSG')
    expect(wrapper.find('.session-rename-btn').exists()).toBe(true)
    expect(wrapper.find('.session-rename-input').exists()).toBe(false)
  })

  it('renames the header and persists the custom name', async () => {
    const wrapper = mount(CoachHistoryTab, { props: { channel: 'explore' }, global: { stubs } })
    await wrapper.find('.session-rename-btn').trigger('click')
    const input = wrapper.find('.session-rename-input')
    expect(input.exists()).toBe(true)
    await input.setValue('My renamed chat')
    await input.trigger('keyup.enter')

    // Assert on the header title specifically (the message text still appears in
    // the expanded record body, which is expected).
    expect(wrapper.find('.session-preview').text()).toBe('My renamed chat')
    expect(getSessionName(exploreSessionId())).toBe('My renamed chat')
  })

  it('reverts to the auto-preview when the name is cleared', async () => {
    const wrapper = mount(CoachHistoryTab, { props: { channel: 'explore' }, global: { stubs } })
    await wrapper.find('.session-rename-btn').trigger('click')
    await wrapper.find('.session-rename-input').setValue('Temp')
    await wrapper.find('.session-rename-input').trigger('keyup.enter')
    expect(wrapper.find('.session-preview').text()).toBe('Temp')

    await wrapper.find('.session-rename-btn').trigger('click')
    await wrapper.find('.session-rename-input').setValue('')
    await wrapper.find('.session-rename-input').trigger('keyup.enter')
    expect(wrapper.find('.session-preview').text()).toBe('EXPLORE_FIRST_MSG')
    expect(getSessionName(exploreSessionId())).toBeUndefined()
  })

  it('Esc cancels without saving', async () => {
    const wrapper = mount(CoachHistoryTab, { props: { channel: 'explore' }, global: { stubs } })
    await wrapper.find('.session-rename-btn').trigger('click')
    await wrapper.find('.session-rename-input').setValue('Discarded')
    await wrapper.find('.session-rename-input').trigger('keyup.esc')
    expect(getSessionName(exploreSessionId())).toBeUndefined()
    expect(wrapper.text()).toContain('EXPLORE_FIRST_MSG')
  })
})
