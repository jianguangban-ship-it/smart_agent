import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'

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

import ChatsPage from '../ChatsPage.vue'
import { addRecord, clearHistory, startNewSession } from '@/composables/useCoachHistory'

const ConfirmStub = {
  template: '<div class="confirm"><button class="confirm-yes" @click="$emit(\'confirm\')"></button></div>',
  props: ['title', 'message'], emits: ['confirm', 'cancel'],
}
const DownloadStub = {
  template: '<div class="dl"></div>', props: ['recordCount'], emits: ['select', 'cancel'],
}

function seed() {
  clearHistory()
  startNewSession('explore'); addRecord('user', 'alpha chat about brakes', 'explore')
  startNewSession('explore'); addRecord('user', 'beta chat about steering', 'explore')
  startNewSession('explore'); addRecord('user', 'gamma chat about suspension', 'explore')
}
function mountPage(): VueWrapper {
  return mount(ChatsPage, { global: { stubs: { ConfirmDialog: ConfirmStub, DownloadModal: DownloadStub } } })
}

beforeEach(seed)

describe('ChatsPage', () => {
  it('lists all chats and filters by search', async () => {
    const w = mountPage()
    expect(w.findAll('.chats-row')).toHaveLength(3)
    await w.find('.chats-search').setValue('steering')
    const rows = w.findAll('.chats-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('beta chat about steering')
  })

  it('row click (not selecting) emits select; New chat emits new-chat', async () => {
    const w = mountPage()
    await w.findAll('.chats-row')[0].trigger('click')
    expect(w.emitted('select')).toBeTruthy()
    await w.find('.chats-btn-newchat').trigger('click')
    expect(w.emitted('new-chat')).toBeTruthy()
  })

  it('Select chats reveals checkboxes + Select all selects every row', async () => {
    const w = mountPage()
    await w.find('.chats-btn-select').trigger('click')
    expect(w.findAll('.chats-checkbox')).toHaveLength(3)
    await w.find('.chats-btn-selectall').trigger('click')
    expect(w.findAll('.chats-row.selected')).toHaveLength(3)
  })

  it('DownloadRaw opens the format modal when rows are selected', async () => {
    const w = mountPage()
    await w.find('.chats-btn-select').trigger('click')
    await w.find('.chats-btn-selectall').trigger('click')
    await w.find('.chats-btn-download').trigger('click')
    expect(w.find('.dl').exists()).toBe(true)
  })

  it('Delete (confirmed) removes the selected chats', async () => {
    const w = mountPage()
    await w.find('.chats-btn-select').trigger('click')
    await w.find('.chats-btn-selectall').trigger('click')
    await w.find('.chats-btn-danger').trigger('click')
    await w.find('.confirm-yes').trigger('click')
    expect(w.findAll('.chats-row')).toHaveLength(0)
    expect(w.find('.chats-empty').exists()).toBe(true)
  })
})
