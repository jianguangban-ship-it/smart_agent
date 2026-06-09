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

import ExploreChat from '../ExploreChat.vue'
import { setModel1, setModel2, setExploreModel, getExploreModel } from '@/config/llm'
import type { ChatMessage } from '@/types/api'

const ChatBubbleStub = { template: '<div class="bubble" />', props: ['message', 'hashId', 'layout'] }
const HistoryStub = { template: '<div class="hist" />', props: ['channel'] }

function mountChat() {
  return mount(ExploreChat, {
    props: { messages: [] as ChatMessage[], isLoading: false, hadError: false, backoffSecs: 0 },
    global: { stubs: { ChatBubble: ChatBubbleStub, CoachHistoryTab: HistoryStub } },
  })
}

beforeEach(() => {
  setModel1('alpha')
  setModel2('beta')
  setExploreModel('alpha')
})

describe('ExploreChat model picker', () => {
  it('renders a select listing the two configured models', () => {
    const wrapper = mountChat()
    const opts = wrapper.findAll('.composer-model-select option')
    expect(opts.map(o => (o.element as HTMLOptionElement).value)).toEqual(['alpha', 'beta'])
  })

  it('changing the select updates the Explore model selection', async () => {
    const wrapper = mountChat()
    await wrapper.find('.composer-model-select').setValue('beta')
    expect(getExploreModel()).toBe('beta')
  })

  it('drops Model 2 from the options when it is unset', () => {
    setModel2('')
    setExploreModel('alpha')
    const wrapper = mountChat()
    const opts = wrapper.findAll('.composer-model-select option')
    expect(opts.map(o => (o.element as HTMLOptionElement).value)).toEqual(['alpha'])
  })
})

describe('ExploreChat image-attachment gating by model', () => {
  it('offers image types in the file picker for a vision model', () => {
    setModel1('default/qwen36-35b-a3b'); setModel2('')
    setExploreModel('default/qwen36-35b-a3b')
    const wrapper = mountChat()
    expect(wrapper.find('.hidden-file-input').attributes('accept')).toContain('.png')
  })

  it('hides image types in the file picker for a text model', () => {
    setModel1('default/minimax-m2-7'); setModel2('')
    setExploreModel('default/minimax-m2-7')
    const wrapper = mountChat()
    expect(wrapper.find('.hidden-file-input').attributes('accept')).not.toContain('.png')
  })
})
