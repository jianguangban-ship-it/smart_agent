import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
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

// Keep all of useCoachHistory real except exportRecords, which we spy on so the
// test never hits the DOM download path.
vi.mock('@/composables/useCoachHistory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/useCoachHistory')>()
  return { ...actual, exportRecords: vi.fn() }
})

import CoachHistoryTab from '../CoachHistoryTab.vue'
import { addRecord, clearHistory, startNewSession, setSessionName, coachHistory, exportRecords } from '@/composables/useCoachHistory'

// Stub the modal so we can drive the format selection.
const DownloadModalStub = {
  template: '<div class="dl-modal" @click="$emit(\'select\', \'markdown\')" />',
  props: ['recordCount'],
  emits: ['select', 'cancel'],
}
const stubs = { ConfirmDialog: true, DownloadModal: DownloadModalStub }

beforeEach(() => {
  Object.keys(storage).forEach(k => delete storage[k])
  clearHistory()
  startNewSession('explore')
  addRecord('user', 'EXPLORE_FIRST_MSG', 'explore')
  ;(exportRecords as unknown as ReturnType<typeof vi.fn>).mockClear()
})

function exploreSessionId(): string {
  return coachHistory.value.find(r => r.channel === 'explore')!.sessionId!
}

describe('CoachHistoryTab per-session download', () => {
  it('renders a download button in the session header', () => {
    const wrapper = mount(CoachHistoryTab, { props: { channel: 'explore' }, global: { stubs } })
    expect(wrapper.find('.session-download-btn').exists()).toBe(true)
  })

  it('opens the modal scoped to the session record count', async () => {
    const wrapper = mount(CoachHistoryTab, { props: { channel: 'explore' }, global: { stubs } })
    await wrapper.find('.session-download-btn').trigger('click')
    const modal = wrapper.findComponent(DownloadModalStub)
    expect(modal.exists()).toBe(true)
    expect(modal.props('recordCount')).toBe(1)
  })

  it('exports only the session records, named by the session label', async () => {
    setSessionName(exploreSessionId(), 'My Chat')
    const wrapper = mount(CoachHistoryTab, { props: { channel: 'explore' }, global: { stubs } })
    await wrapper.find('.session-download-btn').trigger('click')
    await wrapper.find('.dl-modal').trigger('click') // emits select('markdown')

    expect(exportRecords).toHaveBeenCalledTimes(1)
    const [records, format, baseName] = (exportRecords as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(format).toBe('markdown')
    expect(baseName).toBe('My Chat')
    expect(records).toHaveLength(1)
    expect(records[0].content).toBe('EXPLORE_FIRST_MSG')
  })

  it('falls back to the first-message preview when the session is unnamed', async () => {
    const wrapper = mount(CoachHistoryTab, { props: { channel: 'explore' }, global: { stubs } })
    await wrapper.find('.session-download-btn').trigger('click')
    await wrapper.find('.dl-modal').trigger('click')
    const [, , baseName] = (exportRecords as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(baseName).toBe('EXPLORE_FIRST_MSG')
  })
})
