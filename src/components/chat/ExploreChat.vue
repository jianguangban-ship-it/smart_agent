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

      <div class="explore-composer">
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
import type { ChatMessage } from '@/types/api'

const { t } = useI18n()

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
</style>
