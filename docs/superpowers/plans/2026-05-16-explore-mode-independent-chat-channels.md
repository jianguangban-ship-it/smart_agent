# Independent AI Chat Channels (Task & Explore) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **PROJECT RULE OVERRIDE (CLAUDE.md):** Never auto-commit. The "Commit" steps below mean *stage and prepare a commit message*; do **NOT** run `git commit` unless the user explicitly asks. Treat each commit step as a review checkpoint.

**Goal:** Give Task mode and Explore mode fully independent, concurrently-streaming AI conversation channels, with Explore presented as a single-column chat (conversation + docked composer).

**Architecture:** Instantiate the existing `createStreamFlow` factory twice (`taskCoach`, `exploreCoach`) so each has its own `messages`, loading/error state, and `AbortController`. `useLLM()` stays an App-singleton so an in-flight stream keeps running while its panel is unmounted. History records are tagged with a `channel`; last-response persistence is split per channel. Explore renders a new full-width `ExploreChat.vue` reusing `ChatBubble`.

**Tech Stack:** Vue 3 + TypeScript, Vitest + @vue/test-utils (jsdom), existing unified/remark markdown pipeline, native fetch SSE.

**Spec:** `docs/superpowers/specs/2026-05-16-explore-mode-independent-chat-channels-design.md`

**Test commands:** single file `npx vitest run <path>`; full suite `npx vitest run`; type/build `npm run build`. Pre-existing UNRELATED failures in `src/utils/__tests__/formatCoach.test.ts` (3 cases) are out of scope — must not regress anything else.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/types/api.ts` | Add `CoachHistoryRecord.channel` |
| `src/composables/useCoachHistory.ts` | Channel-tagged records, per-channel session, channel-filtered selectors |
| `src/composables/useLLM.ts` | Two `createStreamFlow` instances + `task*`/`explore*` API + back-compat aliases |
| `src/i18n/en.ts`, `src/i18n/zh.ts` | Explore composer strings (bilingual) |
| `src/components/chat/ExploreChat.vue` | New — single-column conversation + docked composer |
| `src/App.vue` | Wire two channels, route handlers, split persistence, render ExploreChat |
| `src/components/panels/CoachPanel.vue` | Bind to task channel (history filtered to task) |
| `src/components/layout/AppHeader.vue`, `PLAN.md`, `MEMORY.MD` | Post-change checklist |

---

## Task 1: Channel-aware coach history

**Files:**
- Modify: `src/types/api.ts` (the `CoachHistoryRecord` interface)
- Modify: `src/composables/useCoachHistory.ts`
- Test: `src/composables/__tests__/useCoachHistory.channel.test.ts` (create)

- [ ] **Step 1: Add `channel` to the type**

In `src/types/api.ts`, find `interface CoachHistoryRecord` and add the field:

```ts
export type CoachChannel = 'task' | 'explore'

export interface CoachHistoryRecord {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  sessionId?: string
  channel?: CoachChannel   // undefined === legacy 'task'
}
```

- [ ] **Step 2: Write the failing test**

Create `src/composables/__tests__/useCoachHistory.channel.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

const storage: Record<string, string> = {}
beforeAll(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
    key: () => null, length: 0,
  } as Storage
})

import {
  coachHistory, addRecord, recordsForChannel,
  startNewSession, clearHistory,
} from '../useCoachHistory'

beforeEach(() => {
  Object.keys(storage).forEach(k => delete storage[k])
  clearHistory()
})

describe('useCoachHistory channel scoping', () => {
  it('tags new records with the given channel and filters by it', () => {
    startNewSession('task')
    addRecord('user', 'task q', 'task')
    addRecord('assistant', 'task a', 'task')
    startNewSession('explore')
    addRecord('user', 'explore q', 'explore')

    expect(recordsForChannel('task').map(r => r.content)).toEqual(['task a', 'task q'])
    expect(recordsForChannel('explore').map(r => r.content)).toEqual(['explore q'])
  })

  it('treats legacy untagged records as task channel', () => {
    coachHistory.value = [
      { id: 'a', role: 'user', content: 'legacy', timestamp: 1 },
    ]
    expect(recordsForChannel('task').map(r => r.content)).toEqual(['legacy'])
    expect(recordsForChannel('explore')).toEqual([])
  })

  it('keeps per-channel sessions independent', () => {
    startNewSession('task')
    addRecord('user', 't1', 'task')
    startNewSession('explore')
    addRecord('user', 'e1', 'explore')
    addRecord('assistant', 't2', 'task') // task session still active independently
    const taskSids = new Set(recordsForChannel('task').map(r => r.sessionId))
    const expSids = new Set(recordsForChannel('explore').map(r => r.sessionId))
    expect([...taskSids].some(s => expSids.has(s!))).toBe(false)
  })
})
```

- [ ] **Step 3: Run it — verify failure**

Run: `npx vitest run src/composables/__tests__/useCoachHistory.channel.test.ts`
Expected: FAIL (`recordsForChannel` not exported; `addRecord`/`startNewSession` arity).

- [ ] **Step 4: Implement channel support in `useCoachHistory.ts`**

Replace the session-tracking + `addRecord` regions with per-channel sessions:

```ts
import type { CoachChannel } from '@/types/api'

// ─── Session tracking (per channel) ─────────────────────────────────────────
const sessionByChannel = ref<Record<CoachChannel, string | null>>({ task: null, explore: null })

// Back-compat single ref used elsewhere (task-channel session).
export const currentSessionId = ref<string | null>(null)

export function startNewSession(channel: CoachChannel = 'task'): void {
  const existingIds = new Set(
    coachHistory.value.map(r => r.sessionId).filter(Boolean) as string[]
  )
  const id = generateHashId(existingIds)
  sessionByChannel.value[channel] = id
  if (channel === 'task') currentSessionId.value = id
}

export function setSessionId(channel: CoachChannel, id: string | null): void {
  sessionByChannel.value[channel] = id
  if (channel === 'task') currentSessionId.value = id
}
```

Update `addRecord` to take a channel:

```ts
export function addRecord(
  role: 'user' | 'assistant',
  content: string,
  channel: CoachChannel = 'task'
): CoachHistoryRecord {
  if (!sessionByChannel.value[channel]) startNewSession(channel)
  const existingIds = new Set(coachHistory.value.map(r => r.id))
  const record: CoachHistoryRecord = {
    id: generateHashId(existingIds),
    role, content,
    timestamp: Date.now(),
    sessionId: sessionByChannel.value[channel]!,
    channel,
  }
  coachHistory.value = [record, ...coachHistory.value].slice(0, MAX_RECORDS)
  saveToStorage(coachHistory.value)
  return record
}

/** Records belonging to a channel; legacy untagged === 'task'. */
export function recordsForChannel(channel: CoachChannel): CoachHistoryRecord[] {
  return coachHistory.value.filter(r => (r.channel ?? 'task') === channel)
}
```

In `clearHistory()` reset both channel sessions:

```ts
export function clearHistory(): void {
  coachHistory.value = []
  localStorage.removeItem(LS_KEY)
  sessionByChannel.value = { task: null, explore: null }
  currentSessionId.value = null
}
```

- [ ] **Step 5: Run it — verify pass**

Run: `npx vitest run src/composables/__tests__/useCoachHistory.channel.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Type-check (callers of `startNewSession`/`addRecord` still compile via defaults)**

Run: `npm run build`
Expected: no TS errors (the `channel` param defaults to `'task'`, so existing zero/two-arg callers keep compiling).

- [ ] **Step 7: Commit (checkpoint — do not `git commit` unless the user asked)**

Stage: `git add src/types/api.ts src/composables/useCoachHistory.ts src/composables/__tests__/useCoachHistory.channel.test.ts`
Message: `feat: channel-tagged coach history (task vs explore)`

---

## Task 2: Split useLLM into taskCoach + exploreCoach

**Files:**
- Modify: `src/composables/useLLM.ts`
- Test: `src/composables/__tests__/useLLM.channels.test.ts` (create)

- [ ] **Step 1: Add `channel` to the stream-flow factory**

In `src/composables/useLLM.ts`, extend `StreamFlowOptions` and thread it into the two `addRecord` calls:

```ts
interface StreamFlowOptions {
  getSystemPrompt: (lang: 'en' | 'zh', payload: WebhookPayload) => string
  getUserMessage: (payload: WebhookPayload, isZh: boolean) => string
  onBeforeRequest?: (currentResponse: unknown) => void
  chatMode?: boolean
  channel?: import('@/types/api').CoachChannel  // 'task' | 'explore'
}
```

In `createStreamFlow`, the user-message record (currently `addRecord('user', userMessage)`):

```ts
const record = addRecord('user', userMessage, opts.channel ?? 'task')
```

and the assistant-complete record (currently `addRecord('assistant', lastMsg.content)`):

```ts
const record = addRecord('assistant', lastMsg.content, opts.channel ?? 'task')
```

- [ ] **Step 2: Write the failing test (concurrent isolation)**

Create `src/composables/__tests__/useLLM.channels.test.ts`:

```ts
import { describe, it, expect, beforeAll, vi } from 'vitest'

const storage: Record<string, string> = {}
beforeAll(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => {}, key: () => null, length: 0,
  } as Storage
})

import { useLLM } from '../useLLM'
import type { WebhookPayload } from '@/types/api'

function payload(desc: string): WebhookPayload {
  return { data: { description: desc } } as unknown as WebhookPayload
}

describe('useLLM independent channels', () => {
  it('exposes separate task/explore message arrays and loading flags', () => {
    const llm = useLLM()
    expect(llm.taskCoachMessages.value).toEqual([])
    expect(llm.exploreCoachMessages.value).toEqual([])
    expect(llm.isTaskCoachLoading.value).toBe(false)
    expect(llm.isExploreCoachLoading.value).toBe(false)
    expect(typeof llm.requestTaskCoach).toBe('function')
    expect(typeof llm.requestExploreCoach).toBe('function')
    expect(typeof llm.cancelExploreCoach).toBe('function')
  })

  it('cancelling explore does not clear task messages', () => {
    const llm = useLLM()
    llm.taskCoachMessages.value.push({
      id: 't1', role: 'assistant', content: 'task answer', timestamp: 1,
    })
    llm.cancelExploreCoach()
    expect(llm.taskCoachMessages.value.map(m => m.content)).toEqual(['task answer'])
  })
})
```

- [ ] **Step 3: Run it — verify failure**

Run: `npx vitest run src/composables/__tests__/useLLM.channels.test.ts`
Expected: FAIL (`taskCoachMessages`/`exploreCoachMessages` undefined).

- [ ] **Step 4: Replace the single `coach` flow with two flows**

In `useLLM()`, replace the `// ─── Coach flow (chat mode) ───` block (the single `const coach = createStreamFlow({...})`) with two instances. Keep the existing task system-prompt logic verbatim for `taskCoach`; `exploreCoach` is free-chat only:

```ts
// Task channel — task-requirement coaching (skill + trace logic, unchanged).
const taskCoach = createStreamFlow({
  chatMode: true,
  channel: 'task',
  getSystemPrompt: (lang, payload) => {
    const langKey = lang === 'zh' ? 'zh' as const : 'en' as const
    const rawInput = payload.data.description || ''
    const matched = matchSkill(rawInput, SKILL_REGISTRY, langKey)
    let basePrompt: string
    if (matched && matched.id !== ignoredSkillId.value) {
      if (ignoredSkillId.value && matched.id !== ignoredSkillId.value) ignoredSkillId.value = null
      activeSkill.value = matched
      basePrompt = resolveSystemPrompt(matched, langKey)
    } else {
      activeSkill.value = null
      basePrompt = getCoachSkill('task', lang)
    }
    const traceCtx = getModeTraceContext('task',
      (payload.data.requirement_level || 'none') as TaskLevel,
      payload.data.parent_req_id || '', langKey)
    return [traceCtx, basePrompt].filter(Boolean).join('\n\n')
  },
  getUserMessage: (payload, zh) => buildUserMessage(payload, zh),
}, _callGLMStream, t, isZh)

// Explore channel — free chat on any topic (Response Format only).
const exploreCoach = createStreamFlow({
  chatMode: true,
  channel: 'explore',
  getSystemPrompt: () => getResponseFormat(),
  getUserMessage: (payload) => payload.data.description || '',
}, _callGLMStream, t, isZh)

// Active-channel alias for read-only shared consumers (DevTools/TaskForm).
const activeCoach = computed(() =>
  appMode.value === 'explore' ? exploreCoach : taskCoach)
```

- [ ] **Step 5: Replace the coach public API**

Replace the coach section of the returned object (the `isCoachLoading … restoreCoachMessages` block) with explicit channels + back-compat aliases:

```ts
// Task channel
isTaskCoachLoading: taskCoach.isLoading,
taskCoachMessages: taskCoach.messages,
taskCoachWasCancelled: taskCoach.wasCancelled,
taskCoachHadError: taskCoach.hadError,
taskCoachStreamSpeed: taskCoach.streamSpeed,
taskCoachBackoffSecs: taskCoach.backoffSecs,
requestTaskCoach: (p: WebhookPayload) => taskCoach.request(p),
cancelTaskCoach: taskCoach.cancel,
retryTaskCoach: taskCoach.retry,
clearTaskCoach: () => { taskCoach.clear(); activeSkill.value = null; ignoredSkillId.value = null },

// Explore channel
isExploreCoachLoading: exploreCoach.isLoading,
exploreCoachMessages: exploreCoach.messages,
exploreCoachWasCancelled: exploreCoach.wasCancelled,
exploreCoachHadError: exploreCoach.hadError,
exploreCoachStreamSpeed: exploreCoach.streamSpeed,
exploreCoachBackoffSecs: exploreCoach.backoffSecs,
requestExploreCoach: (p: WebhookPayload) => exploreCoach.request(p),
cancelExploreCoach: exploreCoach.cancel,
retryExploreCoach: exploreCoach.retry,
clearExploreCoach: () => exploreCoach.clear(),

// Per-channel restore from history
restoreTaskCoachMessages: (records: CoachHistoryRecord[]) =>
  _restoreInto(taskCoach, records, 'task'),
restoreExploreCoachMessages: (records: CoachHistoryRecord[]) =>
  _restoreInto(exploreCoach, records, 'explore'),

// Back-compat (read-only, resolves to active mode's channel)
isCoachLoading: computed(() => activeCoach.value.isLoading.value),
coachMessages: computed(() => activeCoach.value.messages.value),
coachResponse: computed(() => {
  const msgs = activeCoach.value.messages.value
  const last = msgs[msgs.length - 1]
  return last?.role === 'assistant' && last.content
    ? { markdown_msg: last.content, message: last.content }
    : activeCoach.value.response.value
}),
coachWasCancelled: computed(() => activeCoach.value.wasCancelled.value),
coachHadError: computed(() => activeCoach.value.hadError.value),
coachStreamSpeed: computed(() => activeCoach.value.streamSpeed.value),
coachBackoffSecs: computed(() => activeCoach.value.backoffSecs.value),
```

Add the shared restore helper near the top of `useLLM()` (after `buildUserMessage`):

```ts
function _restoreInto(
  flow: ReturnType<typeof createStreamFlow>,
  records: CoachHistoryRecord[],
  channel: 'task' | 'explore'
) {
  flow.clear()
  if (channel === 'task') { activeSkill.value = null; ignoredSkillId.value = null }
  for (const r of records) {
    flow.messages.value.push({
      id: nextMsgId(), role: r.role, content: r.content,
      timestamp: r.timestamp, hashId: r.id,
    })
  }
  if (records.length && records[0].sessionId) {
    setSessionId(channel, records[0].sessionId)
  }
}
```

Add imports at top of `useLLM.ts`:

```ts
import { addRecord, currentSessionId, setSessionId } from '@/composables/useCoachHistory'
```

(Replace the existing `import { addRecord, currentSessionId } from ...` line; `setSessionId` was added in Task 1.)

Delete the now-unused old `coach`, `coachResponseCompat`, and the old `requestCoach/cancelCoach/retryCoach/clearCoachResponse/restoreCoachMessages` entries.

- [ ] **Step 6: Run channel test — verify pass**

Run: `npx vitest run src/composables/__tests__/useLLM.channels.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Type-check**

Run: `npm run build`
Expected: TS errors ONLY in `App.vue` (uses removed `requestCoach`/`restoreCoachMessages`) — fixed in Task 5. No errors inside `useLLM.ts`. If other files reference removed names, note them for Task 5.

- [ ] **Step 8: Commit (checkpoint)**

Stage: `git add src/composables/useLLM.ts src/composables/__tests__/useLLM.channels.test.ts`
Message: `feat: split coach into independent task/explore channels`

---

## Task 3: i18n strings for the Explore composer

**Files:**
- Modify: `src/i18n/en.ts`, `src/i18n/zh.ts`

- [ ] **Step 1: Add keys under the `coach` block (en.ts)**

After the `downloadMd:` line added in v10.95, insert:

```ts
    explorePlaceholder: 'Ask anything…  (Enter to send, Shift+Enter for newline)',
    exploreSend: 'Send',
    exploreStop: 'Stop',
    exploreNewChat: 'New chat',
    exploreEmpty: 'Free-form AI chat — ask anything, anytime.',
```

- [ ] **Step 2: Add the same keys (zh.ts), translated**

```ts
    explorePlaceholder: '问我任何问题…（回车发送，Shift+回车换行）',
    exploreSend: '发送',
    exploreStop: '停止',
    exploreNewChat: '新对话',
    exploreEmpty: '自由 AI 对话 —— 随时提问任何话题。',
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: no new errors from i18n (runtime `t()` lookup, no compile-time key check).

- [ ] **Step 4: Commit (checkpoint)**

Stage: `git add src/i18n/en.ts src/i18n/zh.ts`
Message: `feat: i18n strings for Explore chat composer`

---

## Task 4: ExploreChat single-column component

**Files:**
- Create: `src/components/chat/ExploreChat.vue`
- Test: `src/components/chat/__tests__/ExploreChat.test.ts` (create)

- [ ] **Step 1: Write the failing component test**

Create `src/components/chat/__tests__/ExploreChat.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'

const storage: Record<string, string> = {}
beforeAll(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
  } as Storage
})

import ExploreChat from '../ExploreChat.vue'
import type { ChatMessage } from '@/types/api'

const msgs: ChatMessage[] = [
  { id: 'u1', role: 'user', content: 'hi', timestamp: 1 },
  { id: 'a1', role: 'assistant', content: 'hello', timestamp: 2 },
]

describe('ExploreChat', () => {
  it('renders messages and emits send with composer text, then clears', async () => {
    const wrapper = mount(ExploreChat, {
      props: { messages: msgs, isLoading: false, hadError: false, backoffSecs: 0 },
      global: { stubs: { ChatBubble: { template: '<div class="bubble">{{ message.content }}</div>', props: ['message','hashId'] } } },
    })
    expect(wrapper.findAll('.bubble')).toHaveLength(2)

    const ta = wrapper.get('textarea')
    await ta.setValue('what is OS load estimation')
    await wrapper.get('.explore-send').trigger('click')

    expect(wrapper.emitted('send')?.[0]).toEqual(['what is OS load estimation'])
    expect((ta.element as HTMLTextAreaElement).value).toBe('')
  })

  it('Enter sends, Shift+Enter does not', async () => {
    const wrapper = mount(ExploreChat, {
      props: { messages: [], isLoading: false, hadError: false, backoffSecs: 0 },
      global: { stubs: { ChatBubble: true } },
    })
    const ta = wrapper.get('textarea')
    await ta.setValue('q1')
    await ta.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.emitted('send')).toBeFalsy()
    await ta.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('send')?.[0]).toEqual(['q1'])
  })

  it('shows Stop while loading and emits cancel', async () => {
    const wrapper = mount(ExploreChat, {
      props: { messages: [], isLoading: true, hadError: false, backoffSecs: 0 },
      global: { stubs: { ChatBubble: true } },
    })
    await wrapper.get('.explore-stop').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run it — verify failure**

Run: `npx vitest run src/components/chat/__tests__/ExploreChat.test.ts`
Expected: FAIL (component does not exist).

- [ ] **Step 3: Create `src/components/chat/ExploreChat.vue`**

```vue
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

// Autoscroll to newest as content streams in.
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
```

- [ ] **Step 4: Run it — verify pass**

Run: `npx vitest run src/components/chat/__tests__/ExploreChat.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit (checkpoint)**

Stage: `git add src/components/chat/ExploreChat.vue src/components/chat/__tests__/ExploreChat.test.ts`
Message: `feat: single-column ExploreChat component`

---

## Task 5: Wire App.vue — route channels, render ExploreChat, split persistence

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/panels/CoachPanel.vue` (history filtered to task — only if it reads global history directly; otherwise skip)

- [ ] **Step 1: Update the `useLLM()` destructure (App.vue ~351-359)**

Replace the coach names with channel names + keep back-compat reads:

```ts
const {
  // task channel
  isTaskCoachLoading, taskCoachMessages, taskCoachWasCancelled, taskCoachHadError,
  taskCoachStreamSpeed, taskCoachBackoffSecs,
  requestTaskCoach, cancelTaskCoach, retryTaskCoach, clearTaskCoach, restoreTaskCoachMessages,
  // explore channel
  isExploreCoachLoading, exploreCoachMessages, exploreCoachWasCancelled, exploreCoachHadError,
  exploreCoachStreamSpeed, exploreCoachBackoffSecs,
  requestExploreCoach, cancelExploreCoach, clearExploreCoach, restoreExploreCoachMessages,
  // back-compat (read-only, active mode)
  isCoachLoading, coachResponse, coachMessages, coachWasCancelled, coachHadError,
  coachStreamSpeed, coachBackoffSecs,
  // analyze (unchanged)
  isAnalyzeLoading, analyzeResponse, previousAnalyzeResponse, analyzeWasCancelled, analyzeHadError,
  analyzeStreamSpeed, analyzeBackoffSecs,
  requestAnalyze, cancelAnalyze, retryAnalyze, clearAnalyzeResponse,
  isDeepReview, requestDeepReview
} = useLLM()
```

- [ ] **Step 2: Add the Explore composer handler + route Task coach**

Add an explore send handler and keep `handleCoachRequest` for Task. Find `async function handleCoachRequest` (App.vue ~741) and change its `requestCoach(payload)` call to the task channel, and add the explore handler right after it:

```ts
// Task channel only (Task mode "Coach" button).
const err = await requestTaskCoach(payload)
```

```ts
// Explore channel — own composer text, DOES NOT touch form.description.
async function handleExploreSend(text: string) {
  if (!text.trim() || isExploreCoachLoading.value) return
  errorMessage.value = ''
  const payload = buildPayload('coach')
  payload.data.description = text          // override: composer text, not the task draft
  const err = await requestExploreCoach(payload)
  if (!err) {
    saveResponsesToStorage()
  } else if (err !== 'cancelled') {
    errorMessage.value = err
    addToast('error', err)
  }
}
function handleExploreNewChat() {
  clearExploreCoach()
  startNewSession('explore')
}
```

Add import in App.vue script: `import { startNewSession } from '@/composables/useCoachHistory'` (if not already imported).

Remove the Explore-mode branch that cleared `form.description`/`detachFile()` inside `handleCoachRequest` (Explore no longer routes through it).

- [ ] **Step 3: Split last-response persistence**

Find `LS_COACH_RESPONSE` usage (App.vue ~539 save, ~578 restore). Replace single-key logic with two keys:

```ts
const LS_TASK_RESPONSE = 'task-last-response'
const LS_EXPLORE_RESPONSE = 'explore-last-response'
```

Save (in `saveResponsesToStorage`, where it currently writes `coachMessages`):

```ts
if (taskCoachMessages.value.length > 0)
  localStorage.setItem(LS_TASK_RESPONSE, JSON.stringify(taskCoachMessages.value))
if (exploreCoachMessages.value.length > 0)
  localStorage.setItem(LS_EXPLORE_RESPONSE, JSON.stringify(exploreCoachMessages.value))
```

Restore (where it currently does `coachMessages.value = parsed`):

```ts
try {
  const tRaw = localStorage.getItem(LS_TASK_RESPONSE)
  if (tRaw) taskCoachMessages.value = JSON.parse(tRaw)
  const eRaw = localStorage.getItem(LS_EXPLORE_RESPONSE)
  if (eRaw) exploreCoachMessages.value = JSON.parse(eRaw)
} catch { /* ignore corrupt cache */ }
```

(Keep reading the legacy `coach-last-response` once and migrating into `task-last-response` if present, then remove it, so existing users don't lose their last task conversation.)

- [ ] **Step 4: Route the existing history restore/replay to the task channel**

Where App.vue calls `restoreCoachMessages(records)` (~850, replay/continue from CoachPanel history), change to `restoreTaskCoachMessages(records)`. Any `clearCoachResponse()` → `clearTaskCoach()`; `cancelCoach`/`retryCoach` used by Task UI → `cancelTaskCoach`/`retryTaskCoach`.

- [ ] **Step 5: Render ExploreChat full-width in Explore mode**

In the `<main>` template: render `ExploreChat` instead of the `grid-layout` split when `appMode === 'explore'` (mirror the View-mode `v-if` pattern at App.vue:34). Keep `grid-layout` for Task; it no longer needs `layout-focus`.

```vue
<QualityGridPanel v-if="appMode === 'view'" />

<ExploreChat
  v-else-if="appMode === 'explore'"
  :messages="exploreCoachMessages"
  :is-loading="isExploreCoachLoading"
  :had-error="exploreCoachHadError"
  :backoff-secs="exploreCoachBackoffSecs"
  @send="handleExploreSend"
  @cancel="cancelExploreCoach"
  @new-chat="handleExploreNewChat"
/>

<div
  v-show="appMode === 'task'"
  class="grid-layout"
  ref="gridRef"
  :style="gridStyle"
>
  <!-- existing LEFT/CENTER/RIGHT columns unchanged -->
</div>
```

Update the `<CoachPanel>` props in the LEFT column to the **task** channel names:
`:messages="taskCoachMessages"`, `:is-loading="isTaskCoachLoading"`,
`:was-cancelled="taskCoachWasCancelled"`, `:had-error="taskCoachHadError"`,
`:stream-speed="taskCoachStreamSpeed"`, `:backoff-secs="taskCoachBackoffSecs"`,
`@cancel="cancelTaskCoach"`, `@retry="handleCoachRetry"` (ensure `handleCoachRetry` calls `retryTaskCoach`).

Add `import ExploreChat from '@/components/chat/ExploreChat.vue'`. Remove the now-dead `layout-focus` class binding and its `.grid-layout.layout-focus` CSS rules (App.vue ~998-1004, 1029-1032) and the explore-only `v-show` on the right column/handle (no longer rendered in explore).

- [ ] **Step 6: CoachPanel history scoping (only if it reads global history)**

If `CoachPanel.vue` imports `coachHistory`/`searchRecords` directly, change its source to `recordsForChannel('task')` (import from `useCoachHistory`). If it only receives `messages` via props, no change needed — note which and proceed.

- [ ] **Step 7: Type-check + full build**

Run: `npm run build`
Expected: clean (no TS errors). Fix any remaining references to removed `requestCoach`/`coach*` write APIs by routing to the correct channel.

- [ ] **Step 8: Full test suite**

Run: `npx vitest run`
Expected: all green EXCEPT the pre-existing 3 `formatCoach.test.ts` failures. New Task 1/2/4 tests pass. If any other test referenced `requestCoach`/`restoreCoachMessages`, update it to the channel API.

- [ ] **Step 9: Commit (checkpoint)**

Stage: `git add src/App.vue src/components/panels/CoachPanel.vue`
Message: `feat: route Task/Explore to independent channels; render single-column ExploreChat`

---

## Task 6: Manual verification + post-change checklist

**Files:**
- Modify: `src/components/layout/AppHeader.vue`, `PLAN.md`, `MEMORY.MD`

- [ ] **Step 1: Manual end-to-end (the acceptance scenario)**

Run `npm run dev:all`. In Task mode, enter a task description and click Coach; while it is streaming, switch to Explore mode and send *"what is OS load estimation"*. Verify:
- both stream concurrently; each surface shows only its own conversation;
- switching back to Task shows the task coaching intact / still streaming;
- the task description field is unchanged;
- reload the page → both channels restore independently;
- toggle ZH locale → composer/labels translated;
- code blocks still show the v10.95 Copy/Download toolbar in Explore.

- [ ] **Step 2: Bump UI version**

In `src/components/layout/AppHeader.vue:11`, bump `v10.95` → `v10.96`.

- [ ] **Step 3: Append PLAN.md changelog**

Append a `## v10.96` section (motivation / changes / not-changed / verification / file matrix) following the existing format, describing the independent Task/Explore channels + single-column ExploreChat.

- [ ] **Step 4: MEMORY.MD architectural note**

Add a note: Task and Explore are independent `createStreamFlow` channels in `useLLM`; `useLLM()` must remain instantiated exactly once in `App.vue` (single-instance is what allows background streaming to survive mode switches); coach history is channel-tagged (legacy untagged = `task`); the Explore composer is decoupled from `form.description`.

- [ ] **Step 5: Final verification**

Run: `npm run build` (clean) and `npx vitest run` (green except the known pre-existing `formatCoach.test.ts`).

- [ ] **Step 6: Commit (checkpoint — ask the user before committing the whole feature)**

Stage all changed files. Proposed message: `feat: v10.96 — independent Task/Explore AI chat channels + single-column Explore chat`.

---

## Self-Review

**Spec coverage:** §3 two flows → Task 2. §3.2 app-singleton/background streaming → Task 5 (single `useLLM()` retained) + Task 6 MEMORY note. §3.3 API shape → Task 2 Step 5. §4 ExploreChat + ChatBubble reuse → Task 4. §4.2 full-width render → Task 5 Step 5. §5 data flow / composer decoupling → Task 5 Step 2. §6 channel history + split persistence + legacy=task → Task 1 + Task 5 Step 3. §7 concurrency/error isolation → Task 2 (per-flow `_ac`) + Task 2 test. §9 testing → Tasks 1/2/4 tests + Task 5 Step 8. §10 verification → Task 6 Step 1. §12 post-change checklist → Task 6.

**Placeholder scan:** No TBD/TODO; every code step shows full code; the only "if it reads global history" conditional (Task 5 Step 6) has explicit both-branch instructions.

**Type consistency:** `CoachChannel` defined in Task 1 Step 1, used in Tasks 1/2. `recordsForChannel`/`addRecord(role,content,channel)`/`startNewSession(channel)`/`setSessionId` defined Task 1, consumed Tasks 2/5. `requestTaskCoach`/`requestExploreCoach`/`exploreCoachMessages`/`cancelExploreCoach`/`clearExploreCoach`/`restoreTaskCoachMessages` defined Task 2 Step 5, consumed Task 5. `ExploreChat` props (`messages`,`isLoading`,`hadError`,`backoffSecs`) and events (`send`,`cancel`,`new-chat`) consistent between Task 4 component and Task 5 Step 5 usage.
