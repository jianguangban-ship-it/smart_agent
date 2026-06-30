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
import { addRecord, clearHistory, startNewSession, getSessionGroups, recordsForChannel } from '@/composables/useCoachHistory'
import type { ChatMessage } from '@/types/api'

const msgs: ChatMessage[] = [
  { id: 'u1', role: 'user', content: 'hi', timestamp: 1 },
  { id: 'a1', role: 'assistant', content: 'hello', timestamp: 2 },
]

const ChatBubbleStub = {
  template: '<div class="bubble" :data-layout="layout">{{ message.content }}</div>',
  props: ['message', 'hashId', 'layout'],
}
function mountChat(props: Record<string, unknown> = {}) {
  return mount(ExploreChat, {
    props: { messages: msgs, isLoading: false, hadError: false, backoffSecs: 0, ...props },
    global: { stubs: { ChatBubble: ChatBubbleStub } },
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

  it('always shows the composer (no Chat/History tabs)', () => {
    const wrapper = mountChat()
    expect(wrapper.find('.explore-composer').exists()).toBe(true)
    expect(wrapper.findAll('.explore-tab')).toHaveLength(0)
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

  it('lists recent Explore chats in the sidebar and emits continue-session on click', async () => {
    clearHistory()
    addRecord('user', 'first question', 'explore')
    addRecord('assistant', 'an answer', 'explore')
    const sessionId = getSessionGroups(recordsForChannel('explore')).grouped[0].sessionId

    const wrapper = mountChat()
    const items = wrapper.findAll('.recent-item')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toContain('first question')

    await items[0].trigger('click')
    expect(wrapper.emitted('continue-session')?.[0]).toEqual([sessionId])
  })

  it('Chats nav switches to the placeholder page; New chat returns to the conversation', async () => {
    const wrapper = mountChat()
    expect(wrapper.find('.explore-composer').exists()).toBe(true)

    await wrapper.find('.explore-chats').trigger('click')
    expect(wrapper.find('.chats-page').exists()).toBe(true)
    expect(wrapper.find('.explore-composer').exists()).toBe(false)

    await wrapper.find('.explore-newchat').trigger('click')
    expect(wrapper.find('.chats-page').exists()).toBe(false)
    expect(wrapper.find('.explore-composer').exists()).toBe(true)
    expect(wrapper.emitted('new-chat')).toBeTruthy()
  })

  it('Ctrl+Shift+O starts a new chat', async () => {
    const wrapper = mountChat()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, shiftKey: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('new-chat')).toBeTruthy()
    wrapper.unmount()
  })

  it('opens the ⋯ menu on a single click and switches between chats', async () => {
    clearHistory()
    startNewSession('explore')
    addRecord('user', 'chat one', 'explore')
    startNewSession('explore')
    addRecord('user', 'chat two', 'explore')

    const wrapper = mountChat()
    const mores = wrapper.findAll('.recent-more')
    expect(mores).toHaveLength(2)

    // One click opens the teleported menu with all four actions.
    await mores[0].trigger('click')
    let menus = document.body.querySelectorAll('.recent-menu')
    expect(menus).toHaveLength(1)
    expect(menus[0].querySelectorAll('.recent-menu-item')).toHaveLength(4)

    // Clicking another chat's ⋯ switches in a single click (still exactly one menu open).
    await mores[1].trigger('click')
    menus = document.body.querySelectorAll('.recent-menu')
    expect(menus).toHaveLength(1)

    wrapper.unmount()
  })
})
