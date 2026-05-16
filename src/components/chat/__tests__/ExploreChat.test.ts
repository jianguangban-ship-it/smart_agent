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

import ExploreChat from '../ExploreChat.vue'
import type { ChatMessage } from '@/types/api'

const msgs: ChatMessage[] = [
  { id: 'u1', role: 'user', content: 'hi', timestamp: 1 },
  { id: 'a1', role: 'assistant', content: 'hello', timestamp: 2 },
]

describe('ExploreChat', () => {
  it('renders messages and emits send with composer text, then clears', async () => {
    const wrapper = mount(ExploreChat, {
      props: { messages: msgs, isLoading: false, hadError: false, backoffSecs: 0 },
      global: { stubs: { ChatBubble: { template: '<div class="bubble">{{ message.content }}</div>', props: ['message','hashId'] } } },
    })
    expect(wrapper.findAll('.bubble')).toHaveLength(2)

    const ta = wrapper.get('textarea')
    await ta.setValue('what is OS load estimation')
    await wrapper.get('.explore-send').trigger('click')

    expect(wrapper.emitted('send')?.[0]).toEqual(['what is OS load estimation'])
    expect((ta.element as HTMLTextAreaElement).value).toBe('')
  })

  it('Enter sends, Shift+Enter does not', async () => {
    const wrapper = mount(ExploreChat, {
      props: { messages: [], isLoading: false, hadError: false, backoffSecs: 0 },
      global: { stubs: { ChatBubble: true } },
    })
    const ta = wrapper.get('textarea')
    await ta.setValue('q1')
    await ta.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.emitted('send')).toBeFalsy()
    await ta.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('send')?.[0]).toEqual(['q1'])
  })

  it('shows Stop while loading and emits cancel', async () => {
    const wrapper = mount(ExploreChat, {
      props: { messages: [], isLoading: true, hadError: false, backoffSecs: 0 },
      global: { stubs: { ChatBubble: true } },
    })
    await wrapper.get('.explore-stop').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})
