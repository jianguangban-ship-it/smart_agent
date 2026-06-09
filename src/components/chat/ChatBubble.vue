<template>
  <div class="chat-msg" :class="[`chat-${message.role}`, `layout-${layout}`]">
    <!-- Avatar column (bubble layout only — stacked is avatar-less, pure-Claude) -->
    <div v-if="layout === 'bubble'" class="msg-avatar-col">
      <img
        v-if="message.role === 'assistant'"
        :src="agentAvatar"
        class="msg-avatar"
        :class="{ 'avatar-thinking': message.isStreaming }"
        alt="Coach"
      />
      <div v-else class="msg-avatar-user">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
        </svg>
      </div>
  </div>

    <!-- Bubble -->
    <div class="msg-bubble" :class="[`bubble-${message.role}`]">
      <!-- Explore (stacked) goes pure-Claude: the role label is sr-only so the
           speaker is still announced to screen readers but carries no visual
           chrome — alignment + serif/bubble convey who's talking. Task (bubble)
           keeps the visible label + avatar. -->
      <span class="msg-role-label" :class="[`role-${message.role}`, { 'sr-only': layout === 'stacked' }]">
        {{ message.role === 'assistant' ? t('coach.agentLabel') : t('coach.userLabel') }}
        <span class="msg-time">{{ timeLabel }}</span>
        <span v-if="hashId" class="msg-hash">#{{ hashId }}</span>
      </span>
      <!-- Agent: formatted markdown -->
      <template v-if="message.role === 'assistant'">
        <!-- L3 (v10.134): tool events the agent invoked during this turn,
             rendered as collapsible chips above the response text. Only
             appear when the Explore-mode brokered path returned tool
             activity; Task-mode messages never have toolEvents. -->
        <div v-if="message.toolEvents && message.toolEvents.length > 0" class="tool-events">
          <div
            v-for="evt in message.toolEvents"
            :key="evt.id"
            class="tool-event"
            :class="[`tool-event--${evt.status}`, { 'tool-event--expanded': expanded.has(evt.id) }]"
          >
            <button
              type="button"
              class="tool-event-header"
              :aria-expanded="expanded.has(evt.id)"
              :disabled="evt.status === 'requested' || !evt.contentPreview"
              @click="toggleExpanded(evt.id)"
            >
              <span class="tool-event-status">
                <span v-if="evt.status === 'requested'" class="tool-event-spinner" aria-hidden="true" />
                <span v-else class="tool-event-check" aria-hidden="true">✓</span>
              </span>
              <span class="tool-event-label">
                <span v-if="evt.status === 'requested'">{{ t('coach.toolCalling').replace('{tool}', evt.tool) }}</span>
                <span v-else>{{ t('coach.toolDone').replace('{tool}', evt.tool) }}</span>
              </span>
              <span v-if="evt.contentLen" class="tool-event-len">{{ formatBytes(evt.contentLen) }}</span>
              <span
                v-if="evt.status === 'received' && evt.contentPreview"
                class="tool-event-toggle"
                aria-hidden="true"
              >{{ expanded.has(evt.id) ? '−' : '+' }}</span>
            </button>
            <div
              v-if="expanded.has(evt.id) && evt.contentPreview"
              class="tool-event-body"
            >{{ evt.contentPreview }}<span v-if="evt.contentLen && evt.contentLen > evt.contentPreview.length" class="tool-event-truncated">…</span></div>
          </div>
        </div>

        <!-- Dynamic "thinking" avatar: a pulsing brand-gradient orb shown in
             Explore (stacked) while the assistant reply is being generated and
             no token has arrived yet. Fades out the moment streaming text lands
             and the .coach-response below renders it. Gated on layout=stacked so
             Task mode (which has its own bouncing-dots indicator) is untouched. -->
        <Transition name="orb-fade">
          <div
            v-if="layout === 'stacked' && message.isStreaming && !message.content"
            class="thinking-orb-row"
          >
            <span class="thinking-orb" aria-hidden="true" />
            <span class="thinking-orb-label">{{ t('coach.typing') }}</span>
          </div>
        </Transition>
        <!-- "Thought for Xs" elapsed header (Explore/stacked). Shown once the
             first token has landed (firstTokenMs set) — mirrors Claude's
             time-to-first-token label above the answer. -->
        <div
          v-if="layout === 'stacked' && message.firstTokenMs != null"
          class="msg-elapsed"
        >{{ t('coach.thoughtFor').replace('{s}', elapsedLabel) }}</div>
        <div
          ref="responseEl"
          class="coach-response"
          v-html="formattedContent"
        />
        <div v-if="showMsgActions" class="msg-actions">
          <button type="button" class="msg-action-btn" @click="copyResponse">
            {{ t('coach.copyResponse') }}
          </button>
          <button type="button" class="msg-action-btn" @click="downloadMd">
            {{ t('coach.downloadMd') }}
          </button>
        </div>
      </template>
      <!-- User: attached files (clickable cards) + plain text -->
      <template v-else>
        <div v-if="message.attachments && message.attachments.length > 0" class="attach-cards">
          <template v-for="a in message.attachments" :key="a.name">
            <!-- Image with live data URL → thumbnail -->
            <img
              v-if="a.kind === 'image' && a.content"
              class="attach-image"
              :src="a.content"
              :alt="a.name"
              :title="a.name"
            />
            <!-- Image whose base64 was stripped on reload → placeholder -->
            <div v-else-if="a.kind === 'image'" class="attach-card attach-card--placeholder">
              <span class="attach-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                </svg>
              </span>
              <span class="attach-card-info">
                <span class="attach-card-name">{{ a.name }}</span>
                <span class="attach-card-size">{{ t('coach.imageNotRetained') }}</span>
              </span>
            </div>
            <!-- Text file → downloadable card -->
            <button
              v-else
              type="button"
              class="attach-card"
              :title="t('coach.attachmentDownload')"
              @click="downloadAttachment(a)"
            >
              <span class="attach-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
                </svg>
              </span>
              <span class="attach-card-info">
                <span class="attach-card-name">{{ a.name }}</span>
                <span class="attach-card-size">{{ formatBytes(a.size) }}</span>
              </span>
              <span class="attach-card-action" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </span>
            </button>
          </template>
        </div>
        <!-- Inline edit (Explore/stacked): textarea + Save/Cancel replaces the
             static text. Saving truncates later turns and regenerates upstream. -->
        <div v-if="editing" class="msg-user-edit">
          <textarea v-model="editText" class="msg-user-edit-area" rows="3" />
          <div class="msg-user-edit-actions">
            <button type="button" class="msg-action-btn" @click="saveEdit">{{ t('coach.editSave') }}</button>
            <button type="button" class="msg-action-btn" @click="cancelEdit">{{ t('coach.editCancel') }}</button>
          </div>
        </div>
        <div v-else-if="message.content" class="msg-user-text">
          {{ message.content }}
        </div>
        <!-- Hover meta-row: date + Retry / Edit / Copy (Explore/stacked only). -->
        <div v-if="layout === 'stacked' && !editing && message.content" class="msg-user-meta">
          <span class="msg-user-date">{{ dateLabel }}</span>
          <button type="button" class="msg-icon-btn" :title="t('coach.msgRetry')" :aria-label="t('coach.msgRetry')" @click="emit('retry', message.id)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button type="button" class="msg-icon-btn" :title="t('coach.msgEdit')" :aria-label="t('coach.msgEdit')" @click="startEdit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button type="button" class="msg-icon-btn" :title="t('coach.msgCopy')" :aria-label="t('coach.msgCopy')" @click="copyUser">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { ChatMessage, Attachment } from '@/types/api'
import { useI18n } from '@/i18n'
import { formatCoachResponse } from '@/utils/formatCoach'
import { useToast } from '@/composables/useToast'
import { downloadFile } from '@/utils/exportFormats'
import { copyText } from '@/utils/clipboard'
import {
  enhanceCodeBlocks,
  enhanceFileArtifacts,
  handleArtifactClick,
  type ArtifactMeta,
} from '@/utils/codeArtifact'
import { useArtifact } from '@/composables/useArtifact'

const { t, isZh } = useI18n()
const { addToast } = useToast()
const { open: openArtifact } = useArtifact()
const agentAvatar = '/agent_avy.png'

const props = withDefaults(defineProps<{
  message: ChatMessage
  hashId?: string
  /** 'bubble' = side avatar, left/right (Task). 'stacked' = full-width turns (Explore). */
  layout?: 'bubble' | 'stacked'
}>(), { layout: 'bubble' })

// Explore-mode user-message actions: Retry regenerates the reply from this turn,
// Edit re-runs with modified text (both truncate everything after this message).
const emit = defineEmits<{
  (e: 'retry', id: string): void
  (e: 'edit', payload: { id: string; content: string }): void
}>()

// Inline-edit state for the user bubble (Explore/stacked only).
const editing = ref(false)
const editText = ref('')
function startEdit() {
  editText.value = props.message.content
  editing.value = true
}
function cancelEdit() {
  editing.value = false
}
function saveEdit() {
  const next = editText.value.trim()
  if (!next || next === props.message.content) { editing.value = false; return }
  emit('edit', { id: props.message.id, content: next })
  editing.value = false
}
async function copyUser() {
  const ok = await copyText(props.message.content)
  addToast(ok ? 'success' : 'error', t(ok ? 'toast.copied' : 'toast.copyFailed'), 2000)
}

// RAF-throttled formatting for streaming messages
const formattedContent = ref('')
const responseEl = ref<HTMLElement | null>(null)
let _rafId: number | null = null

// Re-inject the Copy/Download toolbar after each v-html render (v-html wipes
// the subtree, so this runs against fresh DOM every time). In the Explore
// (stacked) layout, long code blocks collapse into a download card.
async function enhanceArtifacts() {
  await nextTick()
  const labels = {
    copy: t('coach.copyCode'),
    download: t('coach.downloadCode'),
    open: t('coach.artifactView'),
    lines: (n: number) => t('coach.artifactLines').replace('{n}', String(n)),
    generating: t('coach.fileGenerating'),
  }
  enhanceCodeBlocks(responseEl.value, { collapseLong: props.layout === 'stacked', labels })
  // File artifacts (`:::file` download chips) render in both layouts.
  enhanceFileArtifacts(responseEl.value, { labels })
}

watch(
  () => props.message.content,
  (val) => {
    // Before the first token lands there's no content to format. Keep the
    // rendered area empty (the stacked "thinking orb" is the empty-state cue)
    // instead of letting formatCoachResponse emit its "No content available"
    // placeholder. The .coach-response element itself stays in the DOM so its
    // onMounted click listener remains attached.
    if (!val) {
      formattedContent.value = ''
      return
    }
    if (!props.message.isStreaming) {
      formattedContent.value = formatCoachResponse({ message: val }, false)
      enhanceArtifacts()
      return
    }
    if (_rafId !== null) return
    _rafId = requestAnimationFrame(() => {
      formattedContent.value = formatCoachResponse({ message: props.message.content }, true)
      _rafId = null
      enhanceArtifacts()
    })
  },
  { immediate: true }
)

watch(
  () => props.message.isStreaming,
  (streaming) => {
    if (!streaming && props.message.content) {
      // Final render with streaming=false to ensure complete math is shown
      formattedContent.value = formatCoachResponse({ message: props.message.content }, false)
      enhanceArtifacts()
    }
  }
)

async function onCopy(text: string) {
  const ok = await copyText(text)
  addToast(ok ? 'success' : 'error', t(ok ? 'toast.copied' : 'toast.copyFailed'), 2000)
}
function onDownload(text: string, meta: ArtifactMeta) {
  downloadFile(text, meta.filename, meta.mime)
  addToast('success', t('toast.downloaded'), 2000)
}
function onOpen(text: string, meta: ArtifactMeta) {
  openArtifact({
    code: text,
    filename: meta.filename,
    mime: meta.mime,
    lang: meta.langToken || 'text',
    label: meta.lang,
    lines: meta.lines || 0,
  })
}
function onResponseClick(e: Event) {
  handleArtifactClick(e, { onCopy, onDownload, onOpen })
}

const showMsgActions = computed(() =>
  props.message.role === 'assistant' &&
  !props.message.isStreaming &&
  !!props.message.content
)
async function copyResponse() {
  const ok = await copyText(props.message.content)
  addToast(ok ? 'success' : 'error', t(ok ? 'toast.copied' : 'toast.copyFailed'), 2000)
}
function downloadMd() {
  const id = props.hashId || props.message.hashId || String(props.message.timestamp)
  downloadFile(props.message.content, `response-${id}.md`, 'text/markdown')
  addToast('success', t('toast.downloaded'), 2000)
}

onMounted(() => {
  responseEl.value?.addEventListener('click', onResponseClick)
})

onUnmounted(() => {
  if (_rafId !== null) cancelAnimationFrame(_rafId)
  responseEl.value?.removeEventListener('click', onResponseClick)
})

const timeLabel = computed(() => {
  const d = new Date(props.message.timestamp)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

// Short month/day for the user meta-row; driven by the app language toggle
// (isZh), not the OS locale — pass an explicit 'en-US' so English mode never
// falls back to a Chinese-formatted date on a zh-locale machine.
const dateLabel = computed(() => {
  const d = new Date(props.message.timestamp)
  return d.toLocaleDateString(isZh.value ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })
})

// "Thought for Xs" value — time-to-first-token captured in useLLM.
const elapsedLabel = computed(() => {
  const ms = props.message.firstTokenMs
  if (ms == null) return ''
  if (ms < 1000) return '<1s'
  const s = ms / 1000
  return `${s.toFixed(s < 10 ? 1 : 0)}s`
})

// L3 (v10.134): tool-event chips can be expanded to reveal their content
// preview. Per-message Set tracking by event id; no persistence — the
// expanded state resets on page reload, which is intentional (history
// reload starts collapsed for tidiness).
const expanded = ref<Set<string>>(new Set())
function toggleExpanded(id: string): void {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
  // Force reactivity since Set mutations aren't tracked
  expanded.value = new Set(expanded.value)
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// Download a user-attached file's original content (cards render from the
// persisted `attachments`, so this works on reloaded history too).
function downloadAttachment(a: Attachment) {
  downloadFile(a.content, a.name, 'text/plain')
  addToast('success', t('toast.downloaded'), 2000)
}
</script>

<style scoped>
.chat-msg {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

/* User messages: avatar on the right */
.chat-user {
  flex-direction: row-reverse;
}

/* Avatar column */
.msg-avatar-col {
  flex-shrink: 0;
}
.msg-avatar {
  width: var(--avatar-size);
  height: var(--avatar-size);
  border-radius: 50%;
  object-fit: cover;
  background-color: var(--bg-tertiary);
}
.msg-avatar-user {
  width: var(--avatar-size);
  height: var(--avatar-size);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--accent-blue);
  color: white;
}
.msg-avatar-user svg {
  width: var(--icon-md);
  height: var(--icon-md);
}

/* Breathing halo for streaming */
.avatar-thinking {
  animation: breathe 2s ease-in-out infinite;
}
@keyframes breathe {
  0%, 100% { box-shadow: 0 0 0 0 var(--green-glow); }
  50% { box-shadow: 0 0 8px 4px var(--green-subtle); }
}

/* Bubble */
.msg-bubble {
  max-width: 85%;
  min-width: 60px;
  padding: var(--space-2) var(--space-3);
  position: relative;
}

/* Agent bubble: transparent, no card */
.bubble-assistant {
  background: transparent;
}

/* User bubble: transparent */
.bubble-user {
  background: transparent;
}

/* Role label */
.msg-role-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-sm);
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-bottom: var(--space-1);
}
.role-assistant {
  color: var(--accent-blue);
}
.role-user {
  color: var(--text-muted);
}
.msg-time {
  font-size: var(--font-xs);
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  opacity: 0.6;
}
.msg-hash {
  font-size: var(--font-xs);
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  opacity: 0.4;
  font-family: var(--font-mono);
}

/* Content */
.msg-user-text {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary);
  font-size: var(--font-md);
  line-height: 1.55;
  max-height: 200px;
  overflow-y: auto;
}

/* "Thought for Xs" elapsed header above the assistant answer (stacked). */
.msg-elapsed {
  font-size: var(--font-xs);
  color: var(--text-muted);
  opacity: 0.7;
  margin-bottom: var(--space-1);
}

/* User meta-row: date + Retry/Edit/Copy icon buttons. Hidden until the message
   row is hovered or one of its controls is focused (Claude-style reveal). */
.msg-user-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-1);
  margin-top: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.chat-msg:hover .msg-user-meta,
.msg-user-meta:focus-within {
  opacity: 1;
}
.msg-user-date {
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin-right: var(--space-1);
}
.msg-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.msg-icon-btn:hover {
  color: var(--accent-blue);
  background: var(--bg-tertiary);
}
.msg-icon-btn svg {
  width: 15px;
  height: 15px;
}

/* Inline edit area for a user message. */
.msg-user-edit {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.msg-user-edit-area {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  padding: var(--space-2);
  border: 1px solid var(--accent-blue);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--font-md);
  line-height: 1.55;
}
.msg-user-edit-area:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--blue-subtle, rgba(96, 165, 250, 0.15));
}
.msg-user-edit-actions {
  display: flex;
  gap: var(--space-2);
  align-self: flex-end;
}

/* User attachments rendered as clickable file cards (download on click).
   Models the .ca-card pattern from coach-response.css. */
.attach-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-2);
}
/* Image attachment thumbnail (multi-modal). */
.attach-image {
  max-width: 220px;
  max-height: 220px;
  width: auto;
  height: auto;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  object-fit: contain;
  display: block;
}
.chat-user.layout-stacked .attach-image { margin-left: auto; }
.attach-card--placeholder { cursor: default; opacity: 0.75; }
.attach-card {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  max-width: 320px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}
.attach-card:hover {
  border-color: var(--accent-blue);
  background: var(--bg-tertiary);
}
.attach-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  color: var(--accent-blue);
}
.attach-card-icon svg { width: 16px; height: 16px; }
.attach-card-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.attach-card-name {
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.attach-card-size {
  font-size: var(--font-xs);
  color: var(--text-muted);
}
.attach-card-action {
  display: flex;
  align-items: center;
  color: var(--text-muted);
  flex-shrink: 0;
}
.attach-card-action svg { width: 15px; height: 15px; }
.attach-card:hover .attach-card-action { color: var(--accent-blue); }
/* In Explore (stacked) the user turn is right-aligned, so hug the cards right. */
.chat-user.layout-stacked .attach-cards {
  align-items: flex-end;
}

/* Message-level actions (markdown-as-prose: copy / download .md) */
.msg-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
.msg-action-btn {
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
.msg-action-btn:hover {
  color: var(--accent-blue);
  border-color: var(--accent-blue);
}

/* ── Stacked layout (Explore): full-width vertical turns ───────────────── */
.chat-msg.layout-stacked {
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-1);
  margin-bottom: var(--space-4);
  /* Center the conversation in a Claude-style reading column. */
  width: 100%;
  max-width: var(--explore-read-width);
  margin-left: auto;
  margin-right: auto;
}
/* User turns in Explore stay sans (Claude renders user messages in sans, coach
   replies in serif) at the same ~16px/1.6 reading rhythm as the serif prose.
   The user message is a right-aligned, tinted rounded bubble (Claude's
   `data-user-message-bubble`): bg-tertiary ≈ Claude's bg-bg-300, radius-lg =
   rounded-xl. inline-block + max-width:85% hugs short text and caps long text;
   text-align:left keeps the wrapped text reading normally while the parent's
   text-align:right (below) positions the bubble on the right edge of the
   centered reading column. */
.layout-stacked .msg-user-text {
  font-family: var(--font-sans);
  font-size: 1rem;
  line-height: 1.6;
  display: inline-block;
  text-align: left;
  max-width: 85%;
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  padding: var(--space-2) var(--space-3);
}

/* Explore user turns: AI-left / user-right (Claude layout). Only the user side
   moves — the assistant turn stays left/full-width/serif. Gated on
   `.chat-user.layout-stacked` so Task-mode bubble layout is untouched. The
   role-label header is sr-only in stacked (v10.140), so only the bubble moves. */
.chat-user.layout-stacked .msg-bubble {
  text-align: right;
}

/* Dynamic "thinking" avatar (Explore): a pulsing purple→blue brand-gradient orb
   + "Thinking…" shown while the AI reply is being generated, before the first
   token. Replaced by the streaming serif response once content arrives. */
.thinking-orb-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}
.thinking-orb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-purple), var(--accent-blue));
  animation: orbBreathe 1.6s ease-in-out infinite;
}
.thinking-orb-label {
  font-family: var(--font-sans);
  font-size: var(--font-sm);
  color: var(--text-muted);
  letter-spacing: 0.3px;
}
@keyframes orbBreathe {
  0%, 100% {
    transform: scale(0.85);
    opacity: 0.85;
    box-shadow: 0 0 6px 1px rgba(155, 125, 245, 0.25);
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
    box-shadow: 0 0 14px 4px rgba(107, 170, 224, 0.45);
  }
}
/* Fade the orb out as the streaming text takes its place. */
.orb-fade-leave-active {
  transition: opacity 0.3s ease;
}
.orb-fade-leave-to {
  opacity: 0;
}
/* Respect reduced-motion: keep the orb visible but stop the pulse. */
@media (prefers-reduced-motion: reduce) {
  .thinking-orb {
    animation: none;
    box-shadow: 0 0 8px 2px rgba(107, 170, 224, 0.35);
  }
}
.layout-stacked .msg-bubble {
  max-width: 100%;
  min-width: 0;
  padding: 0;
}
.layout-stacked .msg-role-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
/* Per-code-block toolbar styles are in src/styles/coach-response.css
   (global/unscoped — the toolbar lives inside v-html content). */
/* Coach response markdown styles are in src/styles/coach-response.css (global, unscoped) */

/* L3 (v10.134): tool-event chips. Rendered above the assistant text in
   Explore-mode bubbles whose underlying agent invoked one or more MCP
   tools. Each chip is a small inline card with status + tool name +
   optional collapsed content preview. Distinct from message bubbles —
   smaller font, monospace, muted color — so they don't compete with
   the main response content. */
.tool-events {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}
.tool-event {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background-color: var(--bg-tertiary);
  overflow: hidden;
  transition: border-color 0.15s;
}
.tool-event--received {
  border-color: color-mix(in srgb, var(--accent-green, #4ade80) 30%, var(--border-color));
}
.tool-event--expanded {
  border-color: var(--accent-blue);
}
.tool-event-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 12px;
  font-family: var(--font-mono);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
}
.tool-event-header:hover:not(:disabled) {
  background-color: rgba(255,255,255,0.03);
}
.tool-event-header:disabled {
  cursor: default;
}
.tool-event-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.tool-event-spinner {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent-blue);
  animation: tool-event-spin 0.9s linear infinite;
}
@keyframes tool-event-spin {
  to { transform: rotate(360deg); }
}
.tool-event-check {
  color: var(--accent-green, #4ade80);
  font-weight: 700;
}
.tool-event-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tool-event-len {
  color: var(--text-muted);
  font-size: 11px;
  flex-shrink: 0;
}
.tool-event-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  flex-shrink: 0;
  font-weight: 700;
}
.tool-event-body {
  padding: 8px 10px;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 11.5px;
  font-family: var(--font-mono);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}
.tool-event-truncated {
  color: var(--text-muted);
}
</style>
