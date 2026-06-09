<template>
  <Transition name="artifact-slide">
    <aside
      v-if="current"
      ref="panelEl"
      class="artifact-panel"
      :class="{ 'artifact-panel--dragging': dragging }"
      :style="{ width: panelWidth + 'px' }"
      :aria-label="current.filename"
    >
      <!-- Drag handle on the chat/panel border (Claude-style col-resize). -->
      <div
        class="artifact-resizer"
        role="separator"
        aria-orientation="vertical"
        :aria-label="t('coach.artifactResize')"
        @pointerdown="startResize"
      />
      <header class="artifact-head">
        <div class="artifact-head-info">
          <div class="artifact-title" :title="current.filename">{{ current.filename }}</div>
          <div class="artifact-sub">{{ current.label }} · {{ linesLabel }}</div>
        </div>
        <div class="artifact-actions">
          <div v-if="previewable" class="artifact-toggle" role="tablist">
            <button
              type="button"
              role="tab"
              :class="{ active: view === 'preview' }"
              :aria-selected="view === 'preview'"
              @click="view = 'preview'"
            >{{ t('coach.artifactPreview') }}</button>
            <button
              type="button"
              role="tab"
              :class="{ active: view === 'code' }"
              :aria-selected="view === 'code'"
              @click="view = 'code'"
            >{{ t('coach.artifactCode') }}</button>
          </div>
          <button type="button" class="artifact-btn" @click="copy">{{ t('coach.copyCode') }}</button>
          <button type="button" class="artifact-btn" @click="download">{{ t('coach.downloadCode') }}</button>
          <button type="button" class="artifact-close" :title="t('coach.artifactClose')" :aria-label="t('coach.artifactClose')" @click="close">✕</button>
        </div>
      </header>

      <!-- Rendered preview (HTML / SVG), sandboxed + isolated from the app. -->
      <iframe
        v-if="previewable && view === 'preview'"
        class="artifact-iframe"
        :srcdoc="srcdoc"
        sandbox="allow-scripts"
        referrerpolicy="no-referrer"
        :title="current.filename"
      />

      <!-- Code view with a left line-number gutter. -->
      <div v-else class="artifact-body">
        <div class="artifact-code">
          <pre class="artifact-gutter" aria-hidden="true">{{ gutterText }}</pre>
          <div class="artifact-code-scroll coach-response" v-html="codeHtml" />
        </div>
      </div>
    </aside>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useI18n } from '@/i18n'
import { useArtifact } from '@/composables/useArtifact'
import { useToast } from '@/composables/useToast'
import { renderMarkdown } from '@/utils/markdown'
import { copyText } from '@/utils/clipboard'
import { downloadFile } from '@/utils/exportFormats'

const { t } = useI18n()
const { current, close } = useArtifact()
const { addToast } = useToast()

// ── Resizable panel width (persisted) ─────────────────────────────────────────
const LS_WIDTH_KEY = 'explore_artifact_width'
const MIN_WIDTH = 320
const MIN_CHAT = 280

function clampWidth(w: number, rightEdge = window.innerWidth): number {
  const max = Math.min(window.innerWidth * 0.8, rightEdge - MIN_CHAT)
  return Math.round(Math.max(MIN_WIDTH, Math.min(w, Math.max(MIN_WIDTH, max))))
}

const panelEl = ref<HTMLElement | null>(null)
const panelWidth = ref<number>((() => {
  const stored = Number(localStorage.getItem(LS_WIDTH_KEY))
  if (stored > 0) return clampWidth(stored)
  return clampWidth(Math.round(window.innerWidth * 0.42))
})())
const dragging = ref(false)
let rightEdge = 0

// rAF-coalesced so we apply at most one width update per frame (smooth drag).
let pendingX = 0
let rafId = 0
function applyResize() {
  rafId = 0
  panelWidth.value = clampWidth(rightEdge - pendingX, rightEdge)
}
function onResizeMove(e: PointerEvent) {
  e.preventDefault()
  pendingX = e.clientX
  if (!rafId) rafId = requestAnimationFrame(applyResize)
}
function stopResize() {
  dragging.value = false
  if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', stopResize)
  localStorage.setItem(LS_WIDTH_KEY, String(panelWidth.value))
}
function startResize(e: PointerEvent) {
  e.preventDefault()
  rightEdge = panelEl.value?.getBoundingClientRect().right ?? window.innerWidth
  dragging.value = true
  // Capture the pointer so moves keep firing even when the cursor crosses the
  // preview <iframe> (otherwise the iframe swallows them and the drag freezes).
  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop */ }
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', stopResize)
}
onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', stopResize)
})

// 'html' | 'svg' → rendered preview; 'text' → code only. Uses the hljs language
// token plus a content sniff (the model may fence svg as ```xml etc.).
const kind = computed<'html' | 'svg' | 'text'>(() => {
  const a = current.value
  if (!a) return 'text'
  const head = a.code.trimStart().slice(0, 64).toLowerCase()
  if ((a.lang || '').toLowerCase() === 'svg' || head.startsWith('<svg')) return 'svg'
  if ((a.lang || '').toLowerCase() === 'html' || head.startsWith('<!doctype html') || head.startsWith('<html')) return 'html'
  return 'text'
})
const previewable = computed(() => kind.value !== 'text')

const view = ref<'preview' | 'code'>('preview')
// Each newly opened artifact starts on the right view.
watch(current, () => { view.value = previewable.value ? 'preview' : 'code' }, { immediate: true })

const lineCount = computed(() => {
  const a = current.value
  if (!a) return 0
  return a.code.replace(/\n$/, '').split('\n').length
})
const gutterText = computed(() =>
  Array.from({ length: lineCount.value }, (_, i) => i + 1).join('\n')
)
const linesLabel = computed(() =>
  t('coach.artifactLines').replace('{n}', String(current.value?.lines ?? lineCount.value))
)

// Render the source through the existing markdown pipeline for hljs highlighting.
// A 4-backtick fence avoids colliding with any 3-backtick sequences in the code.
const codeHtml = computed(() => {
  const a = current.value
  if (!a) return ''
  return renderMarkdown('````' + a.lang + '\n' + a.code + '\n````')
})

// Preview wrapper for standalone SVG artifacts. A light checkerboard backdrop
// (the standard image/SVG-viewer pattern) reveals white/transparent artwork that
// a flat white background would hide; SVGs carrying their own solid background
// simply cover it. `svg{width:auto;height:auto;max-*}` overrides the SVG's own
// width/height so `width="100%"`/`height="100%"` artwork renders at its viewBox
// size (scaled to fit) instead of collapsing to a blank box.
const SVG_WRAP_STYLE = '<style>'
  + 'html,body{margin:0;height:100%}'
  + 'body{box-sizing:border-box;display:grid;place-items:center;padding:12px;'
  + 'background-color:#fff;'
  + 'background-image:linear-gradient(45deg,#e9eaee 25%,transparent 25%),linear-gradient(-45deg,#e9eaee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e9eaee 75%),linear-gradient(-45deg,transparent 75%,#e9eaee 75%);'
  + 'background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0}'
  + 'svg{width:auto;height:auto;max-width:100%;max-height:100%}'
  + '</style>'

const srcdoc = computed(() => {
  const a = current.value
  if (!a) return ''
  if (kind.value === 'svg') {
    return '<!doctype html><meta charset="utf-8">' + SVG_WRAP_STYLE + a.code
  }
  return a.code
})

async function copy() {
  const a = current.value
  if (!a) return
  const ok = await copyText(a.code)
  addToast(ok ? 'success' : 'error', t(ok ? 'toast.copied' : 'toast.copyFailed'), 2000)
}
function download() {
  const a = current.value
  if (!a) return
  downloadFile(a.code, a.filename, a.mime)
  addToast('success', t('toast.downloaded'), 2000)
}
</script>

<style scoped>
.artifact-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  flex-shrink: 0;
  border-left: 1px solid var(--border-color);
  /* Elevated surface (Claude bg-000) vs the chat (bg-primary = Claude bg-100). */
  background: var(--bg-secondary);
}
.artifact-panel--dragging {
  user-select: none;
}
/* Draggable splitter straddling the chat/panel border. */
.artifact-resizer {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 10px;
  transform: translateX(-50%);
  cursor: col-resize;
  z-index: 5;
  touch-action: none;
}
/* Full-height border line */
.artifact-resizer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 1px;
  height: 100%;
  background: var(--border-color);
  transition: background 0.15s;
}
/* Small centered grip bar */
.artifact-resizer::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 36px;
  border-radius: 3px;
  background: var(--border-color);
  transition: background 0.15s;
}
/* Hover: line → light blue, grip → darker blue */
.artifact-resizer:hover::before {
  background: var(--accent-blue);
}
.artifact-resizer:hover::after {
  background: color-mix(in srgb, var(--accent-blue) 65%, black);
}
/* Dragging (after hover so it wins): both line + grip turn light blue.
   Also mirror on :active for the press state. */
.artifact-panel--dragging .artifact-resizer::before,
.artifact-panel--dragging .artifact-resizer::after,
.artifact-resizer:active::before,
.artifact-resizer:active::after {
  background: var(--accent-blue);
}
/* Don't let the preview iframe swallow pointer events mid-drag. */
.artifact-panel--dragging .artifact-iframe {
  pointer-events: none;
}
.artifact-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--border-color);
}
.artifact-head-info {
  min-width: 0;
}
.artifact-title {
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artifact-sub {
  font-size: var(--font-xs);
  color: var(--text-muted);
}
.artifact-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}
/* Preview | Code segmented toggle */
.artifact-toggle {
  display: inline-flex;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.artifact-toggle button {
  padding: 2px var(--space-2);
  font-size: var(--font-xs);
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.artifact-toggle button.active {
  color: white;
  background: var(--accent-blue);
}
.artifact-btn {
  padding: 2px var(--space-2);
  font-size: var(--font-xs);
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.artifact-btn:hover {
  color: var(--accent-blue);
  border-color: var(--accent-blue);
}
.artifact-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.artifact-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* Rendered preview */
.artifact-iframe {
  flex: 1;
  min-height: 0;
  width: 100%;
  border: 0;
  background: #fff;
}

/* Code view */
.artifact-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.artifact-code {
  display: flex;
  align-items: stretch;
  min-height: 100%;
  /* Shared metrics so gutter numbers line up with code lines. */
  --art-code-lh: 1.55;
  font-size: var(--font-base);
}
.artifact-gutter {
  margin: 0;
  flex-shrink: 0;
  padding: var(--space-3) var(--space-2);
  text-align: right;
  font-family: var(--font-mono);
  font-size: inherit;
  line-height: var(--art-code-lh);
  color: var(--text-muted);
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  user-select: none;
  white-space: pre;
}
.artifact-code-scroll {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}
/* The rendered <pre><code> from renderMarkdown — strip the inherited chrome so
   it aligns with the gutter; keep hljs token colors (global .hljs* rules). */
.artifact-code-scroll :deep(.code-artifact),
.artifact-code-scroll :deep(pre) {
  margin: 0;
  border: 0;
  border-radius: 0;
}
.artifact-code-scroll :deep(pre) {
  padding: var(--space-3) var(--space-3);
  background: transparent;
  white-space: pre;
  line-height: var(--art-code-lh);
  font-size: inherit;
}
.artifact-code-scroll :deep(pre code),
.artifact-code-scroll :deep(.hljs) {
  background: transparent;
  line-height: var(--art-code-lh);
}

/* Slide-in from the right */
.artifact-slide-enter-active,
.artifact-slide-leave-active {
  transition: transform 0.22s ease, opacity 0.22s ease;
}
.artifact-slide-enter-from,
.artifact-slide-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
</style>
