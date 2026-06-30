/**
 * VoiceControls (v10.179, voice dictation).
 *
 * The recorder composable and STT client are mocked; these tests cover the
 * component's state machine: support gating, settings menu, hold toggle,
 * confirm/cancel flows, and error toasts.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'

enableAutoUnmount(afterEach)

const spies = vi.hoisted(() => ({
  addToast: vi.fn(),
  transcribeAudio: vi.fn(),
  isVoiceSupported: vi.fn(() => true)
}))

// Controllable recorder state shared between the mock factory and the tests.
const recState = vi.hoisted(() => ({ api: null as Record<string, unknown> | null }))

vi.mock('@/composables/useVoiceRecorder', async () => {
  const { ref } = await import('vue')
  const isRecording = ref(false)
  const api = {
    isRecording,
    isMonitoring: ref(false),
    level: ref(0.5),
    levels: ref(Array.from({ length: 36 }, () => 0.3)),
    elapsedMs: ref(0),
    devices: ref([
      { deviceId: 'mic-1', label: '麦克风阵列 (Realtek(R) Audio)' },
      { deviceId: 'mic-2', label: '默认 - 麦克风阵列 (Realtek(R) Audio)' }
    ]),
    selectedDeviceId: ref(''),
    holdToRecord: ref(false),
    refreshDevices: vi.fn(async () => {}),
    startMonitor: vi.fn(async () => {}),
    stopMonitor: vi.fn(),
    startRecording: vi.fn(async () => { isRecording.value = true }),
    stopRecording: vi.fn(async () => {
      isRecording.value = false
      return new Blob(['x'.repeat(2000)], { type: 'audio/webm' })
    }),
    cancelRecording: vi.fn(() => { isRecording.value = false }),
    dispose: vi.fn()
  }
  recState.api = api
  class VoiceRecorderError extends Error {
    kind: string
    constructor(kind: string, message?: string) { super(message ?? kind); this.kind = kind }
  }
  return {
    useVoiceRecorder: () => api,
    isVoiceSupported: spies.isVoiceSupported,
    VoiceRecorderError,
    VOICE_DEVICE_LS_KEY: 'test.device',
    VOICE_HOLD_LS_KEY: 'test.hold',
    WAVEFORM_BARS: 36
  }
})

vi.mock('@/utils/sttClient', () => {
  class STTError extends Error {
    detail: string
    constructor(detail: string) { super(detail); this.detail = detail }
  }
  return {
    transcribeAudio: spies.transcribeAudio,
    STTError
  }
})

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: spies.addToast })
}))

import VoiceControls from '../VoiceControls.vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function api(): any { return recState.api }

beforeEach(() => {
  vi.clearAllMocks()
  spies.isVoiceSupported.mockReturnValue(true)
  spies.transcribeAudio.mockResolvedValue('你好 world')
  api().isRecording.value = false
  api().holdToRecord.value = false
  api().selectedDeviceId.value = ''
})

function mountControls(props: { disabled?: boolean } = {}) {
  return mount(VoiceControls, { props, attachTo: document.body })
}

describe('VoiceControls', () => {
  it('renders a disabled mic with explanatory tooltip when unsupported (plain-HTTP prod)', () => {
    spies.isVoiceSupported.mockReturnValue(false)
    const wrapper = mountControls()
    const mic = wrapper.find('.voice-mic')
    expect(mic.attributes('disabled')).toBeDefined()
    expect(mic.attributes('title')).toBe('语音输入需要 HTTPS 或 localhost 环境')
    expect(wrapper.find('.voice-chevron').exists()).toBe(false)
  })

  it('starts recording on mic click in click-toggle mode', async () => {
    const wrapper = mountControls()
    await wrapper.find('.voice-mic').trigger('click')
    await flushPromises()
    expect(api().startRecording).toHaveBeenCalledOnce()
    expect(wrapper.find('.voice-recording-bar').exists()).toBe(true)
    expect(wrapper.findAll('.wave-bar')).toHaveLength(36)
    expect(wrapper.emitted('recording')?.[0]).toEqual([true])
  })

  it('does not start when disabled (send streaming)', async () => {
    const wrapper = mountControls({ disabled: true })
    await wrapper.find('.voice-mic').trigger('click')
    await flushPromises()
    expect(api().startRecording).not.toHaveBeenCalled()
  })

  it('opens the settings menu with device list, checkmark on the active device', async () => {
    const wrapper = mountControls()
    await wrapper.find('.voice-chevron').trigger('click')
    expect(api().startMonitor).toHaveBeenCalledOnce()
    const items = wrapper.findAll('.voice-menu-devices .voice-menu-item')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('麦克风阵列 (Realtek(R) Audio)')
    // No persisted selection → first (default) device shows the checkmark.
    expect(items[0].find('.voice-menu-check').exists()).toBe(true)
    expect(items[1].find('.voice-menu-check').exists()).toBe(false)

    // Selecting the second device moves the checkmark and persists the id.
    await items[1].trigger('click')
    expect(api().selectedDeviceId.value).toBe('mic-2')
    expect(wrapper.findAll('.voice-menu-devices .voice-menu-item')[1].find('.voice-menu-check').exists()).toBe(true)
  })

  it('flips hold-to-record from the menu switch', async () => {
    const wrapper = mountControls()
    await wrapper.find('.voice-chevron').trigger('click')
    await wrapper.find('.voice-menu-hold').trigger('click')
    expect(api().holdToRecord.value).toBe(true)
    expect(wrapper.find('.voice-toggle').classes()).toContain('on')
  })

  it('confirm (✓) stops, transcribes, and emits the text', async () => {
    const wrapper = mountControls()
    await wrapper.find('.voice-mic').trigger('click')
    await flushPromises()
    await wrapper.find('.voice-confirm').trigger('click')
    await flushPromises()
    expect(api().stopRecording).toHaveBeenCalledOnce()
    expect(spies.transcribeAudio).toHaveBeenCalledOnce()
    expect(wrapper.emitted('text')?.[0]).toEqual(['你好 world'])
    // Bar released the action bar once transcription finished.
    expect(wrapper.emitted('recording')?.at(-1)).toEqual([false])
  })

  it('cancel (✕) discards without transcribing', async () => {
    const wrapper = mountControls()
    await wrapper.find('.voice-mic').trigger('click')
    await flushPromises()
    await wrapper.find('.voice-cancel').trigger('click')
    await flushPromises()
    expect(api().cancelRecording).toHaveBeenCalledOnce()
    expect(spies.transcribeAudio).not.toHaveBeenCalled()
    expect(wrapper.emitted('text')).toBeUndefined()
  })

  it('skips the upload for a sub-1KB accidental tap', async () => {
    api().stopRecording.mockResolvedValueOnce(new Blob(['tiny'], { type: 'audio/webm' }))
    const wrapper = mountControls()
    await wrapper.find('.voice-mic').trigger('click')
    await flushPromises()
    await wrapper.find('.voice-confirm').trigger('click')
    await flushPromises()
    expect(spies.transcribeAudio).not.toHaveBeenCalled()
    expect(wrapper.emitted('text')).toBeUndefined()
  })

  it('shows an error toast with the upstream detail when transcription fails', async () => {
    const mod = await import('@/utils/sttClient')
    spies.transcribeAudio.mockRejectedValueOnce(new mod.STTError('STT upstream HTTP 500'))
    const wrapper = mountControls()
    await wrapper.find('.voice-mic').trigger('click')
    await flushPromises()
    await wrapper.find('.voice-confirm').trigger('click')
    await flushPromises()
    // Detail suffix makes broken-upstream (500) vs misconfigured-path (404)
    // visible without reading server logs.
    expect(spies.addToast).toHaveBeenCalledWith('error', '转写失败 — 请重试 (STT upstream HTTP 500)')
    expect(wrapper.emitted('text')).toBeUndefined()
  })

  it('shows the plain error toast for a non-STTError failure', async () => {
    spies.transcribeAudio.mockRejectedValueOnce(new Error('network down'))
    const wrapper = mountControls()
    await wrapper.find('.voice-mic').trigger('click')
    await flushPromises()
    await wrapper.find('.voice-confirm').trigger('click')
    await flushPromises()
    expect(spies.addToast).toHaveBeenCalledWith('error', '转写失败 — 请重试')
    expect(wrapper.emitted('text')).toBeUndefined()
  })

  it('shows a permission toast when the mic is denied', async () => {
    const mod = await import('@/composables/useVoiceRecorder')
    api().startRecording.mockRejectedValueOnce(new mod.VoiceRecorderError('permission'))
    const wrapper = mountControls()
    await wrapper.find('.voice-mic').trigger('click')
    await flushPromises()
    expect(spies.addToast).toHaveBeenCalledWith('error', '麦克风权限被拒绝 — 请在浏览器设置中允许')
    expect(wrapper.find('.voice-recording-bar').exists()).toBe(false)
  })

  it('hold mode: pointerdown starts, window pointerup confirms', async () => {
    api().holdToRecord.value = true
    const wrapper = mountControls()
    await wrapper.find('.voice-mic').trigger('pointerdown')
    await flushPromises()
    expect(api().startRecording).toHaveBeenCalledOnce()
    window.dispatchEvent(new Event('pointerup'))
    await flushPromises()
    expect(api().stopRecording).toHaveBeenCalledOnce()
    expect(wrapper.emitted('text')?.[0]).toEqual(['你好 world'])
  })

  it('Escape cancels an active recording', async () => {
    const wrapper = mountControls()
    await wrapper.find('.voice-mic').trigger('click')
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(api().cancelRecording).toHaveBeenCalledOnce()
    expect(wrapper.emitted('text')).toBeUndefined()
  })
})
