<template>
  <section class="explore-chat" :class="{ 'rail-collapsed': railCollapsed }" :aria-label="t('coach.titleExplore')">
    <!-- Left vertical rail: New chat / Chat / History (Claude-style sidebar).
         Collapses to icons via the toggle; state persisted. -->
    <nav class="explore-rail" :aria-label="t('coach.titleExplore')">
      <div class="rail-top">
        <button
          type="button"
          class="rail-iconbtn rail-search"
          :title="t('coach.searchChats')"
          :aria-label="t('coach.searchChats')"
          @click="searchOpen = true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
        <button
          type="button"
          class="rail-iconbtn rail-toggle"
          :title="t('coach.railToggle')"
          :aria-label="t('coach.railToggle')"
          @click="toggleRail"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="9" y1="4" x2="9" y2="20" />
          </svg>
        </button>
      </div>
      <button
        type="button"
        class="rail-item explore-newchat"
        :title="t('coach.exploreNewChat')"
        @click="onNewChat"
      >
        <span class="rail-item-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
        <span class="rail-label">{{ t('coach.exploreNewChat') }}</span>
        <span class="rail-shortcut">{{ t('coach.newChatShortcut') }}</span>
      </button>
      <button
        type="button"
        class="rail-item explore-chats"
        :class="{ active: activeView === 'chats' }"
        :title="t('coach.chatsNav')"
        @click="activeView = 'chats'"
      >
        <span class="rail-item-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7.5 8h9M7.5 11.5h6" />
            <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v8a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V15H5.5A1.5 1.5 0 0 1 4 13.5z" />
          </svg>
        </span>
        <span class="rail-label">{{ t('coach.chatsNav') }}</span>
      </button>
      <!-- Recents: the past Explore chats, newest first. Click to open/continue
           (Claude-style sidebar). Hidden when the rail is collapsed. -->
      <div v-show="!railCollapsed" class="rail-recents">
        <div class="rail-recents-header">{{ t('coach.exploreRecents') }}</div>
        <div class="rail-recents-list">
          <p v-if="recentSessions.length === 0" class="rail-recents-empty">{{ t('coach.exploreNoChats') }}</p>
          <div
            v-for="g in recentSessions"
            :key="g.sessionId"
            class="recent-row"
            :class="{ active: g.sessionId === currentExploreSessionId, 'menu-open': menuOpenId === g.sessionId }"
          >
            <input
              v-if="renamingId === g.sessionId"
              :ref="setRenameRef"
              v-model="renameText"
              class="recent-rename-input"
              :placeholder="firstUserPreview(g.records)"
              @click.stop
              @keyup.enter="saveRename"
              @keyup.esc="cancelRename"
              @blur="saveRename"
            />
            <template v-else>
              <button
                type="button"
                class="recent-item"
                :title="sessionTitle(g)"
                @click="onContinue(g.sessionId)"
              >
                <svg v-if="isStarred(g.sessionId)" class="recent-star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span class="recent-title">{{ sessionTitle(g) }}</span>
              </button>
              <button
                type="button"
                class="recent-more"
                :title="t('coach.chatMore')"
                :aria-label="t('coach.chatMore')"
                @click.stop="openMenu($event, g.sessionId)"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="6" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="18" r="1.6" />
                </svg>
              </button>
            </template>
          </div>
        </div>
      </div>
    </nav>

    <div class="explore-main">
      <!-- Chats page: full list + select-mode bulk actions. -->
      <ChatsPage v-if="activeView === 'chats'" @select="onContinue" @new-chat="onNewChat" />

      <template v-else>
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
             below (+ add-file left | model label + mic + Send right).
             Expand/popout stays inside DescriptionEditor. v10.179 adds mic
             dictation (VoiceControls); conversational voice mode (Phase 2)
             is still intentionally omitted. -->
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
              v-show="!isRecording"
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
              <!-- Claude-style model selector (nested menu + More-models flyout). -->
              <ComposerModelMenu v-show="!isRecording" @select="onModelPicked" />
              <VoiceControls
                :disabled="isLoading"
                @recording="isRecording = $event"
                @text="appendTranscript"
              />
              <button
                v-if="isLoading"
                v-show="!isRecording"
                type="button"
                class="explore-icon-btn explore-stop"
                :title="t('coach.exploreStop')"
                :aria-label="t('coach.exploreStop')"
                @click="$emit('cancel')"
              >
                <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
              <button
                v-else-if="draft.trim()"
                v-show="!isRecording"
                type="button"
                class="explore-icon-btn explore-send"
                :title="t('coach.exploreSend')"
                :aria-label="t('coach.exploreSend')"
                :disabled="ctxUsage.over"
                @click="send"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="6 11 12 5 18 11" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="composer-reminder">
          <span class="composer-disclaimer">{{ t('coach.composerDisclaimer') }}</span>
          <span
            class="composer-ctx"
            :class="'composer-ctx--' + ctxLevel"
            :title="ctxTitle + ' · ' + ctxBadge + ' · ' + ctxUsage.percent + '%'"
          >
            <span class="composer-ctx-label">{{ ctxLevelLabel }}</span>
            <svg class="ctx-ring" viewBox="0 0 20 20" aria-hidden="true">
              <circle class="ctx-ring-track" cx="10" cy="10" r="7" fill="none" stroke-width="2.5" />
              <circle
                class="ctx-ring-fill" cx="10" cy="10" r="7" fill="none" stroke-width="2.5"
                stroke-linecap="round" transform="rotate(-90 10 10)"
                :stroke-dasharray="ctxRingCircumference"
                :stroke-dashoffset="ctxRingOffset"
              />
            </svg>
          </span>
        </div>
      </div>
      </template>
    </div>
  </section>

  <!-- Per-chat ⋯ menu. Teleported to <body> + positioned at the button so the
       rail's overflow can't clip it; an outside-pointer listener (which ignores
       the ⋯ buttons) closes it, so a single click reliably opens/switches. -->
  <Teleport to="body">
      <div v-if="menuOpenId" class="recent-menu" :style="{ top: menuPos.y + 'px', left: menuPos.x + 'px' }">
        <button type="button" class="recent-menu-item" @click="onStar(menuOpenId)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {{ isStarred(menuOpenId) ? t('coach.chatUnstar') : t('coach.chatStar') }}
        </button>
        <button type="button" class="recent-menu-item" @click="startRename(menuOpenId)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
          {{ t('coach.chatRename') }}
        </button>
        <button type="button" class="recent-menu-item recent-menu-item--disabled" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          {{ t('coach.chatAddToProject') }}
          <span class="recent-menu-caret">›</span>
        </button>
        <button type="button" class="recent-menu-item recent-menu-item--danger" @click="onDelete(menuOpenId)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          {{ t('coach.chatDelete') }}
        </button>
      </div>
  </Teleport>

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

  <!-- Claude-style chat search (command palette), opened from the rail magnifier. -->
  <ChatSearchModal v-model:open="searchOpen" :items="searchItems" :active-id="currentExploreSessionId" @select="onSearchSelect" />
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from '@/i18n'
import ChatBubble from './ChatBubble.vue'
import DescriptionEditor from '@/components/form/DescriptionEditor.vue'
import ComposerPopout from '@/components/form/ComposerPopout.vue'
import VoiceControls from './VoiceControls.vue'
import ComposerModelMenu from './ComposerModelMenu.vue'
import ChatSearchModal from './ChatSearchModal.vue'
import ChatsPage from './ChatsPage.vue'
import { useAttachment, inlineAttachments, type AttachError, ATTACH_ACCEPT_HINT, IMAGE_ACCEPT_HINT } from '@/composables/useAttachment'
import { useToast } from '@/composables/useToast'
import { exploreModel, setExploreModel, getContextLimitTokens, isVisionModel } from '@/config/llm'
import { getResponseFormat } from '@/config/skills'
import { contextUsage, formatTokens } from '@/utils/contextCalculator'
import {
  getSessionGroups, recordsForChannel, getSessionName, setSessionName,
  currentExploreSessionId, isSessionStarred, toggleSessionStar, deleteSession,
  type SessionGroup,
} from '@/composables/useCoachHistory'
import type { ChatMessage, LLMChatMessage, CoachHistoryRecord } from '@/types/api'

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
  (e: 'continue-session', sessionId: string): void
  (e: 'regenerate', id: string): void
  (e: 'edit-message', payload: { id: string; content: string }): void
}>()

// Left rail collapse state (persisted). Labels hide → icon-only when collapsed.
const LS_RAIL_KEY = 'explore_rail_collapsed'
const railCollapsed = ref<boolean>(localStorage.getItem(LS_RAIL_KEY) === '1')
function toggleRail() {
  railCollapsed.value = !railCollapsed.value
  localStorage.setItem(LS_RAIL_KEY, railCollapsed.value ? '1' : '0')
}

// ── Recents: past Explore chats as a clickable sidebar list ───────────────────
// Newest-first, with starred (pinned) chats floated to the top.
const recentSessions = computed<SessionGroup[]>(() => {
  const groups = getSessionGroups(recordsForChannel('explore')).grouped
  return [...groups].sort((a, b) => {
    const sa = isSessionStarred(a.sessionId) ? 1 : 0
    const sb = isSessionStarred(b.sessionId) ? 1 : 0
    if (sa !== sb) return sb - sa
    return b.lastTimestamp - a.lastTimestamp
  })
})
function firstUserPreview(records: CoachHistoryRecord[]): string {
  const first = records.find(r => r.role === 'user')
  const text = first?.content || '...'
  return text.length <= 60 ? text : text.slice(0, 60) + '...'
}
// Custom name when set, else the first user message preview (mirrors CoachHistoryTab).
function sessionTitle(group: SessionGroup): string {
  return getSessionName(group.sessionId) ?? firstUserPreview(group.records)
}
function isStarred(id: string): boolean {
  return isSessionStarred(id)
}

// Explore main-area view: the conversation, or the (placeholder) Chats page.
const activeView = ref<'chat' | 'chats'>('chat')

// ── Chat search (command palette) ─────────────────────────────────────────────
const searchOpen = ref(false)
// Newest-first searchable items; haystack matches the title AND message text.
const searchItems = computed(() =>
  [...recentSessions.value]
    .sort((a, b) => b.lastTimestamp - a.lastTimestamp)
    .map(g => {
      const title = sessionTitle(g)
      return {
        sessionId: g.sessionId,
        title,
        lastTimestamp: g.lastTimestamp,
        haystack: (title + ' ' + g.records.map(r => r.content).join(' ')).toLowerCase(),
      }
    })
)
function onSearchSelect(sessionId: string) {
  searchOpen.value = false
  onContinue(sessionId)
}

function onGlobalKeydown(e: KeyboardEvent) {
  if (menuOpenId.value && e.key === 'Escape') { closeMenu(); return }
  // Ctrl+Shift+O → new chat (matches the rail's New-chat shortcut hint).
  if (e.ctrlKey && e.shiftKey && (e.key === 'o' || e.key === 'O')) {
    e.preventDefault()
    onNewChat()
  }
}

// ── Per-chat ⋯ menu (Star / Rename / Add to project [future] / Delete) ────────
const menuOpenId = ref<string | null>(null)
const menuPos = ref({ x: 0, y: 0 })
const MENU_W = 180
const MENU_H = 168 // approx 4 items; only used to decide flip direction

function openMenu(e: MouseEvent, sessionId: string) {
  const btn = e.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  // Anchor under the button, but keep the menu fully on-screen: clamp x, and flip
  // above the button when it would overflow the viewport bottom. Teleported to
  // <body> so the rail's overflow can't clip it.
  const x = Math.min(rect.left, window.innerWidth - MENU_W - 8)
  const y = rect.bottom + MENU_H > window.innerHeight ? rect.top - MENU_H : rect.bottom + 4
  menuPos.value = { x: Math.max(8, x), y: Math.max(8, y) }
  menuOpenId.value = menuOpenId.value === sessionId ? null : sessionId
}
function closeMenu() {
  menuOpenId.value = null
}

// Close on any outside pointer-down — but ignore the ⋯ buttons so clicking
// another chat's ⋯ switches in one click (its own @click runs openMenu) and
// clicking the same ⋯ toggles shut via openMenu, rather than this listener
// eating the click (the v10.247 full-screen-backdrop bug).
function onDocPointerDown(e: PointerEvent) {
  const t = e.target as HTMLElement
  if (t.closest('.recent-menu') || t.closest('.recent-more')) return
  closeMenu()
}
watch(menuOpenId, (id) => {
  if (id) window.addEventListener('pointerdown', onDocPointerDown)
  else window.removeEventListener('pointerdown', onDocPointerDown)
})

function onStar(sessionId: string) {
  toggleSessionStar(sessionId)
  closeMenu()
}
function onDelete(sessionId: string) {
  const wasActive = sessionId === currentExploreSessionId.value
  deleteSession(sessionId)
  closeMenu()
  // Deleting the open chat → drop back to a fresh conversation.
  if (wasActive) emit('new-chat')
}

// Inline rename (mirrors CoachHistoryTab's rename UX).
const renamingId = ref<string | null>(null)
const renameText = ref('')
const renameInputEl = ref<HTMLInputElement | null>(null)
function setRenameRef(el: unknown) {
  if (el) renameInputEl.value = el as HTMLInputElement
}
function startRename(sessionId: string) {
  closeMenu()
  renamingId.value = sessionId
  // Pre-fill with the current effective title (custom name, else the auto
  // first-message preview) so the user edits from what's shown, not a blank.
  const g = recentSessions.value.find(x => x.sessionId === sessionId)
  renameText.value = getSessionName(sessionId) ?? (g ? firstUserPreview(g.records) : '')
  nextTick(() => {
    renameInputEl.value?.focus()
    renameInputEl.value?.select()
  })
}
function saveRename() {
  if (renamingId.value === null) return
  setSessionName(renamingId.value, renameText.value)
  renamingId.value = null
  renameText.value = ''
}
function cancelRename() {
  renamingId.value = null
  renameText.value = ''
}
const draft = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
// v10.130: matches Task-mode coach composer UX — clicking the ⤢ on the inline
// composer opens a floating draggable popout sharing the same draft model.
const isPopoutOpen = ref(false)
// v10.179: while voice dictation records, the bar shows only the waveform and
// ✕/✓ controls (other bar buttons v-show'd out, matching Claude's UX).
const isRecording = ref(false)

/** Dictated text is APPENDED to the draft for review — never auto-sent. */
function appendTranscript(text: string) {
  const existing = draft.value
  draft.value = existing.trim() ? `${existing.replace(/\s*$/, '')} ${text}` : text
}

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
  window.addEventListener('keydown', onGlobalKeydown)
  nextTick(updateThumb)
})
onBeforeUnmount(() => {
  resizeObs?.disconnect()
  window.removeEventListener('pointermove', thumbMove)
  window.removeEventListener('pointerup', thumbUp)
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('pointerdown', onDocPointerDown)
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

// Context-usage ring: Low (<50%) / Middle (50–85%) / High (≥85% or over),
// each its own colour. The ring arc fills proportional to the usage percent.
const ctxLevel = computed<'low' | 'middle' | 'high'>(() => {
  const p = ctxUsage.value.percent
  if (ctxUsage.value.over || p >= 85) return 'high'
  if (p >= 50) return 'middle'
  return 'low'
})
const ctxLevelLabel = computed(() => t('coach.ctx' + ctxLevel.value.charAt(0).toUpperCase() + ctxLevel.value.slice(1)))
const ctxRingCircumference = 2 * Math.PI * 7
const ctxRingOffset = computed(() => ctxRingCircumference * (1 - Math.min(ctxUsage.value.percent, 100) / 100))

// Model picked from the Claude-style ComposerModelMenu.
function onModelPicked(m: string) {
  setExploreModel(m)
  // Switching to a text model: drop any already-attached images (text files kept).
  if (!isVisionModel(m)) {
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
  activeView.value = 'chat'
  emit('send', text)
  draft.value = ''
  stick.value = true
}

function onNewChat() {
  activeView.value = 'chat'
  draft.value = ''
  stick.value = true
  emit('new-chat')
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = 0
    updateThumb()
  })
}
function onContinue(sessionId: string) {
  activeView.value = 'chat'
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
  width: 280px;
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
/* Top row: search (left) + sidebar toggle (right). Stacks when collapsed. */
.rail-top {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-1);
  margin-bottom: var(--space-1);
}
.rail-collapsed .rail-top {
  flex-direction: column;
  align-items: center;
}
.rail-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.rail-iconbtn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.rail-iconbtn svg {
  width: 17px;
  height: 17px;
}
.rail-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 32px;
  padding: 0 var(--space-3);
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
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
  color: var(--text-primary);
  background: var(--bg-tertiary);
}
/* Circular icon badge (Claude-style); intensifies on row hover/active. */
.rail-item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  transition: background 0.15s, color 0.15s;
}
.rail-item:hover .rail-item-icon,
.rail-item.active .rail-item-icon {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
.rail-item-icon svg {
  width: 15px;
  height: 15px;
}
/* Keyboard-shortcut hint on New chat — revealed on hover (Claude-style). */
.rail-shortcut {
  margin-left: auto;
  flex-shrink: 0;
  font-size: var(--font-xs, 11px);
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 0.15s;
}
.rail-item:hover .rail-shortcut {
  opacity: 1;
}
.rail-collapsed .rail-item {
  justify-content: center;
}
.rail-collapsed .rail-label,
.rail-collapsed .rail-shortcut {
  display: none;
}
/* Recents: scrollable list of past chats under New chat. */
.rail-recents {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  margin-top: var(--space-2);
}
.rail-recents-header {
  padding: var(--space-1) var(--space-3);
  font-family: var(--font-sans);
  font-size: var(--font-xs, 12px);
  font-weight: 500;
  color: var(--text-muted);
}
.rail-recents-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
  scrollbar-width: thin;
}
.rail-recents-empty {
  padding: var(--space-2);
  font-size: var(--font-sm);
  color: var(--text-muted);
  opacity: 0.7;
}
/* A recents row = clickable title (flex) + a ⋯ button revealed on hover/active.
   Matches the Claude sidebar: 32px rows, 9px radius, 14px titles. */
.recent-row {
  position: relative;
  display: flex;
  align-items: center;
  border-radius: 9px;
  color: var(--text-secondary);
  transition: background 0.15s, color 0.15s;
}
.recent-row:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.recent-row.active {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}
.recent-item {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 var(--space-3);
  padding-right: 30px;
  border: none;
  background: transparent;
  color: inherit;
  font-family: var(--font-sans);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}
.recent-star {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--accent-orange, #f0a020);
}
.recent-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* ⋯ button: removed from layout at rest (display:none) so it never overlays/steals
   row clicks; shown when the row is hovered, focused, active, or its menu is open
   (mirrors Claude's `hidden group-hover:flex` + always-on for the current chat). */
.recent-more {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.recent-row:hover .recent-more,
.recent-row:focus-within .recent-more,
.recent-row.active .recent-more,
.recent-row.menu-open .recent-more {
  display: inline-flex;
}
.recent-more:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
.recent-more svg {
  width: 16px;
  height: 16px;
  /* Make the whole button a single click target — without this, clicking the
     icon makes the <svg>/<circle> the event.target and the button's @click can
     miss, leaving the icon a dead zone (only the padding around it worked). */
  pointer-events: none;
}
.recent-rename-input {
  flex: 1;
  min-width: 0;
  margin: 1px 0;
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-sm);
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-blue);
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
}
/* Teleported ⋯ menu (Star / Rename / Add to project / Delete). */
.recent-menu {
  position: fixed;
  z-index: 2000;
  min-width: 168px;
  padding: var(--space-1);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  box-shadow: var(--shadow-panel, 0 8px 24px rgba(0, 0, 0, 0.3));
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.recent-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-sm);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.recent-menu-item:hover {
  background: var(--bg-tertiary);
}
.recent-menu-item svg {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
.recent-menu-caret {
  margin-left: auto;
  color: var(--text-muted);
}
.recent-menu-item--disabled {
  color: var(--text-muted);
  cursor: not-allowed;
  opacity: 0.6;
}
.recent-menu-item--disabled:hover {
  background: transparent;
}
.recent-menu-item--danger {
  color: var(--accent-red);
}
.recent-menu-item--danger:hover {
  background: var(--red-subtle, rgba(248, 81, 73, 0.12));
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
/* + add-file: borderless ghost button (Claude-style). */
.composer-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.composer-add-btn:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}
.composer-add-btn svg {
  width: 18px;
  height: 18px;
}

/* Model selector styles now live in ComposerModelMenu.vue (v10.215). */
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
  line-height: 1.4;
}
.composer-box :deep(.desc-textarea--composer:focus) {
  outline: none;
  box-shadow: none;
}
/* Send / Stop — icon-only rounded squares. Send appears only when there's text. */
.explore-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-md);
  color: white;
  cursor: pointer;
  transition: filter 0.15s, box-shadow 0.15s, opacity 0.15s;
}
.explore-icon-btn svg { width: 17px; height: 17px; }
.explore-send { background: var(--accent-blue); }
.explore-send:hover:not(:disabled) {
  filter: brightness(1.08);
  box-shadow: 0 0 12px 2px rgba(107, 170, 224, 0.45);
}
.explore-send:disabled { opacity: 0.45; cursor: default; }
.explore-stop { background: var(--accent-red); }
.explore-stop:hover { filter: brightness(1.08); }

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
/* Footer row beneath the composer: disclaimer centered + context ring right. */
.composer-reminder {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 18px;
}
.composer-disclaimer {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--text-muted);
  opacity: 0.75;
  text-align: center;
}
/* Context-usage ring + Low/Middle/High label (right-aligned). */
.composer-ctx {
  position: absolute;
  right: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  cursor: default;
}
.composer-ctx-label { letter-spacing: 0.2px; }
.ctx-ring { width: 16px; height: 16px; }
.ctx-ring-track { stroke: var(--border-color); }
.ctx-ring-fill { transition: stroke-dashoffset 0.3s ease, stroke 0.2s ease; }
.composer-ctx--low { color: var(--accent-blue); }
.composer-ctx--low .ctx-ring-fill { stroke: var(--accent-blue); }
.composer-ctx--middle { color: var(--accent-orange); }
.composer-ctx--middle .ctx-ring-fill { stroke: var(--accent-orange); }
.composer-ctx--high { color: var(--accent-red); }
.composer-ctx--high .ctx-ring-fill { stroke: var(--accent-red); }
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
