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

import AgentInfo from '../AgentInfo.vue'

describe('AgentInfo — slim agent strip', () => {
  it('renders the telemetry grid (8 base rows) and no JIRA rows without a response', () => {
    const wrapper = mount(AgentInfo)
    // Model, Coach streaming, Role, Analyze streaming, Skill,
    // Coach error/cancel, Analyze prompt, Analyze error/cancel = 8 grid rows.
    // Backoff row is hidden (secs default 0); JIRA block absent.
    expect(wrapper.findAll('.agent-grid .config-row').length).toBe(8)
    expect(wrapper.find('.config-url').exists()).toBe(true) // model value
    expect(wrapper.find('.backoff-row').exists()).toBe(false)
    expect(wrapper.find('.jira-key-link').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('AI Points')
  })

  it('reflects per-channel telemetry props (streaming + speed, cancel, backoff)', () => {
    const wrapper = mount(AgentInfo, {
      props: {
        isTaskCoachLoading: true,
        taskCoachStreamSpeed: 107,
        analyzeWasCancelled: true,
        taskCoachBackoffSecs: 7,
      },
    })
    const text = wrapper.text()
    expect(text).toContain('107')          // tok/s speed badge while streaming
    expect(wrapper.find('.speed').exists()).toBe(true)
    expect(wrapper.find('.backoff-row').exists()).toBe(true) // 429 countdown visible
    expect(text).toContain('7s')
  })

  it('renders the JIRA key link / points / view link when a response is present', () => {
    const wrapper = mount(AgentInfo, {
      props: {
        jiraResponse: { key: 'DKKF-123', ai_points: 5, view_tasks_created: 'https://x/y' },
      },
    })
    const keyLink = wrapper.find('.jira-key-link')
    expect(keyLink.exists()).toBe(true)
    expect(keyLink.text()).toBe('DKKF-123')
    expect(keyLink.attributes('href')).toBe('https://jira.gwm.cn/browse/DKKF-123')
    expect(wrapper.text()).toContain('AI Points')
    expect(wrapper.find('.points-val').text()).toBe('5')
    expect(wrapper.find('.jira-view-link').attributes('href')).toBe('https://x/y')
  })

  it('shows an em-dash for a response object without a key', () => {
    const wrapper = mount(AgentInfo, { props: { jiraResponse: { foo: 'bar' } } })
    expect(wrapper.find('.jira-key-link').exists()).toBe(false)
    expect(wrapper.find('.muted').text()).toBe('—')
  })
})
