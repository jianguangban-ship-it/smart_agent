import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'

const storage: Record<string, string> = {}
beforeAll(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => {}, key: () => null, length: 0,
  } as Storage
})

import ChatSearchModal from '../ChatSearchModal.vue'

const now = Date.now()
const ITEMS = [
  { sessionId: 's1', title: 'Vehicle dynamics model', lastTimestamp: now, haystack: 'vehicle dynamics model kalman filter' },
  { sessionId: 's2', title: 'Brake controller review', lastTimestamp: now - 3 * 86_400_000, haystack: 'brake controller review abs' },
  { sessionId: 's3', title: 'Steering calibration', lastTimestamp: now - 40 * 86_400_000, haystack: 'steering calibration eps' },
]

let wrapper: VueWrapper | null = null
function mountModal() {
  wrapper = mount(ChatSearchModal, { props: { open: true, items: ITEMS } })
}
afterEach(() => { wrapper?.unmount(); wrapper = null })

describe('ChatSearchModal', () => {
  it('lists all items, then filters by title/content', async () => {
    mountModal()
    expect(wrapper!.findAll('.search-result')).toHaveLength(3)

    await wrapper!.find('.search-input').setValue('kalman') // only in s1's haystack
    const rows = wrapper!.findAll('.search-result')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('Vehicle dynamics model')
  })

  it('ArrowDown + Enter selects the highlighted chat and closes', async () => {
    mountModal()
    const input = wrapper!.find('.search-input')
    await input.trigger('keydown', { key: 'ArrowDown' }) // highlight index 1
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper!.emitted('select')?.[0]).toEqual(['s2'])
    expect(wrapper!.emitted('update:open')?.[0]).toEqual([false])
  })

  it('clicking a row selects it', async () => {
    mountModal()
    await wrapper!.findAll('.search-result')[2].trigger('click')
    expect(wrapper!.emitted('select')?.[0]).toEqual(['s3'])
  })

  it('Escape and ✕ close the modal', async () => {
    mountModal()
    await wrapper!.find('.search-input').trigger('keydown', { key: 'Escape' })
    expect(wrapper!.emitted('update:open')?.[0]).toEqual([false])

    wrapper!.unmount()
    mountModal()
    await wrapper!.find('.search-close').trigger('click')
    expect(wrapper!.emitted('update:open')?.[0]).toEqual([false])
  })

  it('pre-selects the active chat on open so "Enter" returns there', async () => {
    wrapper = mount(ChatSearchModal, { props: { open: false, items: ITEMS, activeId: 's2' } })
    await wrapper.setProps({ open: true })
    await nextTick(); await nextTick()

    const rows = wrapper.findAll('.search-result')
    expect(rows[1].classes()).toContain('highlighted') // s2 is index 1
    expect(rows[1].text()).toContain('Enter')
    expect(rows[0].classes()).not.toContain('highlighted')

    // Enter (without arrowing) returns to the active chat.
    await wrapper.find('.search-input').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select')?.[0]).toEqual(['s2'])
  })

  it('shows a no-results message when nothing matches', async () => {
    mountModal()
    await wrapper!.find('.search-input').setValue('zzzzz')
    expect(wrapper!.find('.search-empty').exists()).toBe(true)
    expect(wrapper!.findAll('.search-result')).toHaveLength(0)
  })
})
