<template>
  <Transition name="modal">
    <div
      v-if="open"
      ref="overlayRef"
      class="search-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="t('coach.searchChats')"
      @click.self="close"
    >
      <div class="search-panel">
        <!-- Header: magnifier + input + close -->
        <div class="search-header">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            class="search-input"
            :placeholder="t('coach.searchPlaceholder')"
            @keydown="onKeydown"
          />
          <button type="button" class="search-close" :aria-label="t('modal.cancel')" @click="close">✕</button>
        </div>

        <!-- Results -->
        <div class="search-results">
          <p v-if="filtered.length === 0" class="search-empty">{{ t('coach.searchNoResults') }}</p>
          <button
            v-for="(item, index) in filtered"
            :key="item.sessionId"
            type="button"
            class="search-result"
            :class="{ highlighted: index === highlightedIndex }"
            @click="select(item.sessionId)"
          >
            <svg class="result-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 20l1.9-5.7a8.38 8.38 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 2 8.5 8.5 0 0 1 21 11.5z" />
            </svg>
            <span class="result-title">{{ item.title }}</span>
            <span class="result-meta">{{ index === highlightedIndex ? t('coach.searchEnterHint') : timeBucketLabel(item.lastTimestamp) }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from '@/i18n'
import { useFocusTrap } from '@/composables/useFocusTrap'

export interface SearchItem {
  sessionId: string
  title: string
  lastTimestamp: number
  haystack: string
}

const props = defineProps<{ open: boolean; items: SearchItem[]; activeId?: string | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; select: [sessionId: string] }>()

const { t } = useI18n()

const overlayRef = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()
const query = ref('')
const highlightedIndex = ref(0)

const { activate, deactivate } = useFocusTrap(overlayRef)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = q ? props.items.filter(i => i.haystack.includes(q)) : props.items
  return list
})

// While typing, select the top match. (Opening restores the active-chat row — see
// the open watcher below — so the empty-query default is "return to current chat".)
watch(query, () => { highlightedIndex.value = 0 })

function close() {
  emit('update:open', false)
}
function select(sessionId: string) {
  emit('select', sessionId)
  close()
}

function onKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      if (highlightedIndex.value < filtered.value.length - 1) highlightedIndex.value++
      break
    case 'ArrowUp':
      e.preventDefault()
      if (highlightedIndex.value > 0) highlightedIndex.value--
      break
    case 'Enter': {
      e.preventDefault()
      const item = filtered.value[highlightedIndex.value]
      if (item) select(item.sessionId)
      break
    }
    case 'Escape':
      e.preventDefault()
      close()
      break
  }
}

// ── Relative time buckets (matches the Claude search list's right-side labels) ──
function timeBucketLabel(ts: number): string {
  const now = Date.now()
  const day = 86_400_000
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  if (ts >= startOfToday.getTime()) return t('coach.timeToday')
  if (ts >= startOfToday.getTime() - day) return t('coach.timeYesterday')
  if (ts >= now - 7 * day) return t('coach.timePastWeek')
  if (ts >= now - 30 * day) return t('coach.timePastMonth')
  return t('coach.timeOlder')
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    query.value = ''
    nextTick(() => {
      // Pre-select the chat that was active before search opened, so "Enter"
      // returns the user there; fall back to the first result.
      const i = filtered.value.findIndex(item => item.sessionId === props.activeId)
      highlightedIndex.value = Math.max(0, i)
      activate()
      inputRef.value?.focus()
    })
  } else {
    deactivate()
  }
})
</script>

<style scoped>
/* Top-centered command palette over the chat (mirrors the Claude search UX). */
.search-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 5000;
  padding: var(--space-4);
}
.search-panel {
  margin-top: 10vh;
  width: 100%;
  max-width: 640px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal, 0 16px 48px rgba(0, 0, 0, 0.4));
  overflow: hidden;
  animation: scaleIn 0.18s ease-out;
}
.search-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-color);
}
.search-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: var(--text-muted);
}
.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 16px;
  outline: none;
}
.search-input::placeholder { color: var(--text-muted); }
.search-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: var(--font-base);
  transition: background 0.15s, color 0.15s;
}
.search-close:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.search-results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-2);
}
.search-empty {
  padding: var(--space-5);
  text-align: center;
  color: var(--text-muted);
  font-size: var(--font-sm);
}
.search-result {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 40px;
  padding: 0 var(--space-3);
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
}
/* Hover darken — independent of the keyboard selection (which keeps "Enter"). */
.search-result:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.search-result.highlighted {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.result-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--text-muted);
}
.result-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-sans);
  font-size: 14px;
}
.result-meta {
  flex-shrink: 0;
  font-size: var(--font-xs, 12px);
  color: var(--text-muted);
}

@keyframes scaleIn {
  from { opacity: 0; transform: translateY(-8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.modal-enter-active, .modal-leave-active { transition: opacity 0.18s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
