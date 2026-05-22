<template>
  <div class="chat-msg" :class="[`chat-${message.role}`, `layout-${layout}`]">
    <!-- Avatar column (bubble layout only — stacked uses an inline avatar) -->
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
      <span class="msg-role-label" :class="[`role-${message.role}`]">
        <img
          v-if="layout === 'stacked' && message.role === 'assistant'"
          :src="agentAvatar"
          class="msg-avatar-inline"
          :class="{ 'avatar-thinking': message.isStreaming }"
          alt="Coach"
        />
        <span
          v-else-if="layout === 'stacked'"
          class="msg-avatar-inline msg-avatar-inline-user"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
          </svg>
        </span>
        {{ message.role === 'assistant' ? t('coach.agentLabel') : t('coach.userLabel') }}
        <span class="msg-time">{{ timeLabel }}</span>
        <span v-if="hashId" class="msg-hash">#{{ hashId }}</span>
      </span>
      <!-- Agent: formatted markdown -->
      <template v-if="message.role === 'assistant'">
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
      <!-- User: plain text -->
      <div v-else class="msg-user-text">
        {{ message.content }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { ChatMessage } from '@/types/api'
import { useI18n } from '@/i18n'
import { formatCoachResponse } from '@/utils/formatCoach'
import { useToast } from '@/composables/useToast'
import { downloadFile } from '@/utils/exportFormats'
import { copyText } from '@/utils/clipboard'
import {
  enhanceCodeBlocks,
  setArtifactLabels,
  handleArtifactClick,
  type ArtifactMeta,
} from '@/utils/codeArtifact'

const { t } = useI18n()
const { addToast } = useToast()
const agentAvatar = '/agent_avy.png'

const props = withDefaults(defineProps<{
  message: ChatMessage
  hashId?: string
  /** 'bubble' = side avatar, left/right (Task). 'stacked' = full-width turns (Explore). */
  layout?: 'bubble' | 'stacked'
}>(), { layout: 'bubble' })

// RAF-throttled formatting for streaming messages
const formattedContent = ref('')
const responseEl = ref<HTMLElement | null>(null)
let _rafId: number | null = null

// Re-inject the Copy/Download toolbar after each v-html render (v-html wipes
// the subtree, so this runs against fresh DOM every time).
async function enhanceArtifacts() {
  await nextTick()
  enhanceCodeBlocks(responseEl.value)
  setArtifactLabels(responseEl.value, t('coach.copyCode'), t('coach.downloadCode'))
}

watch(
  () => props.message.content,
  (val) => {
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
function onResponseClick(e: Event) {
  handleArtifactClick(e, { onCopy, onDownload })
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
.msg-avatar-inline {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background-color: var(--bg-tertiary);
}
.msg-avatar-inline-user {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--accent-blue);
  color: white;
}
.msg-avatar-inline-user svg {
  width: 13px;
  height: 13px;
}

/* Per-code-block toolbar styles are in src/styles/coach-response.css
   (global/unscoped — the toolbar lives inside v-html content). */
/* Coach response markdown styles are in src/styles/coach-response.css (global, unscoped) */
</style>
