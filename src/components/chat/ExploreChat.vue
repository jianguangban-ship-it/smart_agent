<template>
  <section class="explore-chat" :class="{ 'rail-collapsed': railCollapsed }" :aria-label="t('coach.titleExplore')">
    <!-- Left vertical rail: New chat / Chat / History (Claude-style sidebar).
         Collapses to icons via the toggle; state persisted. -->
    <nav class="explore-rail" :aria-label="t('coach.titleExplore')">
      <button
        type="button"
        class="rail-toggle"
        :title="t('coach.railToggle')"
        :aria-label="t('coach.railToggle')"
        @click="toggleRail"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="9" y1="4" x2="9" y2="20" />
        </svg>
      </button>
      <button
        type="button"
        class="rail-item explore-newchat"
        :title="t('coach.exploreNewChat')"
        @click="onNewChat"
      >
        <svg class="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span class="rail-label">{{ t('coach.exploreNewChat') }}</span>
      </button>
      <button
        type="button"
        role="tab"
        class="rail-item explore-tab"
        :class="{ active: activeTab === 'chat' }"
        :aria-selected="activeTab === 'chat'"
        :title="t('coach.tabChat')"
        @click="activeTab = 'chat'"
      >
        <svg class="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span class="rail-label">{{ t('coach.tabChat') }}</span>
      </button>
      <button
        type="button"
        role="tab"
        class="rail-item explore-tab"
        :class="{ active: activeTab === 'history' }"
        :aria-selected="activeTab === 'history'"
        :title="t('coach.tabHistory')"
        @click="activeTab = 'history'"
      >
        <svg class="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" />
        </svg>
        <span class="rail-label">{{ t('coach.tabHistory') }}</span>
      </button>
    </nav>

    <div class="explore-main">
    <template v-if="activeTab === 'chat'">
      <div class="explore-scroll-wrap">
        <div ref="scrollEl" class="explore-scroll" @scroll="onScroll">
          <div v-if="messages.length === 0" class="explore-empty">
            <div class="explore-empty-title">{{ t('coach.exploreEmptyTitle') }}</div>
            <div class="explore-empty-sub">{{ t('coach.exploreEmptySub') }}</div>
          </div>
          <ChatBubble
            v-for="m in messages"
            :key="m.id"
            :message="m"
            :hash-id="m.hashId"
            layout="stacked"
            @retry="(id) => emit('regenerate', id)"
            @edit="(p) => emit('edit-message', p)"
          />
          <div v-if="backoffSecs > 0" class="explore-backoff">
            {{ t('coach.backoffLabel') }} {{ backoffSecs }}s
          </div>
        </div>
        <!-- Custom short (~1/3 height) draggable scrollbar; native bar hidden.
             Inset from the right edge to leave a gap from the artifact grip. -->
        <div v-show="showThumb" class="chat-scrollbar" aria-hidden="true">
          <div
            ref="thumbEl"
            class="chat-thumb"
            :style="thumbStyle"
            @pointerdown="thumbDown"
          />
        </div>
      </div>

      <div class="explore-composer-wrap">
        <!-- Claude-style composer box: chip + textarea on top, a control bar
             below (+ add-file left | model label + Send right). Expand/popout
             stays inside DescriptionEditor. Mic/voice intentionally omitted. -->
        <div class="composer-box">
          <input
            ref="fileInputRef"
            type="file"
            multiple
            :accept="acceptHint"
            class="hidden-file-input"
            @change="handleFileSelect"
          />
          <TransitionGroup v-if="hasAttachment" name="chip-fade" tag="div" class="attach-chip-row">
            <span v-for="f in attachedFiles" :key="f.name" class="attach-chip">
              <img v-if="f.kind === 'image' && f.content" class="attach-chip-thumb" :src="f.content" :alt="f.name" />
              <svg v-else class="attach-chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
              </svg>
              <span class="attach-chip-name" :title="f.name">{{ f.name }}</span>
              <button class="attach-remove" @click="detach(f.name)" :title="t('form.removeAttachment')">×</button>
            </span>
          </TransitionGroup>
          <div class="explore-input-wrap">
            <DescriptionEditor
              variant="composer"
              v-model="draft"
              @submit="send"
              @expand="isPopoutOpen = true"
            />
          </div>
          <div class="explore-composer">
            <button
              type="button"
              class="composer-add-btn"
              :title="t('coach.composerAddFile')"
              :aria-label="t('coach.composerAddFile')"
              @click="openFilePicker"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <div class="composer-bar-right">
              <span
                class="composer-context"
                :class="{ over: ctxUsage.over }"
                :title="ctxTitle"
              >{{ ctxBadge }}</span>
              <select
                class="composer-model-select"
                :value="exploreModel"
                :title="exploreModel"
                :aria-label="t('coach.composerModelSelect')"
                @change="onModelChange"
              >
                <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
              </select>
              <button
                v-if="isLoading"
                type="button"
                class="explore-stop"
                @click="$emit('cancel')"
              >{{ t('coach.exploreStop') }}</button>
              <button
                v-else
                type="button"
                class="explore-send"
                :disabled="!draft.trim() || ctxUsage.over"
                @click="send"
              >{{ t('coach.exploreSend') }}</button>
            </div>
          </div>
        </div>
        <p class="composer-reminder">{{ t('coach.composerDisclaimer') }}</p>
      </div>
    </template>

    <div v-else class="explore-history">
      <CoachHistoryTab
        :channel="'explore'"
        @replay="onReplay"
        @continue-session="onContinue"
      />
    </div>
    </div>
  </section>

  <!-- v10.130: Explore-mode floating composer popout (mirrors Task-mode's
       coach composer UX from v10.129). Teleports to <body>, so DOM position
       here is purely conventional. Title / placeholder / send color are
       overridden to Explore's wording and blue accent. -->
  <ComposerPopout
    v-model="draft"
    v-model:open="isPopoutOpen"
    title-key="coach.composerTitleExplore"
    placeholder-key="coach.explorePlaceholder"
    send-accent="var(--accent-blue)"
    @submit="send"
  />
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from '@/i18n'
import ChatBubble from './ChatBubble.vue'
import CoachHistoryTab from '@/components/coach/CoachHistoryTab.vue'
import DescriptionEditor from '@/components/form/DescriptionEditor.vue'
import ComposerPopout from '@/components/form/ComposerPopout.vue'
import { useAttachment, inlineAttachments, type AttachError, ATTACH_ACCEPT_HINT, IMAGE_ACCEPT_HINT } from '@/composables/useAttachment'
import { useToast } from '@/composables/useToast'
import { exploreModel, availableModels, setExploreModel, getContextLimitTokens, isVisionModel } from '@/config/llm'
import { getResponseFormat } from '@/config/skills'
import { contextUsage, formatTokens } from '@/utils/contextCalculator'
import type { ChatMessage, LLMChatMessage } from '@/types/api'

const { t } = useI18n()
// Image attachment is offered only when a vision model is selected; text models
// (e.g. minimax) get a text-only file picker.
const acceptHint = computed(() =>
  isVisionModel(exploreModel.value) ? `${ATTACH_ACCEPT_HINT},${IMAGE_ACCEPT_HINT}` : ATTACH_ACCEPT_HINT
)
const { attachedFiles, attachValidated, detach, hasAttachment } = useAttachment()
const { addToast } = useToast()

const props = defineProps<{
  messages: ChatMessage[]
  isLoading: boolean
  hadError: boolean
  backoffSecs: number
}>()
const emit = defineEmits<{
  (e: 'send', text: string): void
  (e: 'cancel'): void
  (e: 'new-chat'): void
  (e: 'replay', text: string): void
  (e: 'continue-session', sessionId: string): void
  (e: 'regenerate', id: string): void
  (e: 'edit-message', payload: { id: string; content: string }): void
}>()

const activeTab = ref<'chat' | 'history'>('chat')
// Left rail collapse state (persisted). Labels hide → icon-only when collapsed.
const LS_RAIL_KEY = 'explore_rail_collapsed'
const railCollapsed = ref<boolean>(localStorage.getItem(LS_RAIL_KEY) === '1')
function toggleRail() {
  railCollapsed.value = !railCollapsed.value
  localStorage.setItem(LS_RAIL_KEY, railCollapsed.value ? '1' : '0')
}
const draft = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
// v10.130: matches Task-mode coach composer UX — clicking the ⤢ on the inline
// composer opens a floating draggable popout sharing the same draft model.
const isPopoutOpen = ref(false)

function openFilePicker() {
  fileInputRef.value?.click()
}

async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return
  // Attach each selected file; toast per rejection (type/size) but keep going.
  for (const file of Array.from(files)) {
    const isImg = /\.(png|jpe?g|gif|webp)$/i.test(file.name)
    // Images are only allowed on a vision model (the picker's accept hint also
    // hides them, but that's only advisory).
    if (isImg && !isVisionModel(exploreModel.value)) {
      addToast('error', `${file.name}: ${t('toast.imageNeedsVisionModel')}`)
      continue
    }
    try {
      await attachValidated(file)
    } catch (err) {
      const reason = err as AttachError
      const key = reason === 'size'
        ? (isImg ? 'toast.imageTooLarge' : 'toast.fileTooLarge')
        : 'toast.invalidComposerFile'
      addToast('error', `${file.name}: ${t(key)}`)
    }
  }
  // Reset so the same file can be re-selected
  input.value = ''
}
const scrollEl = ref<HTMLElement | null>(null)
// Stick to bottom only when the user is already near it — don't yank them
// down while they've scrolled up to read earlier messages.
const stick = ref(true)

function onScroll() {
  const el = scrollEl.value
  if (!el) return
  stick.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  updateThumb()
}

// ── Custom chat scrollbar: a short (~1/3 height) draggable thumb ──────────────
const thumbEl = ref<HTMLElement | null>(null)
const showThumb = ref(false)
const thumbH = ref(0)
const thumbY = ref(0)
const TRACK_INSET = 8
const thumbStyle = computed(() => ({
  height: thumbH.value + 'px',
  transform: `translateY(${thumbY.value}px)`,
}))

function trackMetrics() {
  const el = scrollEl.value!
  const trackH = el.clientHeight - 2 * TRACK_INSET
  const h = Math.round(trackH / 3)
  return { trackH, h, maxTravel: trackH - h, range: el.scrollHeight - el.clientHeight }
}
function updateThumb() {
  const el = scrollEl.value
  if (!el) return
  if (el.scrollHeight <= el.clientHeight + 1) { showThumb.value = false; return }
  showThumb.value = true
  const { h, maxTravel, range } = trackMetrics()
  thumbH.value = h
  thumbY.value = TRACK_INSET + (range > 0 ? el.scrollTop / range : 0) * maxTravel
}

let dragStartY = 0
let dragStartTop = 0
function thumbMove(e: PointerEvent) {
  const el = scrollEl.value
  if (!el) return
  const { maxTravel, range } = trackMetrics()
  const perPx = maxTravel > 0 ? range / maxTravel : 0
  el.scrollTop = Math.max(0, Math.min(dragStartTop + (e.clientY - dragStartY) * perPx, range))
}
function thumbUp() {
  window.removeEventListener('pointermove', thumbMove)
  window.removeEventListener('pointerup', thumbUp)
}
function thumbDown(e: PointerEvent) {
  e.preventDefault()
  dragStartY = e.clientY
  dragStartTop = scrollEl.value?.scrollTop ?? 0
  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop */ }
  window.addEventListener('pointermove', thumbMove)
  window.addEventListener('pointerup', thumbUp)
}

let resizeObs: ResizeObserver | null = null
onMounted(() => {
  if (scrollEl.value && 'ResizeObserver' in window) {
    resizeObs = new ResizeObserver(() => updateThumb())
    resizeObs.observe(scrollEl.value)
  }
  nextTick(updateThumb)
})
onBeforeUnmount(() => {
  resizeObs?.disconnect()
  window.removeEventListener('pointermove', thumbMove)
  window.removeEventListener('pointerup', thumbUp)
})

// Live context-size guard: project the payload we would send (system prompt +
// full history + the current draft with any attachment) and measure it against
// the active model's context-window limit. Mirrors useLLM's apiMessages shape.
const ctxUsage = computed(() => {
  const projected: LLMChatMessage[] = [
    { role: 'system', content: getResponseFormat() },
    ...props.messages.map(m => ({
      role: m.role,
      content: m.attachments?.length ? inlineAttachments(m.content, m.attachments) : m.content,
    })),
    { role: 'user', content: inlineAttachments(draft.value, attachedFiles.value) },
  ]
  return contextUsage(projected, getContextLimitTokens(exploreModel.value))
})
const ctxBadge = computed(() => `${formatTokens(ctxUsage.value.tokens)} / ${formatTokens(ctxUsage.value.limit)} tok`)
const ctxTitle = computed(() => t('coach.contextBadgeTitle').replace('{model}', exploreModel.value))

function onModelChange(e: Event) {
  setExploreModel((e.target as HTMLSelectElement).value)
  // Switching to a text model: drop any already-attached images (text files kept).
  if (!isVisionModel(exploreModel.value)) {
    attachedFiles.value.filter(f => f.kind === 'image').map(f => f.name).forEach(detach)
  }
}

function send() {
  const text = draft.value.trim()
  if (!text || props.isLoading) return
  if (ctxUsage.value.over) {
    const u = ctxUsage.value
    addToast('error', t('coach.contextOverLimit')
      .replace('{used}', formatTokens(u.tokens))
      .replace('{limit}', formatTokens(u.limit)))
    return
  }
  emit('send', text)
  draft.value = ''
  stick.value = true
}

function onNewChat() {
  activeTab.value = 'chat'
  draft.value = ''
  stick.value = true
  emit('new-chat')
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = 0
    updateThumb()
  })
}
function onReplay(content: string) {
  activeTab.value = 'chat'
  emit('replay', content)
}
function onContinue(sessionId: string) {
  activeTab.value = 'chat'
  emit('continue-session', sessionId)
}

watch(
  () => props.messages.map(m => m.content).join('|'),
  () => nextTick(() => {
    const el = scrollEl.value
    if (el && stick.value) el.scrollTop = el.scrollHeight
    updateThumb()
  })
)
</script>

<style scoped>
.explore-chat {
  display: flex;
  flex-direction: row;
  height: 100%;
  min-height: 0;
  /* Fill the .explore-layout flex row (App.vue) so the chat is full-width when
     the artifact viewer is closed and shrinks when it opens. Set here (not in
     App.vue) because ExploreChat is multi-root, so a parent's scoped style can't
     reliably target this root. */
  flex: 1;
  min-width: 0;
}
/* Left vertical rail (New chat / Chat / History), collapsible to icons. */
.explore-rail {
  flex-shrink: 0;
  width: 168px;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  border-right: 1px solid var(--border-color);
  /* Same surface as the main chat panel (page --bg-primary); the only
     delineation is the thin border-right. */
  background: transparent;
  transition: width 0.18s ease;
}
.rail-collapsed .explore-rail {
  width: 52px;
}
.rail-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  align-self: flex-end;
  margin-bottom: var(--space-1);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.rail-collapsed .rail-toggle {
  align-self: center;
}
.rail-toggle:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.rail-toggle svg {
  width: 17px;
  height: 17px;
}
.rail-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.rail-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.rail-item.active {
  color: var(--accent-blue);
  background: var(--blue-subtle, rgba(96, 165, 250, 0.12));
}
.rail-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.rail-collapsed .rail-item {
  justify-content: center;
}
.rail-collapsed .rail-label {
  display: none;
}
/* Main column to the right of the rail: chat scroll + composer / history. */
.explore-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* Holds the scroller + the custom scrollbar overlay. */
.explore-scroll-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}
.explore-scroll {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  /* Native scrollbar hidden — replaced by the custom ~1/3 thumb. */
  scrollbar-width: none;
}
.explore-scroll::-webkit-scrollbar {
  width: 0;
  height: 0;
}
/* Custom scrollbar: thin track inset from the right edge (the inset is the gap
   from the artifact panel's grip bar). */
.chat-scrollbar {
  position: absolute;
  top: 0;
  right: 4px;
  width: 6px;
  height: 100%;
  pointer-events: none;
}
.chat-thumb {
  position: absolute;
  top: 0;
  left: 0;
  width: 6px;
  border-radius: 3px;
  background: var(--border-color);
  pointer-events: auto;
  cursor: pointer;
  touch-action: none;
  transition: background 0.15s;
}
.chat-thumb:hover {
  background: var(--text-muted);
}
.explore-empty {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
  padding: var(--space-4);
}
.explore-empty-title {
  font-size: clamp(22px, 3.2vw, 40px);
  font-weight: 700;
  letter-spacing: 0.5px;
  line-height: 1.15;
  background: linear-gradient(135deg, var(--accent-purple), var(--accent-blue));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 10px rgba(155, 125, 245, 0.25));
}
.explore-empty-sub {
  font-size: var(--font-md);
  color: var(--text-muted);
  letter-spacing: 0.3px;
}
.explore-backoff {
  color: var(--accent-orange, var(--text-muted));
  font-size: var(--font-sm);
}
.explore-history {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
/* Bottom control bar of the composer box: + add-file (left) | model + Send (right) */
.explore-composer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.composer-bar-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.composer-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.composer-add-btn:hover {
  border-color: var(--accent-blue);
  color: var(--accent-blue);
  background: var(--blue-subtle, rgba(96, 165, 250, 0.08));
}
.composer-add-btn svg {
  width: 16px;
  height: 16px;
}
.composer-model {
  font-family: var(--font-mono);
  font-size: var(--font-xs);
  color: var(--text-muted);
  white-space: nowrap;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Explore model picker: looks like the old muted mono label until hovered. */
.composer-model-select {
  font-family: var(--font-mono);
  font-size: var(--font-xs);
  color: var(--text-secondary);
  max-width: 180px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  padding: 2px 4px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s, color 0.15s;
}
.composer-model-select:hover {
  color: var(--text-primary);
  border-color: var(--border-color);
}
.composer-model-select:focus {
  border-color: var(--accent-blue);
}
/* The open dropdown list: match the composer surface with readable text instead
   of the browser's default near-white background. */
.composer-model-select option {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}
/* Live context-size badge: usage of the active model's context window.
   Turns red when the projected payload exceeds the limit (Send is disabled). */
.composer-context {
  font-family: var(--font-mono);
  font-size: var(--font-xs);
  color: var(--text-muted);
  white-space: nowrap;
  cursor: default;
}
.composer-context.over {
  color: var(--accent-red);
  font-weight: 600;
}
/* v10.130: the textarea itself now lives inside <DescriptionEditor> (composer
   variant). This wrapper just gives it flex-fill behavior in the row. The
   textarea's own border, focus ring, sizing, and font come from
   DescriptionEditor.vue so the look matches Task mode's coach composer. */
.explore-input-wrap {
  width: 100%;
  min-width: 0;
}
/* Textarea inside DescriptionEditor needs the same border/background/focus
   ring the old .explore-input had — DescriptionEditor's own `.desc-textarea`
   doesn't carry those, they came from a global `.input-base` class. Apply
   them through :deep() so the visual matches the previous Explore composer
   while the auto-grow / expand-button / IME-safe-Enter all come from
   DescriptionEditor. */
/* The textarea is borderless/transparent inside the composer box — the box
   itself carries the border + focus ring. Keep the Claude sans ~16px/1.5. */
.composer-box :deep(.desc-textarea--composer) {
  padding: var(--space-1) var(--space-2);
  padding-right: 30px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 1rem;
  font-family: var(--font-sans);
  line-height: 1.5;
}
.composer-box :deep(.desc-textarea--composer:focus) {
  outline: none;
  box-shadow: none;
}
.explore-send, .explore-stop {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 var(--space-3);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-base);
  font-weight: 600;
  color: white;
  cursor: pointer;
}
.explore-send { background: var(--accent-blue); }
.explore-send:disabled { opacity: 0.5; cursor: default; }
.explore-stop { background: var(--accent-red); }

/* File-loading composer */
.explore-composer-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5) var(--space-4);
  /* Align the composer under the centered conversation reading column. */
  width: 100%;
  max-width: var(--explore-read-width);
  margin: 0 auto;
  box-sizing: border-box;
}
/* Rounded composer container (textarea + control bar). */
.composer-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.composer-box:focus-within {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px var(--blue-subtle, rgba(96, 165, 250, 0.15));
}
/* Muted reminder beneath the composer (AI can make mistakes…). */
.composer-reminder {
  margin: 0;
  text-align: center;
  font-size: var(--font-xs);
  color: var(--text-muted);
  opacity: 0.75;
}
.hidden-file-input {
  display: none;
}
/* Multi-file chip row: wraps to multiple lines as files accumulate. */
.attach-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-self: flex-start;
}
.attach-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 4px;
  border-radius: var(--radius-sm);
  background: var(--blue-subtle, rgba(96, 165, 250, 0.1));
  border: 1px solid var(--accent-blue);
  color: var(--accent-blue);
  font-size: 11px;
  font-family: var(--font-mono);
  max-width: 240px;
  align-self: flex-start;
}
/* Only the filename truncates — the icon and × stay pinned and clickable. */
.attach-chip-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.attach-chip-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}
.attach-chip-thumb {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 3px;
  object-fit: cover;
}
.attach-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--accent-blue);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background 0.15s;
}
.attach-remove:hover {
  background: rgba(96, 165, 250, 0.2);
}
.chip-fade-enter-active,
.chip-fade-leave-active {
  transition: all 0.2s ease;
}
.chip-fade-enter-from,
.chip-fade-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}
</style>
