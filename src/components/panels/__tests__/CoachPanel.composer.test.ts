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
    expect(footer.find('.coach-composer').exists()).toBe(true)
    // Guide text + template chips still render in the body empty-state.
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.find('.empty-hint').text().length).toBeGreaterThan(0)
    expect(wrapper.find('.chips').exists()).toBe(true)
  })

  it('Send emits coach; is disabled when !canCoachSubmit', async () => {
    const wrapper = mountPanel({ canCoachSubmit: true })
    const send = wrapper.get('.coach-send')
    await send.trigger('click')
    expect(wrapper.emitted('coach')).toBeTruthy()

    const disabled = mountPanel({ canCoachSubmit: false })
    expect((disabled.get('.coach-send').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows Stop (not Send) while loading and emits cancel', async () => {
    // Provide a streaming message so the typing-row avatar <img> isn't rendered
    // (it's irrelevant here and trips jsdom's resource loader).
    const streaming: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'hi', timestamp: 1 },
      { id: 'a1', role: 'assistant', content: 'partial answer', timestamp: 2 },
    ]
    const wrapper = mountPanel({ isLoading: true, messages: streaming })
    expect(wrapper.find('.coach-send').exists()).toBe(false)
    await wrapper.get('.coach-stop').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('composer is Task + chat-tab only (hidden in Explore mode and on History tab)', async () => {
    const wrapper = mountPanel()
    expect(wrapper.find('.coach-composer').exists()).toBe(true)

    // Switch to History tab (task order: Chat | Analysis | History) → composer hidden.
    await wrapper.findAll('.coach-tab')[2].trigger('click')
    expect(wrapper.find('.coach-composer').exists()).toBe(false)

    // Explore mode → no Task composer at all.
    appMode.value = 'explore'
    const explore = mountPanel()
    expect(explore.find('.coach-composer').exists()).toBe(false)
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

  it('composer variant emits submit on Ctrl/Cmd+Enter only', async () => {
    const wrapper = mount(DescriptionEditor, {
      props: { modelValue: 'hello', variant: 'composer' },
    })
    const ta = wrapper.get('textarea')
    await ta.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toBeFalsy()
    await ta.trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(wrapper.emitted('submit')).toBeTruthy()
  })
})
