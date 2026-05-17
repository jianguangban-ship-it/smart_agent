import { describe, it, expect, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'

const storage: Record<string, string> = {}
beforeAll(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
  } as Storage
})

import ChatBubble from '../ChatBubble.vue'
import type { ChatMessage } from '@/types/api'

const userMsg: ChatMessage = { id: 'u1', role: 'user', content: 'hello', timestamp: 1 }

describe('ChatBubble layout prop', () => {
  it('defaults to bubble layout with the side avatar column (Task unchanged)', () => {
    const wrapper = mount(ChatBubble, { props: { message: userMsg } })
    expect(wrapper.find('.chat-msg.layout-bubble').exists()).toBe(true)
    expect(wrapper.find('.chat-msg.layout-stacked').exists()).toBe(false)
    expect(wrapper.find('.msg-avatar-col').exists()).toBe(true)
    expect(wrapper.find('.msg-avatar-inline').exists()).toBe(false)
  })

  it('stacked layout drops the side column and uses an inline avatar', () => {
    const wrapper = mount(ChatBubble, { props: { message: userMsg, layout: 'stacked' } })
    expect(wrapper.find('.chat-msg.layout-stacked').exists()).toBe(true)
    expect(wrapper.find('.msg-avatar-col').exists()).toBe(false)
    expect(wrapper.find('.msg-avatar-inline').exists()).toBe(true)
  })
})
