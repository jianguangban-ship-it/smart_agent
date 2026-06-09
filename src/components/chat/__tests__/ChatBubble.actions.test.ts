import { describe, it, expect, beforeAll, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const storage: Record<string, string> = {}
beforeAll(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
  } as Storage
})

// copyText must be mocked: the real one touches navigator.clipboard / DOM.
const copyText = vi.fn(async (_text: string) => true)
vi.mock('@/utils/clipboard', () => ({
  copyText: (...args: [string]) => copyText(...args),
}))

import ChatBubble from '../ChatBubble.vue'
import type { ChatMessage } from '@/types/api'

const userMsg: ChatMessage = { id: 'u1', role: 'user', content: 'hello world', timestamp: Date.now() }

describe('ChatBubble user meta-row (Explore/stacked)', () => {
  it('renders date + Retry/Edit/Copy buttons on a stacked user message', () => {
    const wrapper = mount(ChatBubble, { props: { message: userMsg, layout: 'stacked' } })
    expect(wrapper.find('.msg-user-meta').exists()).toBe(true)
    expect(wrapper.find('.msg-user-date').text().length).toBeGreaterThan(0)
    expect(wrapper.findAll('.msg-icon-btn')).toHaveLength(3)
  })

  it('does NOT render the meta-row in bubble (Task) layout', () => {
    const wrapper = mount(ChatBubble, { props: { message: userMsg, layout: 'bubble' } })
    expect(wrapper.find('.msg-user-meta').exists()).toBe(false)
  })

  it('emits retry with the message id', async () => {
    const wrapper = mount(ChatBubble, { props: { message: userMsg, layout: 'stacked' } })
    await wrapper.findAll('.msg-icon-btn')[0].trigger('click') // Retry
    expect(wrapper.emitted('retry')?.[0]).toEqual(['u1'])
  })

  it('copies the message text via copyText', async () => {
    copyText.mockClear()
    const wrapper = mount(ChatBubble, { props: { message: userMsg, layout: 'stacked' } })
    await wrapper.findAll('.msg-icon-btn')[2].trigger('click') // Copy
    expect(copyText).toHaveBeenCalledWith('hello world')
  })

  it('inline-edits and emits edit with the new content', async () => {
    const wrapper = mount(ChatBubble, { props: { message: userMsg, layout: 'stacked' } })
    await wrapper.findAll('.msg-icon-btn')[1].trigger('click') // Edit
    const area = wrapper.find('textarea.msg-user-edit-area')
    expect(area.exists()).toBe(true)
    await area.setValue('edited text')
    await wrapper.findAll('.msg-user-edit-actions .msg-action-btn')[0].trigger('click') // Save
    expect(wrapper.emitted('edit')?.[0]).toEqual([{ id: 'u1', content: 'edited text' }])
  })
})

describe('ChatBubble assistant elapsed header + empty state', () => {
  it('renders "Thought for Xs" when firstTokenMs is set', () => {
    const msg: ChatMessage = {
      id: 'a1', role: 'assistant', content: 'done', timestamp: 1, firstTokenMs: 2300,
    }
    const wrapper = mount(ChatBubble, { props: { message: msg, layout: 'stacked' } })
    const el = wrapper.find('.msg-elapsed')
    expect(el.exists()).toBe(true)
    expect(el.text()).toContain('2.3s')
  })

  it('shows the thinking orb and NO "No content available" before the first token', () => {
    const msg: ChatMessage = {
      id: 'a2', role: 'assistant', content: '', timestamp: 1, isStreaming: true,
    }
    const wrapper = mount(ChatBubble, { props: { message: msg, layout: 'stacked' } })
    expect(wrapper.find('.thinking-orb-row').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('No content available')
    expect(wrapper.find('.coach-empty').exists()).toBe(false)
  })
})
