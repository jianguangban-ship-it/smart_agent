# Design Spec — Independent AI Chat Channels for Task & Explore Modes

**Date:** 2026-05-16
**Status:** Approved design, pending spec review → implementation plan
**Topic:** Split the single shared coach pipeline into two independent, concurrent
conversation channels (Task-requirement coaching vs. free Explore chat), and give Explore
mode a single-column Claude/Gemini-style chat surface.

---

## 1. Context & Problem

Today `useLLM()` is instantiated **once** in `App.vue` (line 352) and exposes a single
`coach` flow built by `createStreamFlow({ chatMode: true })` in `src/composables/useLLM.ts`
(lines 397–445). That one flow owns **one** `messages` array, **one** `isLoading`/error
state, and **one** `AbortController`. Task mode and Explore mode both drive this same flow;
only the system prompt differs (`coachSkillEnabled` → task coach skill vs. free-chat
Response Format).

Consequences:

- A user doing task-requirement coaching in **Task mode** who switches to **Explore mode**
  to ask an unrelated question (e.g. *"what is OS load estimation"*) **reuses the same
  conversation and stream** — the task coaching context is polluted or interrupted, and
  there is no way to keep both alive.
- The Explore input is the `TaskForm`'s `DescriptionEditor` (`src/components/form/
  TaskForm.vue:48`) inside a two-column split (`grid-layout.layout-focus`,
  `src/App.vue:998`). It is task-form chrome repurposed as a chat box, not the familiar
  single-column chat with a bottom composer.

### Goal / Intended Outcome

Two **independent** AI conversation channels that can **respond, display, store, and stream
concurrently** without disturbing each other:

- **Task channel** — task-requirement coaching (unchanged behavior/UI).
- **Explore channel** — free-form AI chat on any topic, presented as a single-column
  conversation with a docked bottom composer.

Switching modes never resets, interrupts, or cross-contaminates the other channel. A
request started in one channel keeps streaming in the background while the user works in
the other, and both survive a page reload independently.

### User-confirmed decisions

- **Concurrent streaming** required (both channels may have a live stream simultaneously).
- Explore uses the **single-column chat** layout (conversation + bottom composer).
- Task mode layout/behavior is **unchanged**; only Explore gets the new surface.
- Each channel persists **independently across reloads**.

---

## 2. Non-Goals (YAGNI)

- No generic N-channel framework — exactly two fixed channels.
- No change to the `analyze` / deep-review flows.
- No change to the markdown/sanitizer pipeline, `ChatBubble` rendering, or the v10.95
  code-artifact toolbar (the Explore surface **reuses** `ChatBubble`).
- No live-preview / multi-file artifacts (out of scope, separate feature).
- No server-side changes.

---

## 3. Architecture

### 3.1 Two parallel channels via the existing factory

`createStreamFlow` already isolates per-flow state (`isLoading`, `messages`,
`wasCancelled`, `hadError`, `streamSpeed`, `backoffSecs`, a private `_ac`
`AbortController`, and a private `_backoffTimer`). It was already hardened for concurrent
429s. We instantiate it **twice**:

- `taskCoach = createStreamFlow({ chatMode:true, getSystemPrompt: <current skill/trace
  logic>, getUserMessage: buildUserMessage })`
- `exploreCoach = createStreamFlow({ chatMode:true, getSystemPrompt: () =>
  getResponseFormat(), getUserMessage: (p) => p.data.description || '' })`

Each flow has its **own** `AbortController` and `messages` ref → two concurrent
`fetch`/SSE streams are naturally supported with no new streaming infrastructure. The
prompt strategy is baked into each flow (no `appMode.value` read inside `getSystemPrompt`),
which removes the mode-coupling that forces sharing today.

`coachSkillEnabled` (and `applyModeFlags` in `useAppMode.ts`) remain for **Task-only** UI
affordances (skill ON/OFF chip, `canSubmit` guard, tool handlers). `exploreCoach` ignores
it entirely (always free chat).

### 3.2 App-singleton lifetime = background streaming

`useLLM()` is created once in `App.vue` setup and lives for the app lifetime. Stream-flow
state lives in that closure, **not** in the panel components. Therefore an in-flight
Explore (or Task) stream **keeps running and mutating its `messages` array even while its
panel is unmounted** by a mode switch; returning to that mode re-renders from the
persisted reactive state (including `isStreaming`). This is what makes "don't wait — switch
back later" work.

### 3.3 Public API shape (`useLLM` return)

Replace the single coach surface with two namespaced surfaces while keeping back-compat
shims where call sites are numerous:

- Task: `isTaskCoachLoading`, `taskCoachMessages`, `taskCoachWasCancelled`,
  `taskCoachHadError`, `taskCoachStreamSpeed`, `taskCoachBackoffSecs`,
  `requestTaskCoach()`, `cancelTaskCoach()`, `retryTaskCoach()`,
  `clearTaskCoach()`, `restoreTaskCoachMessages()`.
- Explore: same set with `explore*` names + `requestExploreCoach()` etc.
- Back-compat: keep `coachMessages`/`requestCoach`/… as **aliases that resolve to the
  active mode's channel** only where unavoidable (e.g. `DevTools` payload preview), to
  minimize churn. New code uses the explicit channel.

---

## 4. Components

### 4.1 Explore chat surface (new)

New component `src/components/chat/ExploreChat.vue` (single-purpose, self-contained):

- **Conversation area:** scrollable list of `exploreCoachMessages` rendered with the
  existing `ChatBubble` (so the v10.95 artifact toolbar and markdown pipeline are reused
  unchanged).
- **Composer (docked bottom):** own `ref` input state (`exploreInput`), growing
  `<textarea>`, Enter-to-send / Shift+Enter newline, Send button, and a Stop button while
  `isExploreCoachLoading`. Optionally a lightweight error/retry line driven by
  `exploreCoachHadError`/`exploreCoachBackoffSecs`.
- **No** task fields, Reset, Export, Analyze, or `DescriptionEditor`.

The composer input is **decoupled from `form.description`** — asking an Explore question
mid-task must not modify the task draft.

### 4.2 App layout

- `App.vue`: in Explore mode, render `<ExploreChat />` as a **full-width single column**
  (replace the `layout-focus` two-column split for Explore). Task and View layouts
  unchanged. The `grid-layout`/`col-left/center/right` structure remains for Task mode.
- Task mode continues to use `CoachPanel` + `TaskForm`, now bound to the **task** channel
  props/events.

### 4.3 CoachPanel

`CoachPanel.vue` stays for Task mode, bound to `taskCoach*`. Its existing History tab
shows **task-channel** records only (see §6). The Explore surface gets a **"New chat"
reset** (clears `exploreCoachMessages`, starts a new Explore session) plus a
channel-filtered history list reusing the same `useCoachHistory` mechanism. History data
is channel-scoped from day one.

---

## 5. Data Flow

**Task coaching (unchanged path):** `TaskForm` "Coach" → `App.handleCoachRequest` →
`buildPayload('coach')` (structured) → `requestTaskCoach(payload)` → `taskCoach` streams
into `taskCoachMessages`.

**Explore chat (new path):** `ExploreChat` composer Send → `App` handler builds a
free-chat payload (`data.description = exploreInput`, no task fields) →
`requestExploreCoach(payload)` → `exploreCoach` streams into `exploreCoachMessages`. The
Explore `getUserMessage` returns the raw composer text; `getSystemPrompt` returns
`getResponseFormat()` only.

Skill auto-detection (`matchSkill`) and trace context apply to **Task** channel only
(its `getSystemPrompt`), exactly as the current `coach` flow does when
`coachSkillEnabled` is true.

---

## 6. Persistence & History

`useCoachHistory.ts` is a module singleton with one `coach-history` localStorage key and
`addRecord()` (called from `useLLM`). To make channels independent with minimal surface
area:

- Add `channel: 'task' | 'explore'` to `CoachHistoryRecord` (`src/types/api.ts`).
- `addRecord(role, content, channel)` writes the channel; one storage key, records
  tagged. History views filter by channel. Per-channel `currentSessionId` (a small map or
  two refs) so sessions don't interleave across channels.
- App-level last-response persistence (currently `LS_COACH_RESPONSE` in `App.vue:539–578`)
  is **split** into `task-last-response` and `explore-last-response`; each restores its
  channel's `messages` on mount independently.
- `restore*CoachMessages()` filters history by channel.
- Legacy `coach-history` records with no `channel` are treated as `task` (back-compat).

---

## 7. Concurrency & Error Handling

- Each channel has its own `AbortController`, `isLoading`, `wasCancelled`, `hadError`,
  `streamSpeed`, `backoffSecs`, and 429 `_backoffTimer`. These are already per-flow in
  `createStreamFlow`; instantiating twice yields full isolation.
- Cancel/Stop in one channel calls only that flow's `cancel()`; the other keeps streaming.
- A 429 backoff/retry loop in one channel does not touch the other.
- Two simultaneous `fetch` SSE streams are within browser limits (well under per-host
  connection caps).

---

## 8. File-Level Change Summary

| File | Change |
|------|--------|
| `src/composables/useLLM.ts` | Replace single `coach` with `taskCoach` + `exploreCoach` (two `createStreamFlow` instances); split public API into `task*`/`explore*`; back-compat aliases; channel passed to `addRecord` |
| `src/composables/useCoachHistory.ts` | `channel` field + channel-filtered selectors; per-channel session tracking; legacy = `task` |
| `src/types/api.ts` | `CoachHistoryRecord.channel: 'task' \| 'explore'` |
| `src/components/chat/ExploreChat.vue` | **New** — single-column conversation + docked composer (reuses `ChatBubble`) |
| `src/App.vue` | Wire two channels; Explore renders full-width `<ExploreChat>`; split last-response persistence keys; route Task handlers to task channel |
| `src/components/panels/CoachPanel.vue` | Bind to task channel; history filtered to task |
| `src/components/form/TaskForm.vue` | No longer the Explore input (Explore no longer renders TaskForm) |
| `src/i18n/en.ts`, `src/i18n/zh.ts` | Explore composer strings (placeholder, send, stop) — bilingual |
| `src/components/layout/AppHeader.vue` | Version bump (post-change checklist) |
| `PLAN.md`, `MEMORY.MD` | Changelog + architectural note (post-change checklist) |

## 9. Testing

- **Unit (`useLLM`):** with a mocked `callStream`, drive `taskCoach` and `exploreCoach`
  concurrently → assert isolated `messages`, `isLoading`, and that cancelling one leaves
  the other streaming; assert Explore `getUserMessage` returns raw composer text and
  `getSystemPrompt` is Response-Format-only.
- **Unit (history):** records tagged by channel; channel-filtered selectors; legacy
  untagged record reads as `task`.
- **Component (`ExploreChat`):** composer Enter sends & clears; Shift+Enter newline;
  Stop calls `cancelExploreCoach`; messages render via `ChatBubble`.
- **Regression:** full `npx vitest run` stays green except the pre-existing, unrelated
  `formatCoach.test.ts` failures (must not regress others).

## 10. Verification (end-to-end)

`npm run build` clean; `npx vitest run` green (modulo the known pre-existing failures).
Manual: in Task mode start a task-coach stream; before it finishes switch to Explore and
send *"what is OS load estimation"*; confirm (a) both stream concurrently, (b) each panel
shows only its own conversation, (c) switching back shows the task coaching intact/still
streaming, (d) the task description field was untouched, (e) reload restores both
channels independently, (f) ZH locale strings correct.

## 11. Risks & Mitigations

- **Many existing call sites use `coachMessages`/`requestCoach`.** Mitigation:
  back-compat aliases resolving to the active channel for read-only consumers
  (`DevTools`); migrate write/control sites explicitly to the correct channel.
- **History migration.** Mitigation: untagged legacy records default to `task`; no
  destructive migration.
- **App-singleton assumption.** If `useLLM()` were ever instantiated more than once,
  background streaming isolation breaks. Mitigation: assert/maintain the single
  instantiation in `App.vue`; document in `MEMORY.MD`.

## 12. Post-change checklist (per CLAUDE.md)

Bump `header-version` in `AppHeader.vue`; append a `## vX.XX` section to `PLAN.md`; add
an architectural note to `MEMORY.MD`. **No auto-commit** (user rule overrides the
brainstorming skill's commit step) — spec and code committed only when the user asks.
