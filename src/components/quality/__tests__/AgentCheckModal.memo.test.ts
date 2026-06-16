import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'

const storage: Record<string, string> = {}
beforeAll(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage
})

vi.mock('@/utils/markdown', () => ({
  renderMarkdown: vi.fn((s: string) => `<p>${s}</p>`),
}))

import { mount, type VueWrapper } from '@vue/test-utils'
import AgentCheckModal from '../AgentCheckModal.vue'
import { renderMarkdown } from '@/utils/markdown'
import type { QualityTicket } from '@/types/quality'

function tk(p: Partial<QualityTicket>): QualityTicket {
  return {
    issueKey: 'X-1', issueType: 'Story', project: 'IDC_PDSW',
    team_key: 'DKKF', team: 'Team DKKF', summary: 's', points: 1,
    assignee: 'u', displayName: 'U', agentCheck: '## check', status: 'A',
    action: 'create', timestamp: '2026-05-07T10:00:00Z', ...p,
  }
}

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.mocked(renderMarkdown).mockClear()
})

describe('memoized markdown rendering', () => {
  it('does not re-render markdown when the same content is reopened', async () => {
    const ticket = tk({ agentCheck: '## memo-same-content' })
    wrapper = mount(AgentCheckModal, { props: { ticket } })
    expect(wrapper.html()).toContain('memo-same-content')
    expect(renderMarkdown).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ ticket: null })   // close
    await wrapper.setProps({ ticket })          // reopen same ticket
    expect(wrapper.html()).toContain('memo-same-content')
    expect(renderMarkdown).toHaveBeenCalledTimes(1)
  })

  it('re-renders when the agentCheck content changes (cache keyed by content)', async () => {
    wrapper = mount(AgentCheckModal, { props: { ticket: tk({ agentCheck: '## memo-v1' }) } })
    expect(renderMarkdown).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ ticket: tk({ agentCheck: '## memo-v2' }) })
    expect(wrapper.html()).toContain('memo-v2')
    expect(renderMarkdown).toHaveBeenCalledTimes(2)
  })
})
