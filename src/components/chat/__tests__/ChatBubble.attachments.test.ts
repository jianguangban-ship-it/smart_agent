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

// Stub the download helper so clicking a card doesn't touch jsdom URL APIs.
const downloadFile = vi.fn()
vi.mock('@/utils/exportFormats', () => ({
  downloadFile: (...args: unknown[]) => downloadFile(...args),
}))

import ChatBubble from '../ChatBubble.vue'
import type { ChatMessage } from '@/types/api'

const msgWithFiles: ChatMessage = {
  id: 'u1',
  role: 'user',
  content: 'please review these',
  timestamp: 1,
  attachments: [
    { name: 'spec.md', size: 2048, content: '# spec' },
    { name: 'data.json', size: 512, content: '{}' },
  ],
}

describe('ChatBubble attachments', () => {
  it('renders a clickable file card per attachment with name + size', () => {
    const wrapper = mount(ChatBubble, { props: { message: msgWithFiles, layout: 'stacked' } })
    const cards = wrapper.findAll('.attach-card')
    expect(cards).toHaveLength(2)
    expect(wrapper.text()).toContain('spec.md')
    expect(wrapper.text()).toContain('data.json')
    expect(wrapper.text()).toContain('2.0 KB')   // 2048 bytes via formatBytes
  })

  it('still renders the clean message text (no inlined file content)', () => {
    const wrapper = mount(ChatBubble, { props: { message: msgWithFiles, layout: 'stacked' } })
    expect(wrapper.find('.msg-user-text').text()).toBe('please review these')
    expect(wrapper.text()).not.toContain('[Attached file:')
  })

  it('downloads the original file content when a card is clicked', async () => {
    downloadFile.mockClear()
    const wrapper = mount(ChatBubble, { props: { message: msgWithFiles, layout: 'stacked' } })
    await wrapper.findAll('.attach-card')[0].trigger('click')
    expect(downloadFile).toHaveBeenCalledWith('# spec', 'spec.md', 'text/plain')
  })

  it('renders no cards for a message without attachments', () => {
    const plain: ChatMessage = { id: 'u2', role: 'user', content: 'hi', timestamp: 1 }
    const wrapper = mount(ChatBubble, { props: { message: plain } })
    expect(wrapper.find('.attach-cards').exists()).toBe(false)
  })

  it('renders an image attachment as a thumbnail', () => {
    const msg: ChatMessage = {
      id: 'u3', role: 'user', content: 'look', timestamp: 1,
      attachments: [{ name: 'pic.png', size: 9, content: 'data:image/png;base64,AAAA', kind: 'image' }],
    }
    const wrapper = mount(ChatBubble, { props: { message: msg, layout: 'stacked' } })
    const img = wrapper.find('img.attach-image')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('data:image/png;base64,AAAA')
  })

  it('renders a placeholder for a reloaded image whose base64 was stripped', () => {
    const msg: ChatMessage = {
      id: 'u4', role: 'user', content: 'look', timestamp: 1,
      attachments: [{ name: 'pic.png', size: 9, content: '', kind: 'image' }],
    }
    const wrapper = mount(ChatBubble, { props: { message: msg, layout: 'stacked' } })
    expect(wrapper.find('img.attach-image').exists()).toBe(false)
    expect(wrapper.find('.attach-card--placeholder').exists()).toBe(true)
    expect(wrapper.text()).toContain('pic.png')
  })
})
