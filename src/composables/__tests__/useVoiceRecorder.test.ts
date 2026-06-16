/**
 * useVoiceRecorder (v10.179, voice dictation).
 *
 * MediaRecorder / AudioContext / mediaDevices don't exist in jsdom. Per the
 * project's vi.fn-constructor lesson (MEMORY.MD): never mock a class with
 * `vi.fn().mockImplementation(...)` — `new` won't return the implementation
 * and the failure mimics graceful degradation. Use REAL classes plus separate
 * constructor spies instead.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  useVoiceRecorder,
  isVoiceSupported,
  VoiceRecorderError,
  VOICE_DEVICE_LS_KEY,
  VOICE_HOLD_LS_KEY
} from '../useVoiceRecorder'

// ── real-class fakes ───────────────────────────────────────────────────────

const trackStopSpy = vi.fn()
function makeFakeStream() {
  return {
    getTracks: () => [{ stop: trackStopSpy }]
  } as unknown as MediaStream
}

const recorderCtorSpy = vi.fn()
class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true)
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    recorderCtorSpy(stream, options)
  }
  start(_timeslice?: number) { /* recording... */ }
  stop() {
    this.ondataavailable?.({ data: new Blob(['fake-audio-bytes'], { type: 'audio/webm' }) })
    this.onstop?.()
  }
}

const audioCtxCtorSpy = vi.fn()
const audioCtxCloseSpy = vi.fn(() => Promise.resolve())
class FakeAnalyser {
  fftSize = 2048
  getByteTimeDomainData(buf: Uint8Array) { buf.fill(128) }
  connect() { /* no-op */ }
}
class FakeAudioContext {
  constructor() { audioCtxCtorSpy() }
  createMediaStreamSource() { return { connect: vi.fn() } }
  createAnalyser() { return new FakeAnalyser() }
  close() { return audioCtxCloseSpy() }
}

const getUserMediaMock = vi.fn(async (_c: MediaStreamConstraints) => makeFakeStream())
const enumerateDevicesMock = vi.fn(async () => [
  { kind: 'audioinput', deviceId: 'mic-1', label: '麦克风阵列 (Realtek(R) Audio)' },
  { kind: 'audioinput', deviceId: 'mic-2', label: '默认 - 麦克风阵列 (Realtek(R) Audio)' },
  { kind: 'videoinput', deviceId: 'cam-1', label: 'Webcam' }
])

function stubAudioStack() {
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  vi.stubGlobal('AudioContext', FakeAudioContext)
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: getUserMediaMock,
      enumerateDevices: enumerateDevicesMock,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  stubAudioStack()
})

afterEach(() => {
  vi.unstubAllGlobals()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (navigator as any).mediaDevices
})

// ── support gate ───────────────────────────────────────────────────────────

describe('isVoiceSupported', () => {
  it('is true with the full audio stack present', () => {
    expect(isVoiceSupported()).toBe(true)
  })

  it('is false without navigator.mediaDevices (plain-HTTP prod)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).mediaDevices
    expect(isVoiceSupported()).toBe(false)
  })

  it('is false outside a secure context', () => {
    vi.stubGlobal('isSecureContext', false)
    expect(isVoiceSupported()).toBe(false)
  })
})

// ── recording lifecycle ────────────────────────────────────────────────────

describe('useVoiceRecorder', () => {
  it('passes the selected deviceId as an exact constraint', async () => {
    const rec = useVoiceRecorder()
    rec.selectedDeviceId.value = 'mic-2'
    await rec.startRecording()
    expect(getUserMediaMock).toHaveBeenCalledWith({ audio: { deviceId: { exact: 'mic-2' } } })
    rec.dispose()
  })

  it('uses the default device when none is selected', async () => {
    const rec = useVoiceRecorder()
    await rec.startRecording()
    expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true })
    rec.dispose()
  })

  it('stopRecording resolves a Blob and stops every track', async () => {
    const rec = useVoiceRecorder()
    await rec.startRecording()
    expect(rec.isRecording.value).toBe(true)

    const blob = await rec.stopRecording()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob!.size).toBeGreaterThan(0)
    expect(rec.isRecording.value).toBe(false)
    expect(trackStopSpy).toHaveBeenCalled()       // mic indicator released
    expect(audioCtxCloseSpy).toHaveBeenCalled()   // analyser context closed
    rec.dispose()
  })

  it('cancelRecording discards and releases the stream', async () => {
    const rec = useVoiceRecorder()
    await rec.startRecording()
    rec.cancelRecording()
    await nextTick()
    expect(rec.isRecording.value).toBe(false)
    expect(trackStopSpy).toHaveBeenCalled()
    rec.dispose()
  })

  it('maps NotAllowedError to a permission VoiceRecorderError', async () => {
    const denied = new Error('denied')
    denied.name = 'NotAllowedError'
    getUserMediaMock.mockRejectedValueOnce(denied)
    const rec = useVoiceRecorder()
    await expect(rec.startRecording()).rejects.toMatchObject({ kind: 'permission' })
    expect(rec.isRecording.value).toBe(false)
    rec.dispose()
  })

  it('retries with the default device when the persisted one is stale', async () => {
    const stale = new Error('gone')
    stale.name = 'OverconstrainedError'
    getUserMediaMock.mockRejectedValueOnce(stale)
    const rec = useVoiceRecorder()
    rec.selectedDeviceId.value = 'unplugged-headset'
    await rec.startRecording()
    expect(rec.isRecording.value).toBe(true)
    // Fallback call dropped the exact constraint and the stale selection.
    expect(getUserMediaMock).toHaveBeenLastCalledWith({ audio: true })
    expect(rec.selectedDeviceId.value).toBe('')
    rec.dispose()
  })

  it('throws unsupported when the audio stack is missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).mediaDevices
    const rec = useVoiceRecorder()
    await expect(rec.startRecording()).rejects.toBeInstanceOf(VoiceRecorderError)
    await expect(rec.startRecording()).rejects.toMatchObject({ kind: 'unsupported' })
  })

  it('refreshDevices keeps only audioinput devices', async () => {
    const rec = useVoiceRecorder()
    await rec.refreshDevices()
    expect(rec.devices.value).toEqual([
      { deviceId: 'mic-1', label: '麦克风阵列 (Realtek(R) Audio)' },
      { deviceId: 'mic-2', label: '默认 - 麦克风阵列 (Realtek(R) Audio)' }
    ])
  })

  it('persists device selection and hold-to-record to localStorage', async () => {
    const rec = useVoiceRecorder()
    rec.selectedDeviceId.value = 'mic-2'
    rec.holdToRecord.value = true
    await nextTick()
    expect(localStorage.getItem(VOICE_DEVICE_LS_KEY)).toBe('mic-2')
    expect(localStorage.getItem(VOICE_HOLD_LS_KEY)).toBe('1')

    // New instance re-reads the persisted values.
    const rec2 = useVoiceRecorder()
    expect(rec2.selectedDeviceId.value).toBe('mic-2')
    expect(rec2.holdToRecord.value).toBe(true)
    rec.dispose()
    rec2.dispose()
  })

  it('startMonitor opens a stream and stopMonitor releases it', async () => {
    const rec = useVoiceRecorder()
    await rec.startMonitor()
    expect(rec.isMonitoring.value).toBe(true)
    expect(getUserMediaMock).toHaveBeenCalled()
    rec.stopMonitor()
    expect(rec.isMonitoring.value).toBe(false)
    expect(trackStopSpy).toHaveBeenCalled()
    rec.dispose()
  })
})
