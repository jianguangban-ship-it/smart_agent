<template>
  <PanelShell
    :title="ICONS.coachPanel + ' ' + (appMode === 'task' ? t('coach.titleTask') : t('coach.titleExplore'))"
    :status="statusInfo.status"
    :status-label="t('status.' + statusInfo.key)"
    :hide-header="appMode === 'task'"
    max-height="2500px"
  >
    <template #header-actions>
      <span class="mode-badge badge-llm" :title="currentModel">{{ currentModel }}</span>
      <button v-if="messages.length > 0 && !isLoading" class="copy-btn" @click="copyLastResponse" :title="t('toast.copied')" :aria-label="t('toast.copied')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="2" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-linecap="round"/>
        </svg>
      </button>
    </template>

    <template #icon>
      <svg class="panel-icon green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>
    </template>

    <!-- Tab bar -->
    <div class="coach-tabs">
      <button
        class="coach-tab"
        :class="{ 'tab-active': activeTab === 'chat' }"
        @click="activeTab = 'chat'"
      >
        {{ t('coach.tabReview') }}
      </button>
      <button
        v-if="appMode === 'task'"
        class="coach-tab"
        :class="{ 'tab-active': activeTab === 'analysis' }"
        @click="activeTab = 'analysis'"
      >
        {{ t('coach.tabAnalysis') }}
      </button>
      <button
        class="coach-tab"
        :class="{ 'tab-active': activeTab === 'history' }"
        @click="activeTab = 'history'"
      >
        {{ t('coach.tabHistory') }}
        <span v-if="isNearCap" class="cap-badge">
          {{ t('coach.historyCapWarning').replace('{n}', String(recordCount)) }}
        </span>
      </button>
    </div>

    <template v-if="activeTab === 'chat'">
    <!-- Active skill chip -->
    <Transition name="fade">
      <div v-if="activeSkill" class="skill-chip" :class="'skill-chip--' + activeSkill.id">
        <span class="skill-chip-name">{{ activeSkill.name }}</span>
        <button class="skill-chip-dismiss" @click="dismissSkill" aria-label="Dismiss skill">&times;</button>
      </div>
    </Transition>

    <!-- Empty state (no messages yet, not loading) -->
    <div v-if="messages.length === 0 && !isLoading" class="empty-state">
      <!-- ASCII globe backdrop (Explore mode only) -->
      <AsciiGlobe v-if="appMode === 'explore'" :dimmed="descriptionFocused" />
      <!-- 429 backoff countdown -->
      <template v-if="backoffSecs > 0">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--accent-orange)">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="backoff-text">{{ t('coach.backoffLabel') }} <strong>{{ backoffSecs }}s</strong></p>
        <button class="cancel-btn small-cancel" @click="$emit('cancel')">{{ t('coach.backoffCancel') }}</button>
      </template>
      <!-- Normal empty state -->
      <template v-else>
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        </svg>
        <p class="empty-hint">{{ appMode === 'explore' ? t('coach.emptyHintExplore') : t('coach.emptyHint') }}</p>
        <p class="empty-sub">{{ appMode === 'explore' ? t('coach.emptySubHintExplore') : t('coach.emptySubHint') }}</p>
        <div
          class="chips"
          :class="{ 'drag-over': isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="handleDrop"
        >
          <!-- Elicitation + Conflict Check only in Explore mode -->
          <div class="guided-chips" v-if="appMode === 'explore'">
            <button
              class="elicit-chip"
              :title="t('elicitation.chipHint')"
              @click="$emit('elicit')"
            >
              <svg class="elicit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {{ t('elicitation.chipLabel') }}
            </button>
            <button
              class="conflict-chip"
              :title="t('conflictCheck.chipHint')"
              @click="$emit('conflictCheck')"
            >
              <svg class="elicit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.8 15.32A1 1 0 002.36 21h17.28a1 1 0 00.87-1.5l-8.6-15.32a1.04 1.04 0 00-1.82 0z"/>
              </svg>
              {{ t('conflictCheck.chipLabel') }}
            </button>
          </div>
          <!-- Template chips only in Task mode -->
          <template v-if="appMode === 'task'">
            <QuickChip
              v-for="chip in chips"
              :key="chip.key"
              :icon="chip.icon"
              :label="chip.label"
              @click="$emit('applyChip', chip.key)"
            />
          </template>
          <span v-if="isDragging" class="drag-hint">Drop JSON here</span>
        </div>
      </template>
    </div>

    <!-- Chat messages -->
    <div v-else class="chat-container" ref="chatContainerRef">
      <TransitionGroup name="chat-msg" tag="div" class="chat-list">
        <ChatBubble
          v-for="msg in messages"
          :key="msg.id"
          :message="msg"
          :hash-id="msg.hashId"
        />
      </TransitionGroup>

      <!-- Typing indicator: waiting for first token -->
      <Transition name="chat-msg">
        <div v-if="isLoading && isWaitingFirstToken" class="typing-row">
          <div class="typing-avatar-col">
            <img :src="AGENT_AVATAR" class="typing-avatar avatar-thinking" alt="Coach" />
          </div>
          <div class="typing-bubble">
            <span class="typing-label">{{ t('coach.agentLabel') }}</span>
            <div class="typing-dots">
              <span class="typing-dot" /><span class="typing-dot" /><span class="typing-dot" />
            </div>
          </div>
        </div>
      </Transition>

      <!-- Backoff inside chat -->
      <div v-if="backoffSecs > 0" class="chat-backoff">
        <p class="backoff-text">{{ t('coach.backoffLabel') }} <strong>{{ backoffSecs }}s</strong></p>
        <button class="cancel-btn small-cancel" @click="$emit('cancel')">{{ t('coach.backoffCancel') }}</button>
      </div>

      <!-- Stream footer (cursor + speed only — cancel is on the TaskForm Reset button) -->
      <div v-if="isLoading && !isWaitingFirstToken" class="stream-footer">
        <span class="streaming-cursor green" />
        <span v-if="streamSpeed > 0" class="stream-speed">{{ streamSpeed }} {{ t('dev.streamSpeed') }}</span>
      </div>

      <!-- Retry row -->
      <div v-if="!isLoading && (wasCancelled || hadError) && messages.length > 0" class="retry-row">
        <button class="retry-btn" :disabled="retryCountdown > 0" @click="handleRetry">
          <svg class="retry-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          {{ retryCountdown > 0 ? `${retryCountdown}s` : t('coach.retryBtn') }}
        </button>
      </div>
    </div>
    </template>

    <!-- Analysis tab (Task mode) — host the AIReviewPanel via slot; App.vue
         still owns all analyze state, so no prop re-plumbing here. -->
    <div v-else-if="activeTab === 'analysis'" class="coach-analysis">
      <slot name="analysis" />
    </div>

    <!-- History tab -->
    <CoachHistoryTab
      v-if="activeTab === 'history'"
      @replay="handleReplay"
      @continue-session="handleContinueSession"
    />

    <!-- Pinned composer (Task mode, chat tab) — rendered in PanelShell's footer
         slot, OUTSIDE the scrollable .panel-body, so it never moves while coach
         messages scroll and the smart autoscroll is unaffected.
         v10.125: Send/Stop button moved to TaskForm's action bar; the
         DescriptionEditor now spans the full footer width. -->
    <template v-if="appMode === 'task' && activeTab === 'chat'" #footer>
      <DescriptionEditor
        variant="composer"
        v-model="descriptionModel"
        @focus="$emit('descFocus')"
        @blur="$emit('descBlur')"
        @submit="onComposerSubmit"
        @expand="isPopoutOpen = true"
      />
    </template>
  </PanelShell>

  <!-- Floating draggable popout — teleports to <body> so it's not clipped by
       the panel column. Shares descriptionModel with the inline composer so
       edits stay in sync; closing leaves the text intact in the inline one. -->
  <ComposerPopout
    v-if="appMode === 'task'"
    v-model="descriptionModel"
    v-model:open="isPopoutOpen"
    @submit="onComposerSubmit"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted, nextTick, onMounted } from 'vue'
import type { ChatMessage } from '@/types/api'
import { useScroll } from '@vueuse/core'
import { useI18n } from '@/i18n'
import { roleFilteredTemplates } from '@/config/templates/index'
import { useToast } from '@/composables/useToast'
import { copyText } from '@/utils/clipboard'
import { activeSkill, ignoredSkillId } from '@/composables/useLLM'
import { appMode } from '@/composables/useAppMode'
import { currentModel } from '@/config/llm'
import AsciiGlobe from '@/components/effects/AsciiGlobe.vue'
import PanelShell from '@/components/layout/PanelShell.vue'
import QuickChip from '@/components/shared/QuickChip.vue'
import ChatBubble from '@/components/chat/ChatBubble.vue'
import CoachHistoryTab from '@/components/coach/CoachHistoryTab.vue'
import DescriptionEditor from '@/components/form/DescriptionEditor.vue'
import ComposerPopout from '@/components/form/ComposerPopout.vue'
import { isNearCap, recordCount } from '@/composables/useCoachHistory'
import { ICONS } from '@/config/icons'

const props = defineProps<{
  messages: ChatMessage[]
  isLoading: boolean
  wasCancelled: boolean
  hadError: boolean
  streamSpeed: number
  backoffSecs: number
  descriptionFocused: boolean
  canCoachSubmit?: boolean
  isAnalyzing?: boolean
}>()

// Task-mode "TASK DESCRIPTION" composer (pinned in the panel footer). Bound to
// App's form.description — the single source of truth for Coach/Analyze/Create.
const descriptionModel = defineModel<string>('description', { default: '' })

// v10.129: floating draggable popout window for long-prompt editing.
const isPopoutOpen = ref(false)

const emit = defineEmits<{
  cancel: []
  retry: []
  applyChip: [key: string]
  elicit: []
  conflictCheck: []
  importTemplates: [templates: import('@/types/template').TemplateDefinition[]]
  replay: [content: string]
  continueSession: [sessionId: string]
  coach: []
  descFocus: []
  descBlur: []
}>()

function onComposerSubmit() {
  if (props.canCoachSubmit && !props.isLoading) emit('coach')
}

// Bound (not a literal src) so Vite's static asset transform doesn't try to
// resolve the public-path image — keeps the component unit-testable.
const AGENT_AVATAR = '/agent_avy.png'

const activeTab = ref<'chat' | 'analysis' | 'history'>('chat')

// Surface analyze results without a manual tab click: when an analyze run
// starts, jump to the Analysis tab.
watch(() => props.isAnalyzing, (now) => {
  if (now) activeTab.value = 'analysis'
})

function handleReplay(content: string) {
  activeTab.value = 'chat'
  emit('replay', content)
}

function handleContinueSession(sessionId: string) {
  activeTab.value = 'chat'
  emit('continueSession', sessionId)
}

const { t, isZh } = useI18n()
const { addToast } = useToast()

function dismissSkill() {
  if (activeSkill.value) {
    ignoredSkillId.value = activeSkill.value.id
    activeSkill.value = null
  }
}

const isDragging = ref(false)
const retryCountdown = ref(0)
let _cooldownTimer: number | null = null
const chatContainerRef = ref<HTMLElement>()

// Waiting for first token: loading + last message is assistant with empty content
const isWaitingFirstToken = computed(() => {
  if (!props.isLoading) return false
  const msgs = props.messages
  if (msgs.length === 0) return true
  const last = msgs[msgs.length - 1]
  return last.role === 'assistant' && !last.content
})

function handleRetry() {
  emit('retry')
  retryCountdown.value = 2
  _cooldownTimer = window.setInterval(() => {
    retryCountdown.value--
    if (retryCountdown.value <= 0) {
      clearInterval(_cooldownTimer!)
      _cooldownTimer = null
    }
  }, 1000)
}

onUnmounted(() => {
  if (_cooldownTimer !== null) clearInterval(_cooldownTimer)
})

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file || !file.name.endsWith('.json')) {
    addToast('error', t('toast.invalidDropFile'))
    return
  }
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target?.result as string)
      if (!Array.isArray(data)) throw new Error('Not an array')
      emit('importTemplates', data)
    } catch {
      addToast('error', t('toast.invalidTemplateJson'))
    }
  }
  reader.readAsText(file)
}

const statusInfo = computed(() => {
  if (props.isLoading) return { status: 'loading' as const, key: 'loading' }
  if (props.messages.length > 0) return { status: 'success' as const, key: 'success' }
  return { status: 'idle' as const, key: 'idle' }
})

// ─── Smart auto-scroll (pauses when user scrolls up) ─────────────────────────
const scrollParentRef = ref<HTMLElement>()

// Resolve the actual scrollable ancestor (.panel-body) after mount
onMounted(() => {
  const el = chatContainerRef.value?.closest('.panel-body') as HTMLElement | null
  if (el) scrollParentRef.value = el
})

const { arrivedState } = useScroll(scrollParentRef)

// Auto-scroll only when user is near the bottom (hasn't scrolled up to read history)
let _prevMsgCount = 0

watch(
  () => {
    const msgs = props.messages
    const last = msgs[msgs.length - 1]
    return { count: msgs.length, len: last?.content?.length ?? 0 }
  },
  (cur) => {
    const isNewMessage = cur.count !== _prevMsgCount
    _prevMsgCount = cur.count

    // Skip auto-scroll if user has scrolled up (not at bottom)
    // Always scroll for brand-new messages; only skip streaming chunks
    if (!isNewMessage && !arrivedState.bottom) return

    nextTick(() => {
      const el = scrollParentRef.value
      if (!el) return
      el.scrollTo({ top: el.scrollHeight, behavior: isNewMessage ? 'smooth' : 'instant' })
    })
  },
  { deep: true }
)

// Copy last assistant response
async function copyLastResponse() {
  const assistantMsgs = props.messages.filter(m => m.role === 'assistant' && m.content)
  const last = assistantMsgs[assistantMsgs.length - 1]
  if (!last) return
  const ok = await copyText(last.content)
  addToast(ok ? 'success' : 'error', t(ok ? 'toast.copied' : 'toast.copyFailed'), 2000)
}

const chips = computed(() =>
  roleFilteredTemplates.value.map(t => ({
    key: t.key,
    icon: t.icon,
    label: isZh.value ? t.label.zh : t.label.en
  }))
)
</script>

<style scoped>
/* Tab bar */
.coach-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-tertiary);
}
.coach-tab {
  flex: 1;
  text-align: center;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.coach-tab:hover {
  color: var(--text-secondary);
}
.tab-active {
  color: var(--accent-blue);
  border-bottom-color: var(--accent-blue);
  background-color: var(--bg-secondary);
}
.cap-badge {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 8px;
  background-color: var(--orange-subtle, var(--bg-tertiary));
  color: var(--accent-orange);
  font-weight: 600;
}

.panel-icon {
  width: 16px;
  height: 16px;
}
.green { color: var(--accent-green); }

/* Chat container */
.chat-container {
  display: flex;
  flex-direction: column;
  padding: 8px 4px;
  min-height: 100px;
}

/* Empty state */
.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 8px 16px 20px;
  overflow: hidden;
}
.empty-icon {
  width: 40px;
  height: 40px;
  color: var(--accent-blue);
  margin-bottom: 12px;
}
.empty-hint {
  font-size: 12px;
  color: var(--text-primary);
  margin-bottom: 8px;
}
.empty-sub {
  font-size: 12px;
  color: var(--text-primary);
  opacity: 0.7;
  margin-bottom: 16px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  border-radius: var(--radius-md);
  border: 2px dashed transparent;
  padding: 4px;
  transition: border-color 0.2s, background-color 0.2s;
  position: relative;
}
.chips.drag-over {
  border-color: var(--accent-blue);
  background-color: var(--blue-wash);
}
.drag-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--accent-blue);
  font-weight: 500;
  pointer-events: none;
}

/* Guided chips (Elicitation + Conflict Check) */
.guided-chips {
  display: flex;
  gap: 6px;
  width: 100%;
  margin-bottom: 4px;
}
.elicit-chip,
.conflict-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 600;
  color: white;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
}
.elicit-chip {
  background: linear-gradient(135deg, var(--accent-purple, #a78bfa), var(--accent-blue));
}
.conflict-chip {
  background: linear-gradient(135deg, var(--accent-orange), var(--accent-red));
}
.elicit-chip:hover,
.conflict-chip:hover {
  filter: brightness(1.15);
  transform: translateY(-1px);
}
.elicit-icon {
  width: 14px;
  height: 14px;
}

/* Typing indicator — bubble style */
.typing-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 16px;
}
.typing-avatar-col {
  flex-shrink: 0;
}
.typing-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  background-color: var(--bg-tertiary);
}
.avatar-thinking {
  animation: breathe 2s ease-in-out infinite;
}
@keyframes breathe {
  0%, 100% { box-shadow: 0 0 0 0 var(--green-glow); }
  50% { box-shadow: 0 0 8px 4px var(--green-subtle); }
}
.typing-bubble {
  background-color: var(--bg-secondary);
  box-shadow: var(--shadow-sm);
  border-radius: 12px 12px 12px 4px;
  padding: 10px 14px;
}
.typing-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--accent-blue);
  margin-bottom: 4px;
}
.typing-dots {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
}
.typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--accent-blue);
  animation: typingBounce 1.4s ease-in-out infinite;
}
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

/* Backoff inside chat */
.chat-backoff {
  text-align: center;
  padding: 12px;
}

/* Mode badge */
.mode-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  letter-spacing: 0.3px;
  line-height: 1;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge-llm {
  background-color: var(--blue-subtle);
  color: var(--accent-blue);
  border: 1px solid var(--blue-border);
}

/* Skill toggle */
.skill-toggle {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  letter-spacing: 0.3px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid;
}
.skill-on {
  background-color: var(--green-subtle);
  color: var(--accent-green);
  border-color: var(--green-border);
}
.skill-on:hover {
  background-color: var(--green-glow);
}
.skill-off {
  background-color: var(--bg-tertiary);
  color: var(--text-muted);
  border-color: var(--border-color);
}
.skill-off:hover:not(:disabled) {
  color: var(--text-secondary);
  border-color: var(--text-muted);
}
.skill-disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

/* Copy button */
.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.copy-btn:hover {
  color: var(--accent-green);
  border-color: var(--border-color);
  background-color: var(--bg-secondary);
}
.copy-btn svg {
  width: 13px;
  height: 13px;
}

/* Cancel & retry */
.cancel-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
  background-color: var(--red-subtle);
  color: var(--accent-red);
  border: 1px solid var(--red-border);
  cursor: pointer;
  transition: background-color 0.15s;
}
.cancel-btn:hover { background-color: var(--red-border); }
.cancel-icon { width: 12px; height: 12px; }
.retry-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.retry-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.15s;
}
.retry-btn:hover:not(:disabled) {
  color: var(--accent-green);
  border-color: var(--accent-green);
}
.retry-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.retry-icon { width: 12px; height: 12px; }

.stream-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.stream-speed {
  font-size: 11px;
  color: var(--accent-green);
  opacity: 0.8;
  font-family: var(--font-mono);
}
.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  margin-left: 2px;
  vertical-align: text-bottom;
  border-radius: 1px;
  animation: blink 0.9s step-end infinite;
}
.streaming-cursor.green { background-color: var(--accent-green); }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.backoff-text {
  font-size: 13px;
  color: var(--accent-orange);
  margin-bottom: 12px;
}
.small-cancel {
  padding: 5px 14px;
  font-size: 12px;
  margin-top: 0;
}

/* TransitionGroup / Transition animations for message entry/exit */
.chat-msg-enter-active {
  transition: all 0.25s ease-out;
}
.chat-msg-leave-active {
  transition: all 0.15s ease-in;
}
.chat-msg-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.chat-msg-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.chat-msg-move {
  transition: transform 0.25s ease;
}

/* Chat list wrapper (TransitionGroup tag) */
.chat-list {
  display: flex;
  flex-direction: column;
}

/* Active skill chip */
.skill-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  margin: 6px 8px 2px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--border-color);
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  width: fit-content;
}
.skill-chip--coach {
  border-color: var(--green-border);
  background-color: var(--green-subtle);
  color: var(--accent-green);
}
.skill-chip--analyze {
  border-color: var(--blue-border);
  background-color: var(--blue-subtle);
  color: var(--accent-blue);
}
.skill-chip--ui-ux-pro-max {
  border-color: var(--accent-purple);
  background-color: color-mix(in srgb, var(--accent-purple) 10%, transparent);
  color: var(--accent-purple);
}
.skill-chip-name {
  letter-spacing: 0.3px;
}
.skill-chip-dismiss {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
  opacity: 0.6;
  transition: opacity 0.15s;
}
.skill-chip-dismiss:hover {
  opacity: 1;
}

/* Fade transition for skill chip */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* v10.125: removed `.coach-composer`, `.coach-composer-input`,
   `.coach-send`, `.coach-stop` — Send/Stop relocated to TaskForm's
   action bar; the DescriptionEditor now spans the full panel footer. */
</style>
