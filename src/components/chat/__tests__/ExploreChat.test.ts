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

const ChatBubbleStub = {
  template: '<div class="bubble" :data-layout="layout">{{ message.content }}</div>',
  props: ['message', 'hashId', 'layout'],
}
const HistoryStub = {
  template:
    '<div class="hist">' +
    '<button class="hist-replay" @click="$emit(\'replay\', \'redo me\')"></button>' +
    '<button class="hist-cont" @click="$emit(\'continue-session\', \'sess1\')"></button>' +
    '</div>',
  props: ['channel'],
  emits: ['replay', 'continue-session'],
}

function mountChat(props: Record<string, unknown> = {}) {
  return mount(ExploreChat, {
    props: { messages: msgs, isLoading: false, hadError: false, backoffSecs: 0, ...props },
    global: { stubs: { ChatBubble: ChatBubbleStub, CoachHistoryTab: HistoryStub } },
  })
}

describe('ExploreChat', () => {
  it('renders messages and emits send with composer text, then clears', async () => {
    const wrapper = mountChat()
    expect(wrapper.findAll('.bubble')).toHaveLength(2)
    const ta = wrapper.get('textarea')
    await ta.setValue('what is OS load estimation')
    await wrapper.get('.explore-send').trigger('click')
    expect(wrapper.emitted('send')?.[0]).toEqual(['what is OS load estimation'])
    expect((ta.element as HTMLTextAreaElement).value).toBe('')
  })

  it('Enter sends, Shift+Enter does not', async () => {
    const wrapper = mountChat({ messages: [] })
    const ta = wrapper.get('textarea')
    await ta.setValue('q1')
    await ta.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.emitted('send')).toBeFalsy()
    await ta.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('send')?.[0]).toEqual(['q1'])
  })

  it('shows Stop while loading and emits cancel', async () => {
    const wrapper = mountChat({ messages: [], isLoading: true })
    await wrapper.get('.explore-stop').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('renders the empty state as a split hero (title + subline)', () => {
    const wrapper = mountChat({ messages: [] })
    const title = wrapper.find('.explore-empty-title')
    const sub = wrapper.find('.explore-empty-sub')
    expect(title.exists()).toBe(true)
    expect(sub.exists()).toBe(true)
    expect(title.text().length).toBeGreaterThan(0)
    expect(sub.text().length).toBeGreaterThan(0)
    // Split into two nodes — not the old single combined sentence.
    expect(title.text()).not.toContain(sub.text())
  })

  it('does not render the "AI CHAT" title text', () => {
    const wrapper = mountChat()
    expect(wrapper.find('.explore-title').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/AI CHAT/i)
  })

  it('passes layout="stacked" to ChatBubble', () => {
    const wrapper = mountChat()
    expect(wrapper.get('.bubble').attributes('data-layout')).toBe('stacked')
  })

  it('Chat/History tab switch — composer only on Chat tab', async () => {
    const wrapper = mountChat()
    expect(wrapper.find('.explore-composer').exists()).toBe(true)
    expect(wrapper.find('.hist').exists()).toBe(false)

    await wrapper.findAll('.explore-tab')[1].trigger('click') // History
    expect(wrapper.find('.explore-composer').exists()).toBe(false)
    expect(wrapper.find('.hist').exists()).toBe(true)

    await wrapper.findAll('.explore-tab')[0].trigger('click') // Chat
    expect(wrapper.find('.explore-composer').exists()).toBe(true)
  })

  it('New chat clears the composer draft and emits new-chat', async () => {
    const wrapper = mountChat()
    const ta = wrapper.get('textarea')
    await ta.setValue('half-typed message')
    expect((ta.element as HTMLTextAreaElement).value).toBe('half-typed message')

    await wrapper.get('.explore-newchat').trigger('click')

    expect(wrapper.emitted('new-chat')).toBeTruthy()
    expect((ta.element as HTMLTextAreaElement).value).toBe('')
  })

  it('re-emits replay/continue-session and returns to Chat tab', async () => {
    const wrapper = mountChat()
    await wrapper.findAll('.explore-tab')[1].trigger('click') // History
    await wrapper.get('.hist-replay').trigger('click')
    expect(wrapper.emitted('replay')?.[0]).toEqual(['redo me'])
    expect(wrapper.find('.explore-composer').exists()).toBe(true) // back on Chat

    await wrapper.findAll('.explore-tab')[1].trigger('click') // History
    await wrapper.get('.hist-cont').trigger('click')
    expect(wrapper.emitted('continue-session')?.[0]).toEqual(['sess1'])
    expect(wrapper.find('.explore-composer').exists()).toBe(true)
  })
})
