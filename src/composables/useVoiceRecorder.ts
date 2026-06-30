/**
 * Voice recorder composable (v10.179, voice dictation).
 *
 * Encapsulates the browser audio stack for the Explore composer's dictation
 * feature: device enumeration, getUserMedia, MediaRecorder lifecycle, and an
 * AnalyserNode level feed that drives both the settings-menu level meter and
 * the in-composer waveform. Per-caller (not a singleton) — VoiceControls.vue
 * owns one instance and must call dispose() on unmount.
 *
 * Secure-context note: getUserMedia only exists on HTTPS or localhost. The
 * plain-HTTP intranet prod deploy has no `navigator.mediaDevices`, so every
 * consumer must gate on `isVoiceSupported()` first (mirrors the
 * navigator.clipboard situation handled by utils/clipboard.ts).
 */
import { ref, watch } from 'vue'

export type VoiceError = 'permission' | 'no-device' | 'unsupported' | 'recorder'

export class VoiceRecorderError extends Error {
  kind: VoiceError
  constructor(kind: VoiceError, message?: string) {
    super(message ?? kind)
    this.kind = kind
  }
}

export const VOICE_DEVICE_LS_KEY = 'smart_agent.voice_input_device_id'
export const VOICE_HOLD_LS_KEY = 'smart_agent.voice_hold_to_record'

/** Number of bars in the waveform ring buffer (newest on the right). */
export const WAVEFORM_BARS = 36

/** Hard cap so a forgotten recording can't grow without bound (5 min). */
const MAX_RECORDING_MS = 300_000

/** Level/waveform refresh ~12 Hz — smooth enough, cheap enough. */
const LEVEL_INTERVAL_MS = 80

export function isVoiceSupported(): boolean {
  return typeof window !== 'undefined'
    && window.isSecureContext === true
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined'
}

/** First container/codec the browser can actually produce. */
function pickMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus'
  ]
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported?.(c)) return c
  }
  return undefined
}

function mapGetUserMediaError(err: unknown): VoiceRecorderError {
  const name = (err as { name?: string })?.name ?? ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new VoiceRecorderError('permission', name)
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return new VoiceRecorderError('no-device', name)
  }
  return new VoiceRecorderError('recorder', name || String(err))
}

export interface VoiceRecorderOptions {
  /**
   * Fired when the MAX_RECORDING_MS cap stops a recording on its own. The
   * blob is what stopRecording() would have returned — the component treats
   * it exactly like the user pressing ✓.
   */
  onAutoStop?: (blob: Blob | null) => void
}

export function useVoiceRecorder(options: VoiceRecorderOptions = {}) {
  const isRecording = ref(false)
  const isMonitoring = ref(false)
  /** Current input level 0..1 (RMS), feeds the menu's level meter. */
  const level = ref(0)
  /** Ring buffer of recent levels, feeds the waveform bars while recording. */
  const levels = ref<number[]>(Array.from({ length: WAVEFORM_BARS }, () => 0))
  const elapsedMs = ref(0)
  const devices = ref<Array<{ deviceId: string; label: string }>>([])
  const selectedDeviceId = ref<string>(localStorage.getItem(VOICE_DEVICE_LS_KEY) ?? '')
  const holdToRecord = ref(localStorage.getItem(VOICE_HOLD_LS_KEY) === '1')

  watch(selectedDeviceId, v => {
    if (v) localStorage.setItem(VOICE_DEVICE_LS_KEY, v)
    else localStorage.removeItem(VOICE_DEVICE_LS_KEY)
  })
  watch(holdToRecord, v => {
    localStorage.setItem(VOICE_HOLD_LS_KEY, v ? '1' : '0')
  })

  // ── internal audio plumbing ────────────────────────────────────────────
  let stream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let analyserBuf: Uint8Array | null = null
  let levelTimer: ReturnType<typeof setInterval> | null = null
  let elapsedTimer: ReturnType<typeof setInterval> | null = null
  let autoStopTimer: ReturnType<typeof setTimeout> | null = null
  let recorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let recorderMime = ''

  function readLevel(): number {
    if (!analyser || !analyserBuf) return 0
    analyser.getByteTimeDomainData(analyserBuf)
    let sum = 0
    for (let i = 0; i < analyserBuf.length; i++) {
      const centered = (analyserBuf[i] - 128) / 128
      sum += centered * centered
    }
    // RMS of speech rarely exceeds ~0.5; scale up so normal speech fills the bar.
    return Math.min(1, Math.sqrt(sum / analyserBuf.length) * 2.5)
  }

  function startLevelLoop() {
    if (levelTimer) return
    levelTimer = setInterval(() => {
      const v = readLevel()
      level.value = v
      if (isRecording.value) {
        // Ring shift: drop oldest, push newest (waveform scrolls leftwards).
        const next = levels.value.slice(1)
        next.push(v)
        levels.value = next
      }
    }, LEVEL_INTERVAL_MS)
  }

  function stopLevelLoop() {
    if (levelTimer) { clearInterval(levelTimer); levelTimer = null }
    level.value = 0
  }

  function attachAnalyser(s: MediaStream) {
    // Analyser failure must never break recording — it only powers visuals.
    try {
      if (typeof AudioContext === 'undefined') return
      audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(s)
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserBuf = new Uint8Array(analyser.fftSize)
      source.connect(analyser)
    } catch {
      analyser = null
      analyserBuf = null
    }
  }

  function teardownStream() {
    stopLevelLoop()
    if (stream) {
      // Always stop every track, or the tab's mic indicator stays lit.
      for (const track of stream.getTracks()) track.stop()
      stream = null
    }
    if (audioContext) {
      void audioContext.close().catch(() => {})
      audioContext = null
    }
    analyser = null
    analyserBuf = null
  }

  async function openStream(): Promise<MediaStream> {
    if (!isVoiceSupported()) throw new VoiceRecorderError('unsupported')
    const constraint: MediaStreamConstraints = {
      audio: selectedDeviceId.value ? { deviceId: { exact: selectedDeviceId.value } } : true
    }
    try {
      return await navigator.mediaDevices.getUserMedia(constraint)
    } catch (err) {
      // A persisted deviceId can go stale (headset unplugged) — retry once
      // with the default device before surfacing 'no-device'.
      if ((err as { name?: string })?.name === 'OverconstrainedError' && selectedDeviceId.value) {
        selectedDeviceId.value = ''
        return await navigator.mediaDevices.getUserMedia({ audio: true }).catch(e2 => {
          throw mapGetUserMediaError(e2)
        })
      }
      throw mapGetUserMediaError(err)
    }
  }

  // ── devices ────────────────────────────────────────────────────────────
  async function refreshDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      devices.value = all
        .filter(d => d.kind === 'audioinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label }))
    } catch {
      devices.value = []
    }
  }

  function onDeviceChange() { void refreshDevices() }

  // ── monitor (settings menu open: level meter, no recording) ───────────
  async function startMonitor() {
    if (isMonitoring.value) return
    if (!isRecording.value) {
      stream = await openStream()
      attachAnalyser(stream)
    }
    isMonitoring.value = true
    startLevelLoop()
    // Labels are empty before the first grant — refresh now that we have one.
    void refreshDevices()
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange)
  }

  function stopMonitor() {
    if (!isMonitoring.value) return
    isMonitoring.value = false
    navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange)
    // Keep the shared stream alive if a recording still uses it.
    if (!isRecording.value) teardownStream()
  }

  // ── recording ──────────────────────────────────────────────────────────
  async function startRecording(): Promise<void> {
    if (isRecording.value) return
    // Monitor and recording share one stream; restart it so the recording
    // honors the (possibly just-changed) selected device.
    teardownStream()
    stream = await openStream()
    attachAnalyser(stream)

    chunks = []
    const mime = pickMimeType()
    recorderMime = mime ?? 'audio/webm'
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    } catch (err) {
      teardownStream()
      throw new VoiceRecorderError('recorder', String(err))
    }
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunks.push(e.data)
    }
    recorder.start(1000) // 1 s timeslice so long clips don't buffer in one chunk

    isRecording.value = true
    elapsedMs.value = 0
    levels.value = Array.from({ length: WAVEFORM_BARS }, () => 0)
    startLevelLoop()
    elapsedTimer = setInterval(() => { elapsedMs.value += 250 }, 250)
    autoStopTimer = setTimeout(() => {
      void stopRecording().then(blob => options.onAutoStop?.(blob))
    }, MAX_RECORDING_MS)
  }

  /** Stop + assemble the clip. Resolves null if nothing was captured. */
  function stopRecording(): Promise<Blob | null> {
    const r = recorder
    if (!r || !isRecording.value) return Promise.resolve(null)
    isRecording.value = false
    if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null }
    if (autoStopTimer) { clearTimeout(autoStopTimer); autoStopTimer = null }

    return new Promise<Blob | null>(resolve => {
      r.onstop = () => {
        recorder = null
        const blob = chunks.length > 0 ? new Blob(chunks, { type: recorderMime }) : null
        chunks = []
        // Monitor may still be live (menu open) — keep its meter running.
        if (isMonitoring.value) {
          // Recording owned the stream; reopen a monitor-only one.
          teardownStream()
          void openStream().then(s => {
            stream = s
            attachAnalyser(s)
            startLevelLoop()
          }).catch(() => { /* meter goes quiet; not fatal */ })
        } else {
          teardownStream()
        }
        resolve(blob)
      }
      try {
        r.stop()
      } catch {
        recorder = null
        chunks = []
        teardownStream()
        resolve(null)
      }
    })
  }

  /** Stop and discard — the ✕ button. */
  function cancelRecording() {
    void stopRecording().then(() => { chunks = [] })
  }

  /** Full teardown for onBeforeUnmount. */
  function dispose() {
    if (isRecording.value && recorder) {
      try { recorder.stop() } catch { /* already stopped */ }
      recorder = null
      isRecording.value = false
    }
    if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null }
    if (autoStopTimer) { clearTimeout(autoStopTimer); autoStopTimer = null }
    navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange)
    isMonitoring.value = false
    chunks = []
    teardownStream()
  }

  return {
    // state
    isRecording,
    isMonitoring,
    level,
    levels,
    elapsedMs,
    devices,
    selectedDeviceId,
    holdToRecord,
    // actions
    refreshDevices,
    startMonitor,
    stopMonitor,
    startRecording,
    stopRecording,
    cancelRecording,
    dispose
  }
}
