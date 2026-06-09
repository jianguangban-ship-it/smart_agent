import { describe, it, expect, beforeAll } from 'vitest'
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

import ExploreChat from '../ExploreChat.vue'
import type { ChatMessage } from '@/types/api'

// Stub that re-exposes the child's retry/edit emits so we can drive them.
const ChatBubbleStub = {
  template: '<div class="bubble" @click="$emit(\'retry\', message.id)" />',
  props: ['message', 'hashId', 'layout'],
  emits: ['retry', 'edit'],
}
const HistoryStub = { template: '<div class="hist" />', props: ['channel'] }

const msgs: ChatMessage[] = [{ id: 'u1', role: 'user', content: 'hi', timestamp: 1 }]

function mountChat() {
  return mount(ExploreChat, {
    props: { messages: msgs, isLoading: false, hadError: false, backoffSecs: 0 },
    global: { stubs: { ChatBubble: ChatBubbleStub, CoachHistoryTab: HistoryStub } },
  })
}

describe('ExploreChat re-emits user-message actions', () => {
  it("re-emits child 'retry' as 'regenerate' with the id", async () => {
    const wrapper = mountChat()
    await wrapper.findComponent(ChatBubbleStub).vm.$emit('retry', 'u1')
    expect(wrapper.emitted('regenerate')?.[0]).toEqual(['u1'])
  })

  it("re-emits child 'edit' as 'edit-message' with the payload", async () => {
    const wrapper = mountChat()
    const payload = { id: 'u1', content: 'changed' }
    await wrapper.findComponent(ChatBubbleStub).vm.$emit('edit', payload)
    expect(wrapper.emitted('edit-message')?.[0]).toEqual([payload])
  })
})
