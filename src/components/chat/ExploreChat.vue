<template>
  <section class="explore-chat" :aria-label="t('coach.titleExplore')">
    <header class="explore-head">
      <span class="explore-title">{{ t('coach.titleExplore') }}</span>
      <button type="button" class="explore-newchat" @click="$emit('new-chat')">
        {{ t('coach.exploreNewChat') }}
      </button>
    </header>

    <div ref="scrollEl" class="explore-scroll">
      <div v-if="messages.length === 0" class="explore-empty">
        {{ t('coach.exploreEmpty') }}
      </div>
      <ChatBubble
        v-for="m in messages"
        :key="m.id"
        :message="m"
        :hash-id="m.hashId"
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
  </section>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from '@/i18n'
import ChatBubble from './ChatBubble.vue'
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
}>()

const draft = ref('')
const taEl = ref<HTMLTextAreaElement | null>(null)
const scrollEl = ref<HTMLElement | null>(null)

function autosize() {
  const el = taEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

function send() {
  const text = draft.value.trim()
  if (!text || props.isLoading) return
  emit('send', text)
  draft.value = ''
  nextTick(autosize)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

watch(
  () => props.messages.map(m => m.content).join('|'),
  () => nextTick(() => {
    const el = scrollEl.value
    if (el) el.scrollTop = el.scrollHeight
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
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--border-color);
}
.explore-title {
  font-size: var(--font-sm);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--accent-blue);
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
  color: var(--text-muted);
  font-size: var(--font-sm);
}
.explore-backoff {
  color: var(--accent-orange, var(--text-muted));
  font-size: var(--font-sm);
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
  font-size: var(--font-base);
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
