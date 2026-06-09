import { describe, it, expect, beforeAll, afterEach } from 'vitest'
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
import { useAttachment } from '@/composables/useAttachment'
import type { ChatMessage } from '@/types/api'

const { attach, attachedFiles, detachAll } = useAttachment()

const ChatBubbleStub = {
  template: '<div class="bubble">{{ message.content }}</div>',
  props: ['message', 'hashId', 'layout'],
}
const HistoryStub = { template: '<div class="hist" />', props: ['channel'] }

function mountChat() {
  return mount(ExploreChat, {
    props: { messages: [] as ChatMessage[], isLoading: false, hadError: false, backoffSecs: 0 },
    global: { stubs: { ChatBubble: ChatBubbleStub, CoachHistoryTab: HistoryStub } },
  })
}

function textFile(name: string): File {
  return new File(['content of ' + name], name, { type: 'text/plain' })
}

afterEach(() => detachAll())

describe('ExploreChat attachment chips', () => {
  it('renders one removable chip per attached file, with a truncating name span', async () => {
    await attach(textFile('short.txt'))
    await attach(textFile('a-very-long-attachment-filename-that-would-overflow.json'))
    const wrapper = mountChat()

    const chips = wrapper.findAll('.attach-chip')
    expect(chips).toHaveLength(2)
    // Every chip has a name span (which truncates) AND a visible remove button.
    expect(wrapper.findAll('.attach-chip-name')).toHaveLength(2)
    expect(wrapper.findAll('.attach-remove')).toHaveLength(2)
  })

  it('clicking a chip × removes just that file', async () => {
    await attach(textFile('keep.txt'))
    await attach(textFile('remove-me.txt'))
    const wrapper = mountChat()
    expect(wrapper.findAll('.attach-chip')).toHaveLength(2)

    // Remove the second file via its × button.
    await wrapper.findAll('.attach-remove')[1].trigger('click')

    expect(attachedFiles.value.map(f => f.name)).toEqual(['keep.txt'])
    expect(wrapper.findAll('.attach-chip')).toHaveLength(1)
    expect(wrapper.find('.attach-chip-name').text()).toBe('keep.txt')
  })

  it('hides the chip row entirely once all files are removed', async () => {
    await attach(textFile('only.txt'))
    const wrapper = mountChat()
    await wrapper.find('.attach-remove').trigger('click')
    expect(attachedFiles.value).toHaveLength(0)
    expect(wrapper.find('.attach-chip-row').exists()).toBe(false)
  })
})
