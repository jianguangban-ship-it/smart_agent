<template>
  <section class="explore-chat" :aria-label="t('coach.titleExplore')">
    <header class="explore-head">
      <div class="explore-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="explore-tab"
          :class="{ 'tab-active': activeTab === 'chat' }"
          :aria-selected="activeTab === 'chat'"
          @click="activeTab = 'chat'"
        >{{ t('coach.tabChat') }}</button>
        <button
          type="button"
          role="tab"
          class="explore-tab"
          :class="{ 'tab-active': activeTab === 'history' }"
          :aria-selected="activeTab === 'history'"
          @click="activeTab = 'history'"
        >{{ t('coach.tabHistory') }}</button>
      </div>
      <button type="button" class="explore-newchat" @click="onNewChat">
        {{ t('coach.exploreNewChat') }}
      </button>
    </header>

    <template v-if="activeTab === 'chat'">
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
        />
        <div v-if="backoffSecs > 0" class="explore-backoff">
          {{ t('coach.backoffLabel') }} {{ backoffSecs }}s
        </div>
      </div>

      <div class="explore-composer-wrap">
        <Transition name="chip-fade">
          <span v-if="hasAttachment && attachedFile" class="attach-chip">
            <svg class="attach-chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
            </svg>
            {{ attachedFile.name }}
            <button class="attach-remove" @click="detach" :title="t('form.removeAttachment')">×</button>
          </span>
        </Transition>
        <div class="explore-composer">
          <input
            ref="fileInputRef"
            type="file"
            accept=".md,.markdown,.txt,.html,.htm,.json"
            class="hidden-file-input"
            @change="handleFileSelect"
          />
          <button
            type="button"
            class="attach-btn"
            :title="t('coach.loadFile')"
            @click="openFilePicker"
          >
            <svg class="attach-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.49"/>
            </svg>
            <span class="attach-label">{{ t('coach.loadFileLabel') }}</span>
          </button>
          <textarea
            ref="taEl"
            v-model="draft"
            class="explore-input"
            :placeholder="t('coach.explorePlaceholder')"
            rows="1"
            @keydown="onKeydown"
            @input="autosize"
          />
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
            :disabled="!draft.trim()"
            @click="send"
          >{{ t('coach.exploreSend') }}</button>
        </div>
      </div>
    </template>

    <div v-else class="explore-history">
      <CoachHistoryTab
        :channel="'explore'"
        @replay="onReplay"
        @continue-session="onContinue"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from '@/i18n'
import ChatBubble from './ChatBubble.vue'
import CoachHistoryTab from '@/components/coach/CoachHistoryTab.vue'
import { useAttachment, type AttachError } from '@/composables/useAttachment'
import { useToast } from '@/composables/useToast'
import type { ChatMessage } from '@/types/api'

const { t } = useI18n()
const { attachedFile, attachValidated, detach, hasAttachment } = useAttachment()
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
}>()

const activeTab = ref<'chat' | 'history'>('chat')
const draft = ref('')
const taEl = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

function openFilePicker() {
  fileInputRef.value?.click()
}

async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    await attachValidated(file)
  } catch (err) {
    const reason = err as AttachError
    addToast('error', t(reason === 'size' ? 'toast.fileTooLarge' : 'toast.invalidComposerFile'))
  }
  // Reset so the same file can be re-selected
  input.value = ''
}
const scrollEl = ref<HTMLElement | null>(null)
// Stick to bottom only when the user is already near it — don't yank them
// down while they've scrolled up to read earlier messages.
const stick = ref(true)

function autosize() {
  const el = taEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

function onScroll() {
  const el = scrollEl.value
  if (!el) return
  stick.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40
}

function send() {
  const text = draft.value.trim()
  if (!text || props.isLoading) return
  emit('send', text)
  draft.value = ''
  stick.value = true
  nextTick(autosize)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

function onNewChat() {
  activeTab.value = 'chat'
  draft.value = ''
  stick.value = true
  emit('new-chat')
  nextTick(() => {
    autosize()                                  // textarea back to a single row
    if (scrollEl.value) scrollEl.value.scrollTop = 0
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
  })
)
</script>

<style scoped>
.explore-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.explore-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-5);
  border-bottom: 1px solid var(--border-color);
}
.explore-tabs {
  display: flex;
  gap: var(--space-1);
}
.explore-tab {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}
.explore-tab.tab-active {
  color: var(--accent-blue);
  border-bottom-color: var(--accent-blue);
}
.explore-newchat {
  padding: 2px var(--space-2);
  font-size: var(--font-xs);
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.explore-newchat:hover { color: var(--accent-blue); border-color: var(--accent-blue); }
.explore-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
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
.explore-composer {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5) var(--space-4);
  border-top: 1px solid var(--border-color);
}
.explore-input {
  flex: 1;
  resize: none;
  max-height: 200px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary, var(--bg-secondary));
  color: var(--text-primary);
  font-size: var(--font-md);
  font-family: inherit;
  line-height: 1.5;
}
.explore-input:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.25);
}
.explore-send, .explore-stop {
  padding: var(--space-2) var(--space-4);
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
  border-top: 1px solid var(--border-color);
}
.explore-composer-wrap .explore-composer {
  border-top: none;
  padding: 0;
}
.hidden-file-input {
  display: none;
}
.attach-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 10px;
  align-self: flex-end;
  margin-bottom: 6px;
  transition: all 0.15s ease;
}
.attach-btn:hover {
  border-color: var(--accent-blue);
  color: var(--accent-blue);
  background: var(--blue-subtle, rgba(96, 165, 250, 0.08));
}
.attach-icon {
  width: 13px;
  height: 13px;
}
.attach-label {
  font-family: var(--font-mono);
  font-weight: 600;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  align-self: flex-start;
}
.attach-chip-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
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
