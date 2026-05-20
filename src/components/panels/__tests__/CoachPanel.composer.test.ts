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

import CoachPanel from '../CoachPanel.vue'
import DescriptionEditor from '@/components/form/DescriptionEditor.vue'
import { appMode } from '@/composables/useAppMode'
import type { ChatMessage } from '@/types/api'

const ChatBubbleStub = { template: '<div class="bubble" />', props: ['message', 'hashId'] }
const HistoryStub = { template: '<div class="hist" />', props: ['channel'], emits: ['replay', 'continue-session'] }
const QuickChipStub = { template: '<button class="qchip" />', props: ['icon', 'label'] }
const GlobeStub = { template: '<div />', props: ['dimmed'] }

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(CoachPanel, {
    props: {
      messages: [] as ChatMessage[],
      isLoading: false,
      wasCancelled: false,
      hadError: false,
      streamSpeed: 0,
      backoffSecs: 0,
      descriptionFocused: false,
      canCoachSubmit: true,
      description: '',
      ...props,
    },
    global: {
      stubs: {
        ChatBubble: ChatBubbleStub,
        CoachHistoryTab: HistoryStub,
        QuickChip: QuickChipStub,
        AsciiGlobe: GlobeStub,
      },
    },
  })
}

afterEach(() => { appMode.value = 'task' })

describe('CoachPanel — pinned Task composer', () => {
  it('renders the composer in the panel footer alongside the empty-state guide + chips', () => {
    appMode.value = 'task'
    const wrapper = mountPanel({ messages: [] })
    // Composer pinned in PanelShell's footer (outside the scrollable body).
    const footer = wrapper.find('.panel-footer')
    expect(footer.exists()).toBe(true)
    // v10.125: footer is the DescriptionEditor only (Send/Stop relocated).
    expect(footer.find('.description-editor--composer').exists()).toBe(true)
    // Guide text + template chips still render in the body empty-state.
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.find('.empty-hint').text().length).toBeGreaterThan(0)
    expect(wrapper.find('.chips').exists()).toBe(true)
  })

  // v10.125: Send/Stop buttons moved to TaskForm's action bar; CoachPanel's
  // footer is the DescriptionEditor only. Lock in the relocation: neither
  // button class should exist inside CoachPanel anymore, in either state.
  it('no Send/Stop buttons remain inside CoachPanel (relocated to action bar)', () => {
    const idle = mountPanel({ canCoachSubmit: true })
    expect(idle.find('.coach-send').exists()).toBe(false)
    expect(idle.find('.coach-stop').exists()).toBe(false)

    const streaming: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'hi', timestamp: 1 },
      { id: 'a1', role: 'assistant', content: 'partial answer', timestamp: 2 },
    ]
    const loading = mountPanel({ isLoading: true, messages: streaming })
    expect(loading.find('.coach-send').exists()).toBe(false)
    expect(loading.find('.coach-stop').exists()).toBe(false)
  })

  it('composer is Task + chat-tab only (hidden in Explore mode and on History tab)', async () => {
    const wrapper = mountPanel()
    // The DescriptionEditor (composer variant) IS the footer now.
    expect(wrapper.find('.description-editor--composer').exists()).toBe(true)

    // Switch to History tab (task order: Chat | Analysis | History) → composer hidden.
    await wrapper.findAll('.coach-tab')[2].trigger('click')
    expect(wrapper.find('.description-editor--composer').exists()).toBe(false)

    // Explore mode → no Task composer at all.
    appMode.value = 'explore'
    const explore = mountPanel()
    expect(explore.find('.description-editor--composer').exists()).toBe(false)
  })
})

describe('CoachPanel — Analysis tab', () => {
  const withSlot = (props: Record<string, unknown> = {}) =>
    mount(CoachPanel, {
      props: {
        messages: [] as ChatMessage[],
        isLoading: false, wasCancelled: false, hadError: false,
        streamSpeed: 0, backoffSecs: 0, descriptionFocused: false,
        canCoachSubmit: true, description: '', ...props,
      },
      slots: { analysis: '<div class="analysis-slot">ANALYSIS</div>' },
      global: { stubs: { ChatBubble: ChatBubbleStub, CoachHistoryTab: HistoryStub, QuickChip: QuickChipStub, AsciiGlobe: GlobeStub } },
    })

  it('shows a task-only Analysis tab that renders the #analysis slot', async () => {
    appMode.value = 'task'
    const wrapper = withSlot()
    const tabs = wrapper.findAll('.coach-tab')
    expect(tabs.length).toBe(3) // Chat | Analysis | History
    expect(wrapper.find('.analysis-slot').exists()).toBe(false) // chat tab first

    await tabs[1].trigger('click') // Analysis
    expect(wrapper.find('.coach-analysis').exists()).toBe(true)
    expect(wrapper.find('.analysis-slot').text()).toBe('ANALYSIS')
    // Composer hidden on the Analysis tab.
    expect(wrapper.find('.coach-composer').exists()).toBe(false)
  })

  it('auto-switches to the Analysis tab when isAnalyzing flips true', async () => {
    appMode.value = 'task'
    const wrapper = withSlot({ isAnalyzing: false })
    expect(wrapper.find('.analysis-slot').exists()).toBe(false)
    await wrapper.setProps({ isAnalyzing: true })
    expect(wrapper.find('.coach-analysis').exists()).toBe(true)
    expect(wrapper.find('.analysis-slot').exists()).toBe(true)
  })

  it('hides the Analysis tab in Explore mode', () => {
    appMode.value = 'explore'
    const wrapper = withSlot()
    expect(wrapper.findAll('.coach-tab').length).toBe(2) // Chat | History only
  })

  it('hides the PanelShell header on every Task tab (Review/Analysis/History)', async () => {
    appMode.value = 'task'
    const wrapper = withSlot()
    const tabs = wrapper.findAll('.coach-tab')
    expect(wrapper.find('.panel-header').exists()).toBe(false) // Review

    await tabs[1].trigger('click') // Analysis
    expect(wrapper.find('.panel-header').exists()).toBe(false)

    await tabs[2].trigger('click') // History
    expect(wrapper.find('.panel-header').exists()).toBe(false)

    // Flush body radius applied when header hidden.
    expect(wrapper.find('.panel-body--flush').exists()).toBe(true)
  })

  it('labels the first tab Review (task), not Chat', () => {
    appMode.value = 'task'
    const label = withSlot().findAll('.coach-tab')[0].text()
    // Locale-agnostic: the tabReview key (EN 'Review' / ZH '评审'), not tabChat.
    expect(label).toMatch(/Review|评审/)
    expect(label).not.toMatch(/Chat|对话/)
  })
})

describe('DescriptionEditor — variant', () => {
  it('composer variant hides the section title; form variant (default) keeps it', () => {
    const composer = mount(DescriptionEditor, {
      props: { modelValue: '', variant: 'composer' },
    })
    expect(composer.find('.section-title').exists()).toBe(false)
    expect(composer.find('.desc-textarea--composer').exists()).toBe(true)

    const form = mount(DescriptionEditor, { props: { modelValue: '' } })
    expect(form.find('.section-title').exists()).toBe(true)
    expect(form.find('.desc-textarea--composer').exists()).toBe(false)
  })

  it('composer variant emits submit on Enter; Shift+Enter and IME composition do not', async () => {
    const wrapper = mount(DescriptionEditor, {
      props: { modelValue: 'hello', variant: 'composer' },
    })
    const ta = wrapper.get('textarea')
    // Shift+Enter = newline, must not submit
    await ta.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.emitted('submit')).toBeFalsy()
    // Enter during IME composition (e.g. confirming a pinyin candidate) must not submit
    await ta.trigger('keydown', { key: 'Enter', isComposing: true })
    expect(wrapper.emitted('submit')).toBeFalsy()
    // Plain Enter submits
    await ta.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toBeTruthy()
  })
})
