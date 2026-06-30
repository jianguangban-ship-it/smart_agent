<template>
  <!-- v10.179 voice dictation (Phase 1). Recording bar replaces the idle
       buttons while a clip is being captured/transcribed; ExploreChat hides
       its other bar controls via the `recording` emit. Phase 2 (conversational
       voice mode, waveform icon + animated background) is intentionally NOT
       built — its button slot is reserved next to the mic. -->
  <div class="voice-controls">
    <!-- ── recording / transcribing ─────────────────────────────────── -->
    <template v-if="active">
      <div class="voice-recording-bar">
        <div class="voice-waveform" aria-hidden="true">
          <div
            v-for="(v, i) in levels"
            :key="i"
            class="wave-bar"
            :style="{ height: Math.max(2, Math.round(v * 16)) + 'px' }"
          />
        </div>
        <span v-if="transcribing" class="voice-status" aria-live="polite">{{ t('voice.transcribing') }}</span>
        <button
          type="button"
          class="voice-rec-btn voice-cancel"
          :disabled="transcribing"
          :title="t('voice.cancel')"
          :aria-label="t('voice.cancel')"
          @click="onCancel"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
        <button
          type="button"
          class="voice-rec-btn voice-confirm"
          :disabled="transcribing"
          :title="t('voice.confirm')"
          :aria-label="t('voice.confirm')"
          @click="onConfirm"
        >
          <svg v-if="!transcribing" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <svg v-else class="animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M21 12a9 9 0 1 1-6.2-8.56" />
          </svg>
        </button>
      </div>
    </template>

    <!-- ── idle: chevron (settings) + mic ───────────────────────────── -->
    <template v-else>
      <div class="voice-idle" ref="idleRef">
        <button
          v-if="supported"
          type="button"
          class="voice-btn voice-chevron"
          :class="{ open: menuOpen }"
          :title="t('voice.settingsTooltip')"
          :aria-label="t('voice.settingsTooltip')"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          @click="toggleMenu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <button
          type="button"
          class="voice-btn voice-mic"
          :disabled="!supported || disabled"
          :title="supported ? t('voice.micTooltip') : t('voice.unsupportedContext')"
          :aria-label="supported ? t('voice.micTooltip') : t('voice.unsupportedContext')"
          @pointerdown="onMicPointerDown"
          @click="onMicClick"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>

        <!-- settings menu (snapshot: level bar / device list / hold toggle) -->
        <div v-if="menuOpen" class="voice-menu" role="menu">
          <div class="voice-menu-level" aria-hidden="true">
            <svg class="level-mic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </svg>
            <div class="level-track">
              <div class="level-fill" :style="{ width: Math.round(level * 100) + '%' }" />
            </div>
          </div>
          <div class="voice-menu-devices">
            <button
              v-for="(d, i) in devices"
              :key="d.deviceId || i"
              type="button"
              class="voice-menu-item"
              role="menuitemradio"
              :aria-checked="isSelectedDevice(d, i)"
              @click="selectDevice(d)"
            >
              <span class="voice-menu-item-label">{{ d.label || t('voice.deviceFallback').replace('{n}', String(i + 1)) }}</span>
              <svg v-if="isSelectedDevice(d, i)" class="voice-menu-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
            <div v-if="devices.length === 0" class="voice-menu-item voice-menu-empty">{{ t('voice.errNoDevice') }}</div>
          </div>
          <div class="voice-menu-divider" />
          <button
            type="button"
            class="voice-menu-item voice-menu-hold"
            role="switch"
            :aria-checked="holdToRecord"
            @click="holdToRecord = !holdToRecord"
          >
            <span class="voice-menu-item-label">{{ t('voice.holdToRecord') }}</span>
            <span class="voice-toggle" :class="{ on: holdToRecord }"><span class="voice-toggle-knob" /></span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useI18n } from '@/i18n'
import { useToast } from '@/composables/useToast'
import { useVoiceRecorder, isVoiceSupported, VoiceRecorderError } from '@/composables/useVoiceRecorder'
import { transcribeAudio, STTError } from '@/utils/sttClient'

const props = defineProps<{
  /** Disable the mic while a send is streaming. */
  disabled?: boolean
}>()

const emit = defineEmits<{
  /** Transcribed text ready for the composer draft (never auto-sent). */
  (e: 'text', text: string): void
  /** True while the recording bar owns the composer action bar. */
  (e: 'recording', value: boolean): void
}>()

const { t } = useI18n()
const { addToast } = useToast()

const rec = useVoiceRecorder({ onAutoStop: blob => { void finishClip(blob) } })
const { level, levels, devices, selectedDeviceId, holdToRecord, isRecording } = rec

// Secure-context gate (plain-HTTP prod has no getUserMedia): mic renders
// disabled with an explanatory tooltip; settings chevron is hidden entirely.
const supported = isVoiceSupported()

const menuOpen = ref(false)
const transcribing = ref(false)
const idleRef = ref<HTMLElement | null>(null)

/** Recording bar stays up through transcription so the bar doesn't flicker. */
const active = computed(() => isRecording.value || transcribing.value)
watch(active, v => emit('recording', v))

// ── settings menu ──────────────────────────────────────────────────────────
function toggleMenu() {
  if (menuOpen.value) { closeMenu(); return }
  menuOpen.value = true
  void rec.refreshDevices()
  // Monitor powers the live level meter; also triggers the permission prompt
  // up front so device labels populate.
  rec.startMonitor().catch(err => {
    addToast('error', t(mapVoiceErr(err)))
  })
}

function closeMenu() {
  if (!menuOpen.value) return
  menuOpen.value = false
  rec.stopMonitor()
}

onClickOutside(idleRef, () => closeMenu())

function isSelectedDevice(d: { deviceId: string }, i: number): boolean {
  // No persisted choice → the browser default (first entry) is implicit.
  return selectedDeviceId.value ? d.deviceId === selectedDeviceId.value : i === 0
}

function selectDevice(d: { deviceId: string }) {
  selectedDeviceId.value = d.deviceId
}

// ── mic button: click-toggle vs hold-to-record ────────────────────────────
function onMicClick() {
  if (holdToRecord.value) return // hold mode is pointer-driven
  if (!isRecording.value) void startClip()
  // While recording, the bar's ✕/✓ buttons take over (mic is unmounted).
}

function onMicPointerDown(e: PointerEvent) {
  if (!holdToRecord.value) return
  e.preventDefault()
  // The mic button unmounts when the bar swaps in, so pointer capture on the
  // button would be lost — listen for release on the window instead.
  window.addEventListener('pointerup', onHoldRelease, { once: true })
  window.addEventListener('pointercancel', onHoldRelease, { once: true })
  void startClip()
}

function onHoldRelease() {
  window.removeEventListener('pointerup', onHoldRelease)
  window.removeEventListener('pointercancel', onHoldRelease)
  if (isRecording.value) void onConfirm()
}

function onEscKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && isRecording.value) onCancel()
}

async function startClip() {
  if (props.disabled || isRecording.value || transcribing.value) return
  closeMenu()
  try {
    await rec.startRecording()
    window.addEventListener('keydown', onEscKey)
  } catch (err) {
    addToast('error', t(mapVoiceErr(err)))
  }
}

async function onConfirm() {
  window.removeEventListener('keydown', onEscKey)
  const blob = await rec.stopRecording()
  await finishClip(blob)
}

async function finishClip(blob: Blob | null) {
  // Sub-1 KB ≈ an accidental tap — nothing worth a round trip.
  if (!blob || blob.size < 1000) return
  transcribing.value = true
  try {
    const text = await transcribeAudio(blob)
    if (text.trim()) emit('text', text.trim())
    else addToast('info', t('voice.emptyTranscript'))
  } catch (err) {
    // Append the server's diagnostic (e.g. "STT upstream HTTP 500") so a
    // broken upstream vs a misconfigured path is visible without server logs.
    const detail = err instanceof STTError && err.detail ? ` (${err.detail})` : ''
    addToast('error', t('voice.errTranscribe') + detail)
  } finally {
    transcribing.value = false
  }
}

function onCancel() {
  window.removeEventListener('keydown', onEscKey)
  rec.cancelRecording()
}

function mapVoiceErr(err: unknown): string {
  if (err instanceof VoiceRecorderError) {
    switch (err.kind) {
      case 'permission': return 'voice.errPermission'
      case 'no-device': return 'voice.errNoDevice'
      case 'unsupported': return 'voice.unsupportedContext'
    }
  }
  return 'voice.errRecorder'
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEscKey)
  window.removeEventListener('pointerup', onHoldRelease)
  window.removeEventListener('pointercancel', onHoldRelease)
  rec.dispose()
})
</script>

<style scoped>
.voice-controls {
  display: inline-flex;
  align-items: center;
}

/* ── idle buttons (match .composer-add-btn sizing) ─────────────────────── */
.voice-idle {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.voice-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.voice-btn:hover:not(:disabled) {
  border-color: var(--accent-blue);
  color: var(--accent-blue);
  background: var(--blue-subtle, rgba(96, 165, 250, 0.08));
}
.voice-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.voice-btn svg {
  width: 15px;
  height: 15px;
}
.voice-chevron {
  width: 22px;
  border: none;
}
.voice-chevron svg {
  width: 13px;
  height: 13px;
  transition: transform 0.15s ease;
}
.voice-chevron.open svg {
  transform: rotate(180deg);
}

/* ── settings menu ──────────────────────────────────────────────────────── */
.voice-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  z-index: 110;
  min-width: 260px;
  padding: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 6px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.voice-menu-level {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 8px;
}
.level-mic-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--text-muted);
}
.level-track {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-tertiary);
  overflow: hidden;
}
.level-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--accent-blue);
  transition: width 80ms linear;
}
.voice-menu-devices {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.voice-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 7px 8px;
  border: none;
  border-radius: var(--radius-sm, 4px);
  background: transparent;
  color: var(--text-primary);
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease;
}
.voice-menu-item:hover {
  background: var(--bg-tertiary);
}
.voice-menu-item-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.voice-menu-check {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--accent-blue);
}
.voice-menu-empty {
  color: var(--text-muted);
  cursor: default;
}
.voice-menu-empty:hover {
  background: transparent;
}
.voice-menu-divider {
  height: 1px;
  margin: 4px 0;
  background: var(--border-color);
}

/* hold-to-record toggle (CSS pill switch) */
.voice-toggle {
  position: relative;
  width: 30px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 8px;
  background: var(--bg-tertiary);
  transition: background 0.15s ease;
}
.voice-toggle.on {
  background: var(--accent-blue);
}
.voice-toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s ease;
}
.voice-toggle.on .voice-toggle-knob {
  transform: translateX(14px);
}

/* ── recording bar ──────────────────────────────────────────────────────── */
.voice-recording-bar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.voice-waveform {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 18px;
}
.wave-bar {
  width: 2px;
  border-radius: 1px;
  background: var(--text-secondary);
  transition: height 80ms linear;
}
.voice-status {
  font-size: 11.5px;
  color: var(--text-muted);
  white-space: nowrap;
}
.voice-rec-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.voice-rec-btn svg {
  width: 14px;
  height: 14px;
}
.voice-cancel:hover:not(:disabled) {
  border-color: var(--text-secondary);
  color: var(--text-primary);
  background: var(--bg-tertiary);
}
.voice-confirm {
  border-color: var(--accent-blue);
  background: var(--accent-blue);
  color: #fff;
}
.voice-confirm:hover:not(:disabled) {
  filter: brightness(1.1);
}
.voice-rec-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
