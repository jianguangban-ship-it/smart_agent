<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="composer-popout"
      :class="{ 'is-maximized': state.maximized }"
      :style="windowStyle"
      role="dialog"
      :aria-label="t(props.titleKey)"
    >
      <!-- Title bar: drag to move, double-click to maximize/restore -->
      <div
        ref="titleBarRef"
        class="popout-titlebar"
        @pointerdown="onDragStart"
        @dblclick="toggleMaximize"
      >
        <span class="popout-grip" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9"  cy="6"  r="1"/><circle cx="15" cy="6"  r="1"/>
            <circle cx="9"  cy="12" r="1"/><circle cx="15" cy="12" r="1"/>
            <circle cx="9"  cy="18" r="1"/><circle cx="15" cy="18" r="1"/>
          </svg>
        </span>
        <span class="popout-title">{{ t(props.titleKey) }}</span>
        <button
          class="popout-iconbtn"
          :title="state.maximized ? t('coach.composerRestore') : t('coach.composerMaximize')"
          :aria-label="state.maximized ? t('coach.composerRestore') : t('coach.composerMaximize')"
          @click="toggleMaximize"
        >
          <svg v-if="!state.maximized" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="4" width="16" height="16" rx="1"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="7" y="3" width="14" height="14" rx="1"/>
            <rect x="3" y="7" width="14" height="14" rx="1"/>
          </svg>
        </button>
        <button
          class="popout-iconbtn"
          :title="t('coach.composerClose')"
          :aria-label="t('coach.composerClose')"
          @click="close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="6" y1="6" x2="18" y2="18"/>
            <line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Body: textarea bound to the same v-model as the inline composer -->
      <textarea
        ref="textareaRef"
        v-model="textModel"
        class="popout-textarea"
        :placeholder="t(props.placeholderKey)"
        @keydown="onKeydown"
      ></textarea>

      <!-- Footer: Send button (mirrors TaskForm's .action-coach styling) -->
      <div class="popout-footer">
        <span class="popout-hint">{{ t('shortcuts.coach') }}</span>
        <button
          class="popout-send"
          :style="{ backgroundColor: props.sendAccent }"
          :disabled="!textModel.trim()"
          @click="onSubmit"
        >
          <svg class="popout-send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          {{ t('coach.composerSend') }}
        </button>
      </div>

      <!-- Resize handle (bottom-right) -->
      <div
        class="popout-resize"
        :title="t('coach.composerMaximize')"
        @pointerdown="onResizeStart"
      >
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <line x1="3" y1="11" x2="11" y2="3"/>
          <line x1="7" y1="11" x2="11" y2="7"/>
        </svg>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from '@/i18n'

const props = withDefaults(defineProps<{
  open: boolean
  /** i18n key for the title bar text. Defaults to 'coach.composerTitle' for
      backwards compat with the Task-mode call site; Explore passes its own. */
  titleKey?: string
  /** i18n key for the textarea placeholder. */
  placeholderKey?: string
  /** CSS color (often a `var(--accent-*)`) used as the Send button background. */
  sendAccent?: string
}>(), {
  titleKey: 'coach.composerTitle',
  placeholderKey: 'form.taskDescriptionPlaceholder',
  sendAccent: 'var(--accent-orange)',
})
const emit = defineEmits<{
  'update:open': [v: boolean]
  submit: []
}>()
const textModel = defineModel<string>({ required: true })
const { t } = useI18n()

const STORAGE_KEY = 'smart_agent.composer_popout_state'
const MIN_W = 320
const MIN_H = 200
const DEFAULT_W = 600
const DEFAULT_H = 360
const VIEWPORT_MARGIN = 40

type Persisted = { x: number; y: number; width: number; height: number; maximized: boolean }
type State = Persisted & { prev?: { x: number; y: number; width: number; height: number } }

function defaultState(): State {
  return {
    x: Math.max(VIEWPORT_MARGIN, Math.round(window.innerWidth / 2 - DEFAULT_W / 2)),
    y: 80,
    width: DEFAULT_W,
    height: DEFAULT_H,
    maximized: false,
  }
}

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as Partial<Persisted>
    const s = { ...defaultState(), ...parsed }
    // Clamp into the current viewport in case the window was resized smaller
    // since the last session (else the popout would open off-screen).
    s.width = Math.min(Math.max(s.width, MIN_W), window.innerWidth)
    s.height = Math.min(Math.max(s.height, MIN_H), window.innerHeight)
    s.x = Math.min(Math.max(s.x, -s.width + VIEWPORT_MARGIN), window.innerWidth - VIEWPORT_MARGIN)
    s.y = Math.min(Math.max(s.y, 0), window.innerHeight - VIEWPORT_MARGIN)
    return s
  } catch {
    return defaultState()
  }
}

const state = reactive<State>(defaultState())

let saveTimer: number | null = null
function scheduleSave() {
  if (saveTimer !== null) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    const { x, y, width, height, maximized } = state
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y, width, height, maximized })) } catch { /* quota / disabled */ }
    saveTimer = null
  }, 150)
}

const windowStyle = computed(() => {
  if (state.maximized) {
    return {
      left: '5vw', top: '5vh', width: '90vw', height: '85vh',
    }
  }
  return {
    left: state.x + 'px',
    top: state.y + 'px',
    width: state.width + 'px',
    height: state.height + 'px',
  }
})

const textareaRef = ref<HTMLTextAreaElement>()
const titleBarRef = ref<HTMLElement>()

// ── Drag ─────────────────────────────────────────────────────────────────
let dragOffsetX = 0
let dragOffsetY = 0
function onDragStart(e: PointerEvent) {
  // Ignore clicks on the title-bar buttons (close / maximize)
  if ((e.target as HTMLElement).closest('.popout-iconbtn')) return
  if (state.maximized) return
  dragOffsetX = e.clientX - state.x
  dragOffsetY = e.clientY - state.y
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd, { once: true })
  e.preventDefault()
}
function onDragMove(e: PointerEvent) {
  const nx = e.clientX - dragOffsetX
  const ny = e.clientY - dragOffsetY
  state.x = Math.min(
    Math.max(nx, -state.width + VIEWPORT_MARGIN),
    window.innerWidth - VIEWPORT_MARGIN
  )
  state.y = Math.min(Math.max(ny, 0), window.innerHeight - VIEWPORT_MARGIN)
}
function onDragEnd() {
  window.removeEventListener('pointermove', onDragMove)
  scheduleSave()
}

// ── Resize ───────────────────────────────────────────────────────────────
let resizeStartX = 0
let resizeStartY = 0
let resizeStartW = 0
let resizeStartH = 0
function onResizeStart(e: PointerEvent) {
  if (state.maximized) return
  resizeStartX = e.clientX
  resizeStartY = e.clientY
  resizeStartW = state.width
  resizeStartH = state.height
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeEnd, { once: true })
  e.preventDefault()
  e.stopPropagation()
}
function onResizeMove(e: PointerEvent) {
  const dw = e.clientX - resizeStartX
  const dh = e.clientY - resizeStartY
  state.width = Math.min(
    Math.max(resizeStartW + dw, MIN_W),
    window.innerWidth - state.x
  )
  state.height = Math.min(
    Math.max(resizeStartH + dh, MIN_H),
    window.innerHeight - state.y
  )
}
function onResizeEnd() {
  window.removeEventListener('pointermove', onResizeMove)
  scheduleSave()
}

// ── Maximize / restore ───────────────────────────────────────────────────
function toggleMaximize() {
  if (state.maximized) {
    if (state.prev) {
      state.x = state.prev.x
      state.y = state.prev.y
      state.width = state.prev.width
      state.height = state.prev.height
    }
    state.maximized = false
  } else {
    state.prev = { x: state.x, y: state.y, width: state.width, height: state.height }
    state.maximized = true
  }
  scheduleSave()
}

// ── Close / submit ───────────────────────────────────────────────────────
function close() {
  emit('update:open', false)
}
function onSubmit() {
  if (!textModel.value.trim()) return
  emit('submit')
}
function onKeydown(e: KeyboardEvent) {
  // Mirror DescriptionEditor's Enter-submits-on-composer with the IME guard.
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    onSubmit()
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

// ── Open lifecycle ───────────────────────────────────────────────────────
watch(() => props.open, (now) => {
  if (now) {
    Object.assign(state, loadState())
    nextTick(() => textareaRef.value?.focus())
  }
})

onMounted(() => {
  if (props.open) Object.assign(state, loadState())
})

onUnmounted(() => {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointermove', onResizeMove)
  if (saveTimer !== null) window.clearTimeout(saveTimer)
})
</script>

<style scoped>
.composer-popout {
  position: fixed;
  z-index: 200;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 6px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}
.popout-titlebar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 8px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}
.composer-popout.is-maximized .popout-titlebar {
  cursor: default;
}
.popout-grip {
  display: inline-flex;
  align-items: center;
  color: var(--text-muted);
  opacity: 0.6;
}
.popout-grip svg {
  width: 14px;
  height: 14px;
}
.popout-title {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}
.popout-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm, 4px);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.popout-iconbtn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
.popout-iconbtn svg {
  width: 13px;
  height: 13px;
}

.popout-textarea {
  flex: 1;
  width: 100%;
  padding: 12px;
  border: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
}
.popout-textarea:focus {
  outline: none;
}

.popout-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 40px;
  padding: 0 10px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}
.popout-hint {
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.7;
  font-family: var(--font-mono);
}
.popout-send {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-sm, 4px);
  /* background-color is set via :style binding from the sendAccent prop;
     defaults to var(--accent-orange) for backwards compat with Task mode. */
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: filter 0.15s;
}
.popout-send:hover:not(:disabled) {
  filter: brightness(1.15);
}
.popout-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.popout-send-icon {
  width: 13px;
  height: 13px;
}

.popout-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  color: var(--text-muted);
  opacity: 0.5;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 1px;
}
.popout-resize:hover { opacity: 1; }
.popout-resize svg { width: 12px; height: 12px; }
.composer-popout.is-maximized .popout-resize { display: none; }
</style>
