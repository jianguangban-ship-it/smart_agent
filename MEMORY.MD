# MEMORY — smart_agent_plus

A short log of non-obvious architectural decisions and the *why* behind them.
This file is for context that is **not derivable from the code or git history**.

## Modes (`useAppMode.ts`)

The app has three top-level modes, switched from the header:

| Mode | Purpose | Layout | LLM? |
|------|---------|--------|------|
| **Task** | Author a JIRA ticket via guided AI coaching + analysis. | 3 columns (Coach \| Form \| Review/JIRA) | Yes — coach skill ON |
| **Explore** | Free-chat AI for brainstorming, with no form. | 2 columns (Coach \| Description) | Yes — coach skill OFF |
| **View** | Read-only browse of AI quality-check verdicts pushed by n8n. | Full-width grid | No |

`applyModeFlags` drives `coachSkillEnabled` — only Task uses the structured task-coach skill.

## View mode + backend (v10.90)

The View mode is fed by a **same-repo backend** (Fastify + SQLite at `server/`),
not by an external service. Decision rationale:

- **Single-origin deploy** (one Node process serves `/` SPA + `/api/*`) keeps the spec §7 promise of zero CORS handling.
- **SQLite, not Postgres**, because steady-state write rate is "a handful of POSTs per minute" (spec §7). The upsert SQL is portable; swapping to Postgres is a one-day change if volume ever climbs.
- **`view.statusDrift` gray (`#808080`) is intentional** — when n8n sends a status string that's not in the canonical A/B/C/D/格式异常/未知 taxonomy, the badge renders gray. This is the **drift signal** for the operator: the upstream AI prompt has drifted and needs fixing in the n8n workflow, not papered over with a silent default to green. See spec §3.3.
- **DOMPurify allow-list extension** (`<font>` tag + `color` attribute) is required because the quality-check agent embeds the badge as `<font color="#32CD32">**A**</font>`. Without this, all badges render colorless.

n8n's workflow lives at `E:\n8n-code-JavaScripts\`. The endpoint spec is `http-port-design.MD`.

## n8n contract gotchas (v10.92)

The spec at `E:\n8n-code-JavaScripts\http-port-design.MD` has an apparent
contradiction between §3.2 ("status enum is strict — reject anything else
with 400") and §3.3 ("render off-taxonomy values gray — that's the drift
signal"). The implementation resolved this by putting the strict enum on
the receiver (`server/schemas.ts`) and the **fallback to canonical `未知`
on the producer** (`Final-Message-Merge.java`). The drift signal is real —
it's the gray badge — but it only happens when n8n falls back to `未知`
because the upstream parse failed, not because the receiver permitted an
arbitrary string. **Do not "fix" the receiver to permit non-canonical
status values** — that would let real prompt drift slip through silently.

Other producer-side fallbacks are non-negotiable for the same reason:
`issueType` must default to `"未知"` (server requires `minLength: 1`),
and `points` must be coerced via `Number(...)` because some JIRA plugin
configs return story points as a string.

The HTTP Request node downstream of `Final-Message-Merge` MUST send
`={{ $json.task }}` as the body, not `={{ $json }}` — the Code node
returns `{ ...dingMessage, task }` so DingTalk and the Quality Grid can
consume the same node output. This is documented in spec §10.

The per-request log line in `server/index.ts` (onResponse hook) is the
operator's primary debugging surface for "n8n posted but I don't see the
row." Look for `code: 400` lines with `validation: [...]` to find what
the schema rejected.

## Timing-phase quality review (v10.94)

View mode can review ticket quality over a timing phase. Key decisions worth
remembering:

- The phase axis is **`event_time`** (n8n verdict time), NOT `updated_at`.
  `updated_at` is `CURRENT_TIMESTAMP` on every upsert, so it would yank a
  ticket into a different bucket on any unrelated re-post. Don't "fix" the
  trend to use `updated_at`.
- Date filtering is **server-side** (`GET /api/tickets?from=&to=`, indexed
  `event_time`); team/status/search remain client-side. The summary +
  per-team trend matrix describe the *whole* date-filtered set, deliberately
  independent of the status/search filters (full A–D split for retros).
- The trend is a **snapshot model** (each ticket's latest verdict, no history
  table). It cannot reconstruct "what Sprint S2 looked like back then" if a
  ticket was re-checked later. The documented upgrade path is an append-only
  assessment-history table — do not add it speculatively.
- `useTimingPhase` shares `useSprint`'s exported `now` ref so sprint and
  calendar presets stay on one clock and one `_setNowForTesting` seam.
- Sprint presets reuse `sprintSchedule.ts` (`getPreviousSprint`,
  `sprintsInPI`); no separate schedule for View mode.
- View mode keeps the panel-card framing (`.quality-panel`: border / shadow /
  radius / `min-height`). A v10.95 attempt to flatten it into a full-page
  dashboard was reviewed and reverted — the user preferred the v10.94 card
  look. Don't re-attempt the flatten without an explicit new request.

## Chat file artifacts (v10.95)

Chat code blocks get a Copy/Download toolbar; markdown-as-prose gets a
message-level Download .md / Copy. Implementation rules to preserve:

- The enhancer (`src/utils/codeArtifact.ts`) operates on the **rendered DOM
  after v-html**, never on the markdown string. Do NOT move toolbar markup into
  `markdown.ts`/`formatCoach.ts` or into the DOMPurify-sanitized HTML — the
  pipeline stays pure (AST-over-regex rule) and the sanitizer stays decoupled.
- `v-html` wipes the subtree on every (RAF-throttled) streaming render, so
  `enhanceCodeBlocks` is re-run each render (idempotent per `data-artifact`).
  Click handling is a **single delegated listener** on the stable
  `.coach-response` element in `ChatBubble.vue` — not per-button listeners.
- Toolbar CSS must live in `src/styles/coach-response.css` (global/unscoped)
  because it is injected inside v-html content; ChatBubble scoped styles can't
  reach it. The message-level footer IS real template → ChatBubble scoped.
- Decisions: copy/download only (no iframe preview), all fenced blocks, all
  ChatBubble usages (Explore + Task). Don't add live preview without an
  explicit new request.

## AST-based parsing (v8.40–v8.42)

Markdown + math rendering uses the unified/remark/rehype pipeline, NOT regex.
The pre-v8.40 regex-based approach passed every unit test but failed in
production on real LLM streaming output (whitespace, encoding, multiline
edge cases). See `src/utils/markdown.ts`. Any new structured-text parsing in
this repo should follow the same rule: use a proper parser, not regex.

## Bilingual rendering

All UI must work in EN and ZH. Math + markdown specifically: Chinese text has
no space between content and `$` delimiters (`横向加速度$a_y$`), full-width
punctuation can sit adjacent to delimiters, and mixed EN/ZH paragraphs are
the norm in coach output. The `mathRendering.test.ts` bilingual section guards this.

## Version + changelog discipline

- UI version is in `src/components/layout/AppHeader.vue` (the `<span class="header-version">vX.YY</span>` line). Bump per feature.
- Every change appends a `## vX.YY` section to `PLAN.md` (motivation → changes → not-changed → verification → file matrix).
- `package.json` `version` is NOT bumped — UI versioning lives in the header span.

## Independent Task & Explore channels (v10.96)

- Task and Explore are **two independent `createStreamFlow` channels** in `useLLM`
  (`taskCoach` / `exploreCoach`), each with its own messages, streaming state, and
  `AbortController`. This is what lets them **stream concurrently** — an in-flight
  task answer keeps running while an Explore question is asked and streamed.
- `useLLM()` MUST remain instantiated **exactly once**, in `App.vue`. The single
  instance is precisely what keeps an in-flight stream alive while its panel is
  unmounted on a mode switch. Do **not** call `useLLM()` anywhere else.
- Coach history is **channel-tagged**. Legacy untagged records read as `task`
  (`r.channel ?? 'task'`). Last-response persistence is per channel
  (`task-last-response` / `explore-last-response`); the legacy
  `coach-last-response` key migrates **once** into the task channel.
- The Explore composer is **decoupled from `form.description`** — asking a question
  in Explore must never mutate the task draft.
- `useLLM.ts` has a deliberate hoisted-`var` + `getCoachSkillRef()` lazy singleton
  to break a `useLLM` ↔ `useAppMode` circular-import TDZ. It is guarded with
  `// eslint-disable-line no-var`. Do **not** "modernize" it to `let` / `const` —
  that reintroduces the crash.
- `handleReset` is **channel-isolated**: resetting one mode never cancels or clears
  the other channel's in-flight stream.

## Explore-mode UX (v10.97)

- `ChatBubble.vue` has an opt-in `layout` prop: `'bubble'` (default — side avatar,
  left/right; **Task mode**) vs `'stacked'` (full-width vertical turns, inline avatar
  in the role-label row; **Explore**). Keep the single `responseEl` content block —
  the v10.95 artifact toolbar's delegated listener binds to it; don't duplicate it.
- `CoachHistoryTab.vue` takes a `channel` prop (default `'task'`). Explore passes
  `'explore'`. It is reused as-is by both Task (`CoachPanel`) and Explore
  (`ExploreChat`) — the only channel-scoping is the `recordsForChannel(props.channel)`
  read boundary; `clearHistory` is still **global** (deletes all channels — same as
  Task; known parity, not a bug to "fix" without intent).
- Explore is bounded by the `app-main--explore` modifier in `App.vue`
  (no vertical padding, `overflow:hidden`, `min-height:0`) so only the message list
  scrolls and the composer stays pinned. Don't reintroduce vertical padding/growth on
  `.app-main` for Explore or the page will scroll and the composer will drift.
- ExploreChat autoscroll **sticks to bottom only when the user is near the bottom**
  (`scrollHeight - scrollTop - clientHeight < 40`); preserve this so streaming doesn't
  yank a user who scrolled up to read earlier messages.
- (v10.98) Explore's viewport lock is **definite-height**: the root `.app` gets
  `app--explore-lock` (`height:100dvh; overflow:hidden`) only when
  `appMode === 'explore'`. The base `.app`/`body` use `min-height:100vh` (other
  modes need to grow) — do **not** "simplify" Explore back to relying on that
  min-height chain; the definite height is what guarantees the page never scrolls
  and the composer stays pinned. `ExploreChat.onNewChat()` also resets local
  composer state (draft, textarea height, scroll, stick) so a new chat opens clean.

## Task-mode composer pinning (v10.101)

- The viewport lock is **shared by Explore and Task**, not Explore-only (updates
  the v10.98 note above). `App.vue` groups `.app--explore-lock, .app--task-lock`
  and `.app-main--explore, .app-main--task` — same `100dvh; overflow:hidden` /
  zero-vertical-padding rules. Don't "simplify" either mode back to the
  `min-height:100vh` chain; the definite height is what keeps the page from
  scrolling. View mode still grows normally (no lock class).
- The Task "TASK DESCRIPTION" composer is pinned via **`PanelShell`'s `#footer`
  slot**, which renders *outside* the scrollable `.panel-body`. Because the
  composer is not inside `.panel-body`, CoachPanel's `.panel-body`-bound smart
  autoscroll needed **no change** — reuse the footer slot for any future pinned
  panel control rather than restructuring the scroller.
- `form.description` is still the **single source of truth** for
  Coach/Analyze/Create. The composer (`CoachPanel` `v-model:description`) and the
  center-column Analyze/Create buttons read/write the same field — do not fork it
  into a separate chat-input state.
- `DescriptionEditor` has a `variant` prop: `'form'` (default — title + border,
  used nowhere-else-changed) vs `'composer'` (compact, auto-grow capped 200px,
  Ctrl/Cmd+Enter emits `submit`). Plain Enter inserts a newline by design — the
  task description is long-form, not chat turns; don't add Enter-to-send.
- Under the Task lock the **center column scrolls internally** (`.form-scroll`)
  with `.form-actions` pinned at its bottom; `.col-right` is `overflow-y:auto`
  (it's intentionally NOT in the `.col-left/.col-center > :deep(*)` flex-children
  selector). Don't reintroduce page growth on `.app-main` for Task.
- **Unit-test gotcha:** a literal `<img src="/public-asset.png">` makes
  `@vitejs/plugin-vue` static-asset-transform throw under vitest/jsdom
  (`ERR_INVALID_ARG_VALUE … file:///…`), failing the whole suite at *transform*
  time (0 tests). CoachPanel's typing avatar is now `:src="AGENT_AVATAR"` const
  to stay testable — bind public-path image `src` (don't use a string literal)
  in any component that needs a unit test.

## Task right-column cleanup (v10.102)

- **JiraSearch feature fully removed** (JiraSearchPanel + `useJiraSearch`): no
  duplicate-check / parent-req search / sprint context anywhere in the app. View
  mode does NOT cover this. If reintroducing, prefer adding it to View mode.
- **ReviewDashboard panel removed, but `useReviewHistory` is intentionally
  KEPT.** It is NOT dead code: `addReviewRecord` (called in `confirmCreate`) +
  `buildLearningContext()` feed a "Historical Review Patterns" block into the
  Analyze/Deep-Review system prompts (`useLLM.ts`). Do not "dead-code"-remove
  `useReviewHistory` just because its only UI is gone — that silently degrades
  AI quality over time.
- `form.parentReqId` now has a **plain manual text input** in
  `BasicInfoSection` (`#basic-parent-req`). It still feeds `getModeTraceGaps`
  traceability checks, the `parent_req_id` payload, and exports — keep an input
  for it; it has no other UI now (besides batch-CSV import).

## DevTools removed; slim Agent strip (v10.103)

- **DevTools panel fully removed** (payload viewer, raw-coach viewer, active
  webhook, agent state). `jsonPayload` (App.vue computed) is **still needed** —
  the create-confirm modal renders it via `<JsonViewer :data="jsonPayload"/>`;
  do not delete it as "DevTools dead code".
- The slim agent info lives in `src/components/form/AgentInfo.vue`, rendered in
  `TaskForm` after `SummaryBuilder` (bottom of the middle column, under the
  Live Preview / `QualityMeter`). It is **self-contained**: model from
  `@/config/llm` `currentModel`, role from `useRole` `currentRoleDefinition`,
  skill from `useLLM` `activeSkill` — only `jiraResponse` is plumbed
  App → TaskForm → AgentInfo. Don't reintroduce prop plumbing for model/role/skill.
- Now-unused `dev.*` i18n keys are intentionally **left in place** (no pruning
  — harmless, avoids churn). Removed DevTools-only App.vue bindings:
  `activeModel`/`getModel`, `analyzeSkillModified`, `customTemplatesModified`.

## Task Analysis is now CoachPanel's Analysis tab (v10.104)

- `CoachPanel` tabs are **Chat | Analysis | History** (Analysis is
  `appMode === 'task'`-only). The Analysis tab renders a **`#analysis` named
  slot** — `App.vue` still owns all analyze state and passes
  `<AIReviewPanel>` into that slot. **Do not re-plumb analyze props through
  CoachPanel**; only `:is-analyzing` is passed (CoachPanel `watch`es it to
  auto-switch to the Analysis tab when an analyze run starts).
- `AIReviewPanel` is **de-chromed**: no `<details>`/collapse, no own panel
  border/background, no `max-height/overflow` on `.review-body` — it relies on
  CoachPanel's `PanelShell .panel-body` for the box + scroll. Don't reintroduce
  a wrapper panel/scroller (double box / double scrollbar).
- The right column is now **TicketHistory + Batch only**. No Task-Analysis
  history/persistence (deep-review perspective sub-tabs remain inside the
  analysis view). Tab order matters for tests: indices 0/1/2 = Review/Analysis/History.
- (v10.105) Task first tab is **`coach.tabReview`** ('Review' / '评审'), NOT
  `coach.tabChat` — `coach.tabChat` is still used by `ExploreChat`; **do not
  merge these two keys**. `PanelShell` has a `hideHeader` prop (+
  `panel-body--flush` full-radius); CoachPanel sets it true on
  **all Task tabs** (`:hide-header="appMode === 'task'"`) — Review, Analysis,
  History are all header-less "pure pages". (CoachPanel is task-only; Explore
  uses ExploreChat.) Don't re-scope `hide-header` back to Analysis-only or
  reintroduce the PanelShell title/model badge/status/copy in Task mode.
- "Pure page" also needed `AIReviewPanel`'s **own** chrome gone: no
  `.review-toolbar` title / `currentModel` LLM badge, no `.review-body`
  `border-top`; the toolbar renders only when `response || isAnalyzing` (empty
  "Waiting…" state is bare). PanelShell `hideHeader` alone is NOT enough —
  AIReviewPanel had a second header-like row. Don't reintroduce a title/model
  badge inside AIReviewPanel (the tab label already says "Analysis").

## Task mode is now a 2-column layout (v10.106)

- The right column is **removed**. Task mode = **CoachPanel | TaskForm** only,
  one draggable divider. `colFractions`/`LS_COL_SIZES` is a **2-tuple**
  (default `[1,1]`); a legacy length-3 value in localStorage is ignored (no
  migration). The drag math is single-handle (`offsetWidth - 6`); only
  `startDrag('left')` exists. Don't reintroduce a 3-tuple / second handle.
- `TicketHistoryPanel` + `BatchPanel` now live at the **bottom of TaskForm's
  `.form-scroll`** (after `AgentInfo`, before the pinned `.form-actions`) via
  TaskForm's **`#form-extras` slot**. App.vue still owns their state/handlers
  (Batch's events) — fill the slot from App; don't re-plumb through TaskForm.
- `.col-right` CSS rule still exists but is dead (no element) — harmless;
  don't rely on it.

## Cross-mode AI status (v10.107)

- `App.vue` `isAiBusy` is the **union of all 3 channel loading flags**
  (`isTaskCoachLoading || isExploreCoachLoading || isAnalyzeLoading`), NOT the
  active-channel `isCoachLoading` — keeps the AppHeader top glow accurate when
  the user switches modes mid-stream. Don't revert to `isCoachLoading`.
- `bgReady` ref + watchers flag a mode whose stream finished while it was NOT
  the active `appMode` (task watcher covers both coach AND analyze); the
  `appMode` watcher clears it on arrival. `AppHeader` shows a clickable
  `.reply-chip` (→ `setMode`) only when `readyMode && readyMode !== appMode`.
  Single chip, latest completion wins (no stacking). "Done" = loading flag
  clearing (covers complete/cancel/error).

## Action-trigger tooltip labels (v10.108)

- Composer Send button tooltip = i18n `coach.requestBtnTask` ("Review" /
  "评审"); Analyze button tooltip = `form.aiAnalyze` ("Analysis" / "分析").
  Both keys are **tooltip-only** (`:title` at `CoachPanel.vue:216` and
  `TaskForm.vue:112`) — no visible button-label uses them, so the values can
  be reworded freely without layout impact.

## Explore composer file-loading (v10.109)

- Explore-mode file attachment is centralized in `useAttachment.ts`:
  `applyAttachment(text)` is the **single source of truth** for the prepend
  format and is called from BOTH `buildPayload` (explore case) and
  `handleExploreSend` in `App.vue`. Do not re-inline the prepend string.
- `handleExploreSend` overwrites `payload.data.description`, so any Explore
  payload mutation must go through `applyAttachment` or it will be lost.
- The picker UI lives in `ExploreChat.vue` (not `DescriptionEditor.vue` — its
  `appMode==='explore'` attach branch is unreachable since Explore renders
  `ExploreChat`). Single file, allow-list `ALLOWED_ATTACH_EXTS`, 512 KB cap;
  `.html`/`.json` sent as raw text (no parsing/stripping).
- Attachment is `detach()`-ed only after a successful (non-cancelled) send.

## v10.110 — `app-developer` role
- Roles are a TS union `UserRole` in `src/composables/useRole.ts`. Adding one
  REQUIRES updating every exhaustive `Record<UserRole, …>`: `ROLE_WEIGHTS`
  (`useForm.ts`), `ROLE_QUESTIONS` (`elicitation.task.ts`,
  `elicitation.explore.ts`) — otherwise `tsc`/`npm run build` fails.
- Switch/case role handlers (conflicts, review-perspectives,
  review-workflow.task, trace-impact, traceability.design) all have `default`
  → new roles degrade to generic behavior; no build break, specialize later.
- Layer→Role routing is `LAYER_ROLE_MAP` in `useForm.ts` (NOT useRole). `APP`
  now maps to `app-developer`; `SW`/`SWF` still `sw-developer`.

## v10.111 — layer rename + `devops-engineer`
- Layer codes are now `[SYS, SW, APP, HW, ME, VV, Devops]` (was TEST/SWF).
  Source of truth at runtime = `public/config/summary-options.json`;
  `constants.ts LAYER_OPTIONS` is fallback only.
- Adding a role still requires: `UserRole` union + `ROLES` (useRole.ts),
  `ROLE_WEIGHTS` (useForm.ts), `ROLE_QUESTIONS` x2 (elicitation.task/explore)
  — all exhaustive `Record<UserRole,…>`, else `tsc` fails.
- (Resolved v10.116) TEST skill files were renamed to
  `coach-skill-task-vv-{en,zh}.md` + imports rewired, so `VV` loads the real
  vv file and `activeTaskSkillFile` is accurate. No mismatch.

## v10.112 — AGENT STATE Active-skill source
- Two distinct "skill" concepts: `useLLM.activeSkill` = message-matched
  SKILL_REGISTRY entry, set ONLY during a sent task request; vs
  `skills/index.ts activeTaskSkillName` = layer-routed Task Coach default,
  updated live by the `activeTaskLayer` watcher in useForm.ts.
- `AgentInfo.vue` "Active skill" now = `activeSkill?.name ||
  activeTaskSkillName || '—'` (matched skill wins, else layer default).
- Diagnostic rule: if an AGENT STATE row "doesn't route on layer change",
  check which source it binds to — role binds to `currentRoleDefinition`
  (live via LAYER_ROLE_MAP); skill needed the layer-driven fallback.

## v10.113 — registry skill is additive, not a replacement
- `taskCoach.getSystemPrompt` (useLLM.ts): layer-routed coach skill
  (`getCoachSkillTaskRaw`) is ALWAYS the base; a matched SKILL_REGISTRY
  entry is APPENDED as a specialty layer, never substituted. Order:
  `[traceCtx, baseSkill, specialtySkill, responseFormat]`.
- Compose from RAW skill parts (getCoachSkillTaskRaw + matched raw prompt)
  and append `getResponseFormat()` ONCE — using getCoachSkill +
  resolveSystemPrompt together would duplicate the response-format block.
- Design contract: layer routing is the deterministic discipline baseline
  and must never be weakened/replaced by the fuzzy registry match. Registry
  stays (chip/dismiss intact) but is purely additive. Registry empty today.

## v10.114 — AGENT STATE shows additive skill composition
- `AgentInfo.vue displaySkill`: always shows layer-routed base
  (`activeTaskSkillName`); appends `+ <activeSkill.name>` when a registry
  skill is appended. Mirrors useLLM.ts `[baseSkill, specialtySkill]` order.
  Not either/or anymore (that was pre-v10.113 replacement semantics).

## v10.115 — Active Skill shows source file name
- `AgentInfo.vue displaySkill` = `${activeTaskSkillName} - ${activeTaskSkillFile}`
  (+ ` + ${activeSkill.name}` when a registry skill is appended). e.g.
  "Task Coach (SYS) - coach-skill-task-sys-en.md". File is reactive to
  layer + lang. VV shows coach-skill-task-vv-en.md — accurate, that file
  exists and is loaded (no mismatch; resolved v10.116).

## v10.117 — Task composer/button alignment
- `.coach-composer` (CoachPanel.vue) uses `align-items: center` (was
  flex-end). flex-end aligned the send button to the bottom of the whole
  DescriptionEditor block (textarea + .desc-footer counter), looking
  misaligned. Center fixes it. Explore's `.explore-composer` is separate.

## v10.118 — Task composer/button alignment (correct fix)
- The Task composer is DescriptionEditor (textarea + `.desc-footer` counter,
  margin-top 4px) — NOT a bare textarea. So `.coach-composer` row-centering
  references textarea+counter and looks wrong against the input box.
- Correct approach (user-confirmed "match textarea, top-aligned"):
  `.coach-composer { align-items: flex-start }` + `.coach-send/.coach-stop
  { height: 44px }` to match `.desc-textarea--composer` min-height 44px
  (DescriptionEditor.vue:153). Button pins to top; counter sits below.
- If `.desc-textarea--composer` min-height ever changes, update the button
  height to match (no shared variable today).

## v10.119 — Task composer submits on Enter
- `DescriptionEditor.vue onKeydown` (composer variant): Enter submits,
  Shift+Enter = newline. Guarded by `!e.isComposing` — mandatory for the
  bilingual Chinese IME (Enter confirms a pinyin candidate; must not submit).
  Any future Enter-to-submit input in this repo must keep the isComposing
  guard. composer variant is task-only (CoachPanel.vue:197).

## v10.120 — Explore composer row alignment
- Explore composer (`ExploreChat.vue`) is a flat flex row: attach btn +
  `<textarea rows=1 .explore-input>` + `.explore-send/.explore-stop`. NOT a
  DescriptionEditor (that's Task only).
- Aligned via: `.explore-composer { align-items: center }`, `.explore-input
  { min-height: 44px }`, buttons `{ height: 44px }`. autosize() grows the
  textarea on input; min-height holds the empty state at 44.
- 44px is now used in 3 places (Task button + Task .desc-textarea--composer
  + Explore composer) with NO shared variable — change all together if the
  composer row height ever changes.

## v10.121 — AGENT STATE telemetry restored
- `AgentInfo.vue` is a 2-col grid (`.agent-grid`, row-major pairing, collapses
  <620px) restoring deleted-DevTools telemetry: Model/Role/Skill(+[已修改])/
  Analyze-prompt | Coach&Analyze streaming(+tok/s) & error/cancel; full-width
  Backoff row when 429 active; JIRA block unchanged below.
- Per-channel runtime state threaded App→TaskForm→AgentInfo as OPTIONAL props
  w/ withDefaults (same path as jiraResponse). Skill-modified flags imported
  directly from @/config/skills (module exports), NOT props.
- No new i18n keys / no new useLLM state — everything already existed. Color
  rules mirror deleted DevTools (git show 10e61b3^:src/components/dev/DevTools.vue).
- Custom Templates row intentionally NOT restored — no template-customization
  feature exists, flag would be meaningless.

## v10.122 — Ticket History panel UX polish
- Relative dates in `TicketHistoryPanel.vue` are live: a 60s setInterval
  ticks a local `now` ref read inside `relativeDate(iso)`, registering a
  reactive dep that re-renders the rows. Interval cleared in
  `onBeforeUnmount`.
- `<details>` disclosure: chevron SVG inside `.summary-title` rotates 90°
  via the `details[open]` attribute selector — no JS toggle needed.
- Long summaries clamped to 2 lines (`-webkit-line-clamp: 2`).
- `useTicketHistory.ts` exports `removeTicket(key, date)` (filters by the
  same tuple used as v-for key). Per-entry × button uses opacity-on-hover
  to stay visually quiet at rest.
- Project vs Issue-Type badges differentiated by accent color (blue vs
  purple via color-mix) so the two metadata chips no longer look identical.

## v10.123 — AGENT STATE collapse-expand
- `AgentInfo.vue` now uses `<details open>` + `<summary class="agent-summary">`
  with the same chevron SVG pattern as `TicketHistoryPanel.vue` (v10.122):
  pure-CSS rotation via `details[open] > .agent-summary .summary-chevron
  { transform: rotate(90deg) }`. Native keyboard semantics (Enter/Space).
- Default open; no localStorage persistence; no reactive `:open` (would fight
  user collapse on every streaming tick). User toggle persists across renders.
- AgentInfo.test.ts unchanged — its assertions target DOM nodes that remain
  rendered as `<details>` children regardless of open/closed state.

## v10.124 — Task action-bar UX overhaul
- All `.action-btn`s are now 44px tall to match the composer Send/Stop
  (v10.118/v10.120). Icon-only variants (Reset) use `.action-btn--icon`
  (fixed 44×44). Label+icon variants get `gap: 6px` and horizontal padding.
- **Reset no longer doubles as Cancel during streaming.** The composer Stop
  is the sole cancel surface; Reset is disabled while
  `isSubmitting || isCoachLoading`. `.action-cancel`, `cancelPulse`,
  `.icon-swap-*` removed as dead code.
- **`:disabled` vs `.dimmed` are now visually distinct**: disabled adds
  `filter: grayscale(0.55)` (not available yet); dimmed preserves color at
  0.55 opacity (already used, still available).
- **Create reserves its slot**: rendered with `v-show="appMode === 'task'"`
  and `.invisible-slot { opacity: 0; pointer-events: none }` until
  `hasAiResponse`. No layout jump.
- Hotkeys (Ctrl+Shift+Enter → Analyze, Ctrl+Shift+C → Create) were already
  wired in `App.vue handleKeyboard()`; tooltips now surface them.

## v10.125 — Composer Send/Stop relocated to TaskForm action bar
- The pinned composer footer (CoachPanel.vue `#footer`) is now
  `<DescriptionEditor variant="composer">` directly — no `.coach-composer`
  flex wrapper, no buttons. The editor spans the full footer width.
- Send/Stop pair lives at the head of TaskForm's `.action-group-left`,
  immediately left of Reset. Idle = orange `.action-coach` (emits
  `coach`); streaming = red `.action-stop` (emits `cancelCoach`). Same
  44px height as the rest of the action bar (v10.124).
- App.vue wires `<TaskForm @coach="handleCoachRequest">` parallel to the
  existing `<CoachPanel @coach="handleCoachRequest">` — Enter-to-send
  inside the textarea still emits from CoachPanel via `onComposerSubmit`.
- Old `.coach-send`/`.coach-stop`/`.coach-composer`/`.coach-composer-input`
  styles removed; the action bar's `.action-coach`/`.action-stop` are the
  canonical button styles now.

## v10.126 — Coach composer counter removed
- `DescriptionEditor.vue` `.desc-footer` is now gated by
  `v-if="variant !== 'composer'"`. The composer variant (pinned coach
  footer in CoachPanel) renders the textarea only — no counter, no
  attach button (was explore-only and Explore doesn't use this component
  anyway). The form variant (Task description, center column) keeps
  the counter unchanged.
- Did NOT bump `.desc-textarea--composer min-height: 44px` — keeping a
  modern chat-style single-line resting state. The freed ~17px goes
  back to the coach messages area. Auto-grow `autoGrow()` still expands
  up to `max-height: 200px` on typing.

## v10.127 — Small gap under the AppHeader
- `.app-header` now has `margin-bottom: 2px` (AppHeader.vue scoped
  styles). The `.app` flex-column with locked 100vh + overflow hidden
  absorbs the 2px from `.app-main`'s flex-grow share, yielding a
  transparent strip below the header in all modes.
- Implementation choice: gap encapsulated in the header component
  (user preference) rather than per-mode `.app-main--*` padding. If
  Task-only scoping is ever needed, use `.app--task-lock :deep(.app-
  header) { margin-bottom: 2px }` in App.vue.

## v10.128 — Clipboard works on the cloud HTTP deployment
- `navigator.clipboard` is `undefined` on the GWM deployment
  (`http://10.246.107.247:5181/`) because Chrome restricts the async
  Clipboard API to **secure contexts** — HTTPS, or HTTP on `localhost`
  / `127.0.0.1`. Every non-localhost colleague hit
  `Cannot read properties of undefined (reading 'writeText')` and the
  unconditional "copied" toast was a lie.
- All copy paths now go through `src/utils/clipboard.ts` →
  `copyText(text: string): Promise<boolean>`. It tries
  `navigator.clipboard.writeText` when available, then falls back to a
  transient off-screen `<textarea>` + `document.execCommand('copy')`
  for plain-HTTP / LAN-IP contexts.
- All 8 call sites updated (`ChatBubble`, `CoachPanel`, `AIReviewPanel`,
  `SprintIndicator`, `SummaryBuilder`, `JsonViewer`, `DevTools`, plus
  `ChatBubble.copyResponse`). Each now awaits the boolean and toasts
  either `toast.copied` (new ✓) or `toast.copyFailed` (new — bilingual
  string added to `src/i18n/en.ts` and `src/i18n/zh.ts`).
- Rejected alternative: putting TLS in front of the container (would
  fix the API natively but requires GWM IT and cert management).
- Rejected alternative: `@vueuse/core`'s `useClipboard({ legacy: true })`
  — same fallback, but composable-shaped API is over-engineered for 8
  one-shot copy buttons; a 30-line util is simpler.
- **Rule for future code:** never call `navigator.clipboard.writeText`
  directly anywhere — always import `copyText` from
  `@/utils/clipboard`. The deployment is plain HTTP and will stay
  that way unless infra changes.

## v10.129 — Floating draggable composer popout
- The pinned coach composer in Task mode now has an `⤢` button at the
  top-right of the textarea (composer variant only). Click → opens a
  floating window (`src/components/form/ComposerPopout.vue`) for
  drafting long prompts with room to breathe.
- **Not a modal.** No backdrop; chat history behind stays visible.
  The window can be dragged by the title bar, resized from the
  bottom-right corner, maximized/restored on double-click of the title
  bar, and remembers position + size in `localStorage` under
  `smart_agent.composer_popout_state` (`{x, y, width, height,
  maximized}`).
- **v-model sync.** Both the inline composer textarea and the popout
  textarea bind to the same `descriptionModel` (CoachPanel ⇄ App's
  `form.description`). Edits flow live in both directions; closing the
  popout leaves the text intact. Ctrl+Enter inside the popout fires
  the existing `onComposerSubmit` handler in `CoachPanel`, so the send
  path (TaskForm's action bar `.action-coach` + `canCoachSubmit`
  guard in App.vue) is unchanged.
- **First floating-window pattern in this codebase** (existing modals
  HotkeyModal/ConfirmDialog/LLMSettings/DownloadModal/AgentCheckModal
  are all centered+backdrop). If we ever need a draggable Explore-mode
  composer, reuse `ComposerPopout.vue` rather than rolling another
  drag implementation.
- **Why floating, not modal:** user explicitly asked for click-and-drag
  to move; modal blocks the chat panel which defeats the purpose
  (reading messages while writing a long prompt).
- **Why not `@vueuse/core` `useDraggable`:** it's already a dep but
  doesn't cover Teleport-to-body, resize, maximize, or localStorage —
  end-to-end ownership of the popout is simpler than splicing
  useDraggable into a custom container.
- **i18n keys added** under `coach.*` in both locales:
  `composerExpand`, `composerClose`, `composerMaximize`,
  `composerRestore`, `composerTitle`, `composerSend`.

## v10.130 — Dashboard column widths + center alignment
- `QualityRow.vue`: the 7 fixed-width cells (`.cell-status` / `-team`
  / `-key` / `-type` / `-assignee` / `-points` / `-time`) all retuned
  for their actual content and now all use `text-align: center`. After
  the post-review width rebalance (Refinement #2), total fixed-column
  allocation 750 → **674px**; freed ~76px goes to `.cell-summary`
  (flex), so long ticket titles get a lot more room before the
  ellipsis cutoff. Final sizes: **64 / 104 / 88 / 72 / [flex] / 150 /
  56 / 140 px**.
- `.cell-team` ended up as a plain centered `<td>` — first pass tried
  `display: flex; flex-direction: column; align-items: center` on the
  cell itself, but flex on a `<td>` breaks `display: table-cell`, so
  under `table-layout: fixed` the flex content box no longer matched
  the column track the `<th>` sat in and the TEAM header visibly
  drifted from its body data. Final shape: `.cell-team` is plain
  centered (no flex), and the two `<span>` children get `display:
  block` (with `margin-top: 2px` on `.team-name` to replace the lost
  flex `gap`). Rule of thumb: **never put `display: flex` directly on
  a `<td>` inside a `table-layout: fixed` grid — wrap with an inner
  div, or use block-level children, so the cell stays a true
  table-cell.**
- `<StatusBadge>` was already `display: inline-flex` (see
  `StatusBadge.vue:48`), so `text-align: center` on the parent td
  centers the badge automatically — no badge change needed.
- `QualityGridPanel.vue` headers: `<th>` elements now have
  `col-status`/`col-team`/`col-key`/`col-type`/`col-summary`/
  `col-assignee`/`col-points`/`col-time` classes. The `thead th`
  baseline `text-align` flipped `left` → `center`, with a single
  `.col-summary { text-align: left }` exemption so the Summary header
  matches its left-aligned body cell.
- **Rule for future grid columns:** the Summary column is the only
  left-aligned, flex-fill column. Any new column added to the grid
  should follow the centered + fixed-px pattern unless it carries
  long-form prose (in which case mirror Summary's setup, not the
  others).
- **Refinement #7 — Task-mode split is tuned via CSS variables.** The
  two Task-mode grid columns (Coach left | Task form center) read
  their widths from `--task-col-left` and `--task-col-center`,
  declared in the `:root, [data-theme="dark"]` block of
  `src/styles/variables.css`. Defaults: `1fr` / `1fr` (50/50). To
  retune, edit those two values — any valid CSS grid track works
  (`2fr`/`3fr`, `380px`/`1fr`, `30%`/`70%`, `minmax(...)`, etc.).
  Live-preview from DevTools:
  `document.documentElement.style.setProperty('--task-col-left', '2fr')`.
  **Project rule:** layout-level dimensions in this codebase belong
  in `variables.css` alongside the other design tokens (colors,
  spacing, radii, fonts, `color-scheme`), not buried in scoped
  component CSS.
- **Refinement #6 — Task-mode column-resize subsystem fully removed.**
  Task mode's grid is now a fixed **50/50** two-column layout
  (`grid-template-columns: 1fr 1fr;` in `App.vue`), with no gutter,
  no `col-resize` cursor on hover, and no draggable border. Deleted
  the `col-drag-handle` markup, the `gridRef` / `gridStyle` bindings
  on `.grid-layout`, the entire `startDrag`/`onDrag`/`stopDrag` script
  section, the `colFractions` state, and the `.col-drag-handle` /
  `.drag-grip` CSS. Legacy `grid-col-sizes` localStorage key left in
  place — harmless dead data. **Project rule:** don't re-introduce
  resizable panels in this layout without a fresh design discussion;
  the previous 3-column resizable layout was explicitly retired.
- **Refinement #5 — native form chrome themed via `color-scheme:` on
  `variables.css`.** Added `color-scheme: dark;` to the
  `:root, [data-theme="dark"]` block and `color-scheme: light;` to
  the `[data-theme="light"]` block. Fixes the user-reported dark
  calendar picker icon in View mode → Custom range date inputs, and
  any other native chrome (scrollbars, file picker buttons, native
  select dropdowns) that previously rendered in light-mode defaults
  on the dark page. **Project rule for future native-control theming
  issues: override via the central `color-scheme:` block in
  `variables.css`, not per-component `filter: invert()` hacks.**
- **Refinement #4 — composer hotkey label is "Enter", not "Ctrl+Enter".**
  Both the inline DescriptionEditor composer variant and the floating
  ComposerPopout submit on plain Enter (Shift+Enter = newline, IME-safe
  via `!e.isComposing`). All three user-facing labels updated to match:
  `shortcuts.coach` i18n value, TaskForm Send button tooltip, and the
  Hotkey cheatsheet row in HotkeyModal. The global Ctrl+Enter handler
  in `App.vue` still works as an undocumented fallback for muscle
  memory; we just no longer advertise it. **Rule for new composer
  surfaces:** label the hotkey as `Enter`, not `Ctrl+Enter`.
- **Refinement #3 — Explore composer now shares Task's expand-to-popout
  UX.** Ported v10.129's coach composer pattern (`DescriptionEditor`
  composer variant + floating `ComposerPopout`) to Explore mode.
  `ComposerPopout.vue` is now generic — three new optional props
  (`titleKey`, `placeholderKey`, `sendAccent`) default to the original
  Task values so existing `CoachPanel.vue` is unchanged; Explore passes
  `coach.composerTitleExplore` / `coach.explorePlaceholder` /
  `var(--accent-blue)`. `ExploreChat.vue` swaps its raw `<textarea>`
  for `<DescriptionEditor variant="composer">` (auto-grow, ⤢ button,
  IME-safe Enter all come for free) and mounts `<ComposerPopout>` as a
  sibling. Bonus: Explore now has the IME guard (`!e.isComposing`) for
  Chinese pinyin candidate selection — a latent bug fixed for free.
  Project rule for future modes that gain a composer: reuse this same
  pair (`DescriptionEditor[variant=composer]` + `ComposerPopout` with
  mode-specific i18n keys + accent prop) rather than rolling another
  raw textarea + manual auto-grow.
- **Refinement #2b — the widths must live on `<th>`, not `<td>`.**
  First attempt at width rebalance put `width:` on the body
  `.cell-*` selectors in `QualityRow.vue`. None of them rendered —
  even shrinking `.cell-team` to 60px did nothing visually. Reason:
  under `.grid-table { table-layout: fixed }`, browsers take column
  widths from the **first row** (`<thead><th>` or `<col>`); body
  `<td>` widths are inert. Fix: add `.grid-table thead th.col-status
  { width: 64px }` (and friends) in `QualityGridPanel.vue`; keep
  `.col-summary` unsized so it flex-fills. The body `.cell-*` widths
  in `QualityRow.vue` stay as documentation but no longer drive
  layout. **Project rule for any future `table-layout: fixed` grid
  in this repo: declare column widths on the header row, not on
  body cells.**

## v10.131 — Brokered LLM through Fastify (Phase L1 of MCP rollout)
- The SPA no longer calls LLM providers directly. Every chat request now
  goes `browser → POST /api/llm/chat → LangChain ChatOpenAI →
  llmproxy.gwm.cn/v1`. API keys live in `deploy/.env`
  (`LLMPROXY_API_KEY`), never in browser localStorage.
- New server modules: `server/llm/openai-client.ts` (the `ChatOpenAI`
  factory) and `server/routes/llm.ts` (the SSE streaming route). Route
  re-emits LangChain `AIMessageChunk`s as OpenAI-compatible
  `data: {choices: [{delta: {content: ...}}]}\n\n` events so the SPA's
  existing SSE parser in `useLLM.ts` is unchanged.
- The route's auth hook has an optional `INTERNAL_API_TOKEN` header
  guard. Async hook signature is required (`Promise<void>` return type)
  — a sync hook returning `boolean` hangs Fastify silently. **Project
  trap: Fastify hooks must be async or use `done()`, never a sync
  boolean return.**
- `src/config/llm.ts` `getProviderUrl` / `setProviderUrl` / `getApiKey`
  / `setApiKey` are now `@deprecated`. Bodies kept for one release;
  scheduled for full removal in v10.132. localStorage entries become
  no-ops for the LLM call path.
- `LLMSettings.vue` no longer shows Provider URL or API key fields —
  replaced with an info panel pointing at ops. Model picker stays.
- **Project rule for all future LLM work in this codebase:** every LLM
  request goes through `POST /api/llm/chat`. Never call providers
  directly from the browser. The brokered path is the only path.
- Unblocks Phases L2 (MCP client via `@langchain/mcp-adapters`), L3
  (LangGraph agent harness), L4 (tool-event UI), L5 (polish) without
  any further refactor of the call path.


## v10.132 — Narrow L1 (Task mode reverts; only Explore stays brokered)

- Phase L1 (v10.131) over-reached: it rerouted Task + Analyze + Explore
  through the new Fastify `/api/llm/chat` broker. Task + Analyze must
  not be touched by MCP/gateway work per the standing deal. v10.132
  rolls Task + Analyze back to the v10.130 direct-browser-to-provider
  path; only Explore stays brokered (that's where MCP will plug in).
- **Project rule (re-affirmed):** MCP / gateway / tool-loop work must
  not touch Task mode or Analyze. Explore is the only client surface
  for brokered LLM calls. Server-side `server/routes/llm.ts` + its 8
  tests stay in place; they're used by Explore only.
- `src/composables/useLLM.ts` now has BOTH helpers side-by-side:
  `_callGLMStream` (direct, Task + Analyze) and `_callBrokeredLLM`
  (brokered, Explore only). Don't collapse them — they're intentionally
  separate so future MCP work in `_callBrokeredLLM` is impossible to
  accidentally leak into Task mode.
- Settings panel is restored to v10.130 exactly: Provider URL input,
  API Key input + Test Key button, Model picker. No "LLM Gateway" info
  panel. Brokered path is configured only via `deploy/.env`
  (`LLMPROXY_BASE_URL`, `LLMPROXY_API_KEY`) and is invisible to the
  user. Don't reintroduce gateway UI in Settings.
- Explore-mode brokered path still fails silently in v10.132. Diagnosis
  parked under Phase L1.5 — needs the Fastify green-terminal log from a
  real failed Explore send. Most-likely cause: model-name mismatch
  (`glm-4.7-flash` not served by GWM proxy).


## L1.5 — req.raw.close abort trap + GWM proxy 403 finding

- `server/routes/llm.ts` originally listened on `req.raw.on('close', ...)`
  to drive an `AbortController` for the upstream LangChain call. Trap:
  `req.raw.close` fires on **normal POST body consumption**, not just
  client disconnect. For small JSON bodies, the body is drained before
  the handler runs, so the listener fires on the next tick, aborts the
  signal, and `llm.stream()` rejects with `AbortError` before any chunk
  arrives. The catch block treated `AbortError` as "client gone" and
  silently 200'd with empty SSE — no error log, no SPA toast, no
  typing dots. **Fix:** listen on `reply.raw.on('close', ...)` instead.
  Permanent fix in v10.132 hotfix. **Don't reintroduce the req.raw
  listener.** L1 unit tests can't catch this because
  `light-my-request`'s `inject()` skips the real socket lifecycle.
- With the abort bug gone, GWM `llmproxy.gwm.cn/v1` returns 403 (no
  body) for model `glm-4.7-flash`. That's a `PermissionDeniedError`
  from the OpenAI SDK — auth is fine (otherwise 401), but the model
  isn't in this account's allowlist. The Task-mode direct path uses
  ZhipuAI directly so `glm-4.7-flash` works there; only the brokered
  Explore path needs a GWM-served model name (e.g. `default/deepseek-v3-2`,
  `openai/gpt-4o` — pending confirmation from GWM ops). Park work for
  L1.5 part 2 until we know which model id to target.


## v10.133 — Phase L2: MCP client + tool registry (Explore only)

- `server/mcp/client.ts` is the singleton MCP loader. Reads
  `deploy/mcp-servers.json` (or `MCP_CONFIG_PATH`), substitutes
  `${LLMPROXY_API_KEY}` (and any `${ENV_VAR}`) inside string values,
  instantiates `MultiServerMCPClient` from `@langchain/mcp-adapters`,
  caches the resulting `DynamicTool[]`. Two exports: `initMCP()`
  (idempotent, never rejects) and `getMCPTools()` (sync, returns cached
  list). Called once from `server/index.ts` before `app.listen()`.
- `server/routes/llm.ts` wraps the per-request `makeChatModel(model)` in
  `createReactAgent({ llm, tools: getMCPTools() })` from
  `@langchain/langgraph/prebuilt`. Streams the agent with
  `streamMode: 'messages'` and filters to final assistant text deltas
  only. Tool calls + results run silently server-side (L3 will surface
  them in the SPA). Abort handler still listens on `reply.raw.close`
  (L1.5 hotfix).
- **Graceful degradation is the law**: every MCP failure (missing config,
  malformed JSON, network, getTools rejection) ends with empty tools +
  warn log. `createReactAgent` with `tools: []` is a transparent LLM
  passthrough, behaviorally identical to v10.132.
- Config substitution rule: any `${ENV_VAR}` reference inside string
  values in `deploy/mcp-servers.json` is replaced at boot from
  `process.env`. Keeps the secret in `.env`, JSON committable.
- **Project rule still in force**: MCP work touches only the Explore
  client surface. Task mode + Analyze stay on the v10.130 direct path.
  See `feedback_task_mode_no_mcp.md`.
- **vitest gotcha**: `vi.fn().mockImplementation(() => ({...}))` does
  NOT reliably return its impl when called with `new`. Use a real class
  for constructor mocks plus a separate `vi.fn()` ctorSpy for
  assertions. Pattern lives in
  `server/mcp/__tests__/client.test.ts` and persistent memory
  `feedback_vi_fn_constructor_mock.md`.


## L2.1 hotfix — MCP boot must have a timeout, not just an error handler

- `server/mcp/client.ts`'s `await client.getTools()` originally had no
  timeout. When the GWM MCP service is slow/unresponsive, getTools()
  never resolves, `await initMCP(...)` blocks `app.listen()`, and
  Fastify never boots. No error log because nothing throws — pure
  silent hang. dev.log shows Vite up + ECONNREFUSED on proxy attempts
  but NO "Server listening" line.
- Fix: `Promise.race` against `setTimeout` rejection. Default 5000ms,
  configurable via `MCP_INIT_TIMEOUT_MS` env var. The timeout error
  flows through the existing catch → empty tools → Fastify proceeds
  to listen. `finally` block clears the timer to avoid keeping the
  process alive when getTools() resolves first.
- **General rule** (persisted in `feedback_async_init_needs_timeout.md`):
  any async boot init that talks to a network service needs BOTH an
  error path and a timeout path. Hangs and errors are distinct
  failure modes; handling only errors is half a job.


## L2.2 — Streamable HTTP transport is the working one, plus tool observability

- The GWM MCP endpoint `https://llmproxy.gwm.cn/mcp/<tool-id>/sse` registers
  a tool stub but the tool doesn't actually invoke. Use the Streamable HTTP
  variant instead: URL `.../streamablehttp` with config `"transport": "http"`.
  Colleagues using open-code over Streamable HTTP successfully drive live
  web-search via this exact tool ID. Our config now matches.
- `server/mcp/client.ts` now logs one info line per discovered tool
  (`{name, description}`) right after `getTools()` resolves, above the
  existing rollup. So the operator can see what the agent has access to.
- `server/routes/llm.ts` now logs `agent: tool_call requested` and
  `agent: tool_result received` via `req.log.info` (so they inherit
  `reqId`). Both lines firing for the same `reqId` is end-to-end proof
  that MCP is actually invoked, not just loaded. Tool-result content is
  sliced to 200 chars for log readability.


## v10.134 — Phase L3: tool-event chips visible in ChatBubble

- Brokered SSE format now carries TWO sibling delta types: the
  existing OpenAI-compatible `content` deltas AND a namespaced
  `smart_agent_event` delta for tool-use lifecycle. Outside the
  OpenAI spec so non-Smart-Agent consumers ignore it harmlessly.
  Same /api/llm/chat endpoint, no headers change.
- `ChatMessage.toolEvents?: ToolEvent[]` (src/types/api.ts) is the
  client-side anchor — tool invocations belong to the assistant
  message that produced them, not standalone history entries. Empty
  / absent for Task-mode and Analyze.
- `applyToolEvent` in useLLM.ts is the merge logic: tool_call pushes
  a 'requested' entry, tool_result matches the most-recent
  'requested' by tool name and flips to 'received' + fills preview
  and length.
- ChatBubble.vue renders chips above the markdown response. Distinct
  visual: monospace, smaller, tertiary bg, border turns green on
  receipt and blue when expanded. Click chip body to toggle 200-char
  preview. Per-component expanded state; collapsed default on reload
  is intentional.
- **i18n interpolation gap:** local `t()` is plain key lookup, no
  `{param}` substitution. For now we do `.replace('{tool}', ...)` at
  the call site for the two new strings. If we need more later,
  extend `t()` to take a params object.


## L3.9 — tool events persist to coach history

- `CoachHistoryRecord.toolEvents?: ToolEvent[]` (same shape as the
  in-message field) carries MCP tool invocations across page reloads
  and session-history navigation. Lives in `src/types/api.ts`.
- `addRecord(role, content, channel, toolEvents?)` in
  `useCoachHistory.ts` writes the field only when non-empty — keeps
  the localStorage payload byte-identical to v10.133 for user
  messages and Task-mode assistant records, no migration needed for
  pre-v10.134 records (their absent field restores as empty, chip
  block stays hidden via the existing v-if).
- `createStreamFlow` in `useLLM.ts` passes `lastMsg.toolEvents` to
  addRecord on save. `_restoreInto` copies `r.toolEvents` back onto
  the rebuilt `ChatMessage` so `ChatBubble.vue` re-renders the chips.


## v10.135 — View-mode polish: ratio chips + virtualized ticket table

- `QualitySummaryBar.vue` shows each A/B/C/D chip with `count · pct%`.
  Format adapts: 1 decimal under 10%, rounded above. `%` is bilingual,
  no new i18n keys.
- The View-mode ticket table is now virtualized via
  `vue-virtual-scroller@^3.0.4` (`DynamicScroller` + `DynamicScrollerItem`).
  Adopted because the prior `<table><tbody>` + `v-for` would mount ~20k
  DOM nodes for a 2000-ticket dataset, causing 1–2s render lag and
  noticeable scroll/filter jank. After v10.135 only ~30 rows are mounted
  at any time regardless of list length.
- `QualityRow.vue` root changed from `<tr><td>` to
  `<div role="row"><div role="cell">` with `display: grid` and an explicit
  8-track template (`200px 200px 200px 200px 1fr 200px 200px 200px`)
  matching the sticky header's column widths declared in
  `QualityGridPanel.vue`. **Don't reintroduce `<tr>/<td>` for the row root
  — vue-virtual-scroller can't virtualize inside a `<tbody>` cleanly;
  table-layout fights the absolute positioning the scroller needs.** ARIA
  roles preserve screen-reader semantics for the body.
- The header in `QualityGridPanel.vue` IS still a semantic table header
  (`role="table"` on the container, `role="columnheader"` on each `<div>`)
  so column-header announcements continue to work for keyboard users.
- vue-virtual-scroller's CSS is imported once at the top of
  `src/main.ts`. Don't import it per-component.


## v10.136 — Drop panel-header; consolidate Refresh + count into PERIOD QUALITY bar

- QualityGridPanel's entire `<header class="panel-header">` block is
  GONE — the visible "JIRA Quality Grid" `<h2>`, the
  "AI quality-check verdicts..." subtitle, the count-label, and the
  Refresh button all came out. The View panel now opens directly with
  the QualitySummaryBar row.
- Don't reintroduce a visible title above the summary bar without
  asking — the user explicitly wanted this stripped for tightness.
- The section's `aria-label` still uses `t('view.title')` for screen
  readers, so the i18n string is alive (don't delete it from en.ts /
  zh.ts). `view.subtitle` is unused but kept in case it's wanted back.
- Refresh button + filter-aware count now live on the right side of
  QualitySummaryBar's `.summary-head` row, alongside the period chips.
- QualitySummaryBar takes 3 optional props (`filteredCount`,
  `totalCount`, `loading`) and emits `refresh`. Falls back to
  `summary.total` when props are absent so the component is still
  usable in isolation. The "X of Y filtered" string still uses
  `view.countFiltered`; "N tickets" uses `view.countLabel`. Same i18n
  keys the panel-header used to use, no new strings.
- Layout: `.summary-head` is `flex-wrap: nowrap` with the Refresh
  button pinned right; `.summary-head-left` inside it is
  `flex-wrap: wrap` so the chips wrap below the head text on narrow
  viewports while the Refresh button stays anchored.

## v10.137 — Explore mode: Claude-style serif reading flow
- Goal: make Explore's conversation read like the Claude website (serif
  coach replies, sans user messages + composer, centered reading column).
  Reference sample saved at `claude-samples/`.
- Two new tokens in `src/styles/variables.css`: `--font-serif` (Claude's
  Anthropic-Serif fallback chain, proprietary entry dropped, full CJK list
  kept for Chinese) and `--explore-read-width: 46rem` (centered column).
- Serif prose lives in `src/styles/coach-response.css` under
  `.layout-stacked .coach-response` ONLY. This is critical: `.coach-response`
  is shared with Task-mode CoachPanel (`layout="bubble"`); scoping to
  `.layout-stacked` keeps Task mode in sans. Never make the serif rules
  unscoped or Task mode regresses.
- Code/`pre`/tables/KaTeX stay monospace/unchanged — Claude keeps code mono.
- ChatBubble `.chat-msg.layout-stacked` centers in `var(--explore-read-width)`;
  `.layout-stacked .msg-user-text` is explicit `--font-sans` 1rem/1.6.
- ExploreChat composer (`.desc-textarea--composer` deep override) is
  `--font-sans` 1rem/1.5; `.explore-composer-wrap` centered to the same
  column so input aligns under the conversation.
- Web-safe fallback fonts only (no woff2 shipped) — bilingual-safe + no
  licensing concern on the GWM intranet.

## v10.138 — Explore mode: AI-left / user-right alignment (Claude bubble)
- Continues the Explore Claude-styling pass (after v10.137 serif). Adopts
  Claude.ai's conversational layout: assistant left/full-width/serif; user
  messages = right-aligned tinted rounded bubble. Verified against the saved
  sample (`data-user-message-bubble` = `bg-bg-300 rounded-xl px-4 py-2.5
  max-w-[85%]`).
- Decision: role-label + avatar headers KEPT on both sides (minimal change);
  only the user side flips right.
- All in `src/components/chat/ChatBubble.vue`, gated on
  `.chat-user.layout-stacked` so Task-mode `bubble` layout is untouched:
  - `.layout-stacked .msg-user-text` → Claude bubble: `inline-block`,
    `max-width: 85%`, `background: var(--bg-tertiary)` (≈ Claude bg-bg-300),
    `border-radius: var(--radius-lg)` (12px = rounded-xl), padding. `text-align:
    left` keeps wrapped text readable.
  - `.chat-user.layout-stacked .msg-role-label { flex-direction: row-reverse }`
    → header `… time USER 👤` packed right.
  - `.chat-user.layout-stacked .msg-bubble { text-align: right }` → bubble
    pushed to the right edge of the centered `--explore-read-width` column.
- Net: user-right / AI-left both inside the shared ~768px reading column,
  matching Claude's `max-w-3xl`.

## v10.139 — Explore mode: dynamic AI "thinking" avatar (pulsing gradient orb)
- Explore had no "generating" feedback before the first token (empty assistant
  placeholder bubble only). Added a pulsing purple→blue gradient orb +
  "Thinking…" shown while the AI reply generates, replaced by the streaming
  serif response on first token.
- All in `src/components/chat/ChatBubble.vue`. Orb row sits just above the
  always-present `.coach-response` div (keeps `responseEl` ref stable), wrapped
  in `<Transition name="orb-fade">`, gated on
  `layout === 'stacked' && message.isStreaming && !message.content`.
- Gating on `layout === 'stacked'` keeps Task mode untouched — Task's
  CoachPanel.vue keeps its own bouncing-dots typing-row (`isWaitingFirstToken`).
  Do NOT add the orb to the bubble layout.
- Decisions: orb is ADDITIVE (existing inline role-label avatars kept);
  lifecycle = wait-for-first-token then text.
- Reuses existing `coach.typing` i18n ("Thinking…/思考中…") + `--accent-purple`/
  `--accent-blue`. No new i18n keys, no new assets.
- `.thinking-orb` 18px, `orbBreathe` 1.6s (scale + glow + opacity pulse);
  `@media (prefers-reduced-motion: reduce)` disables the pulse (static orb).

## v10.140 — Explore mode: pure-Claude headers (remove avatars + role labels)
- User decided (after seeing them) to go pure Claude in Explore: no avatars, no
  visible role-label/timestamp headers. Identity conveyed by alignment + serif
  prose (AI) / right tinted bubble (user); the v10.139 orb is the AI's only
  visible "avatar."
- `src/components/chat/ChatBubble.vue`: removed the two stacked-only inline
  avatar elements from `.msg-role-label`; label row now visually hidden in
  Explore via conditional global `.sr-only` (`{ 'sr-only': layout === 'stacked' }`)
  — KEPT for screen readers (don't fully delete; speaker must still be
  announced, like Claude's sr-only headers). Removed dead `.msg-avatar-inline*`
  CSS + the v10.138 `row-reverse` header rule.
- Scope: all Explore-only — inline avatars were `layout === 'stacked'`-gated,
  sr-only toggle gated on stacked. Task-mode `bubble` keeps avatars + labels.
- `agentAvatar` const stays (bubble layout `.msg-avatar` still uses it). Removing
  the inline `<img>` also stops the per-message agent_avy.png fetch in Explore.

## v10.141 — Explore mode: Claude-style composer (+ add-file, model label, reminder)
- Rebuilt the Explore composer to match Claude (sample sample-2.jpg): rounded
  `.composer-box` with textarea on top + bottom bar (`+` add-file left | static
  model label + Send right) + centered muted reminder below. No mic/voice; the
  ⤢ expand/ComposerPopout feature is KEPT.
- Model = STATIC read-only label bound to `currentModel` (@/config/llm) — no
  switching (only one configured model). 
- File attach (`useAttachment.ts`): switched from allow-list to BLOCKLIST —
  accepts ANY text-readable file EXCEPT images/pdf/office-binary/archives/media/
  exe/fonts (`BLOCKED_ATTACH_EXTS`), 512KB cap. So "any code" works without
  enumerating languages. `ATTACH_ACCEPT_HINT` is only the picker `accept` hint,
  NOT the real filter. (Reconciles user's "any text-readable" choice with "no
  images/pdf/binary".)
- All in `ExploreChat.vue`. CRITICAL for tests: kept classes `.explore-composer`
  (now the bottom bar), `.explore-send`, `.explore-stop`, and the `textarea` —
  ExploreChat.test.ts (9 tests) depends on them. Textarea is borderless inside
  the box (box owns border + focus-within ring).
- i18n: `coach.composerDisclaimer` + `coach.composerAddFile` (en/zh).
  `coach.loadFile`/`loadFileLabel` now unused (left in place).
- Scope: Explore only. Task-mode composer (DescriptionEditor form variant)
  untouched.

## v10.142 — Explore: long code → file card + right-side artifact viewer
- Long AI code blocks flooded the Explore chat. Now a code block ≥ 40 lines
  (`LONG_CODE_LINE_THRESHOLD` in codeArtifact.ts) collapses into a download CARD
  (icon + filename + "label · N lines" + Copy/Download); clicking the card opens
  the full code in a right-side ArtifactPanel (split/push — chat shrinks left).
  Claude's artifact-viewer pattern (sample-4.jpg).
- Scope: EXPLORE ONLY — gated by `collapseLong: layout === 'stacked'` passed from
  ChatBubble to `enhanceCodeBlocks`. Task-mode (`layout="bubble"`) keeps inline
  code. Don't enable collapse for bubble layout.
- New singleton store `src/composables/useArtifact.ts` (current/isOpen/open/close,
  like useToast). New `src/components/chat/ArtifactPanel.vue` renders the code via
  `renderMarkdown('````'+lang+...)` (4-backtick fence to avoid ``` collisions)
  inside `.coach-response` so it reuses the hljs theme.
- `enhanceCodeBlocks(root, {collapseLong, labels})` — labels now passed in (copy/
  download/open/lines), replacing the old `setArtifactLabels` call. Card mode
  keeps the `<pre>` in the DOM but `display:none` (coach-response.css
  `.code-artifact--card pre`) so Copy/Download/open still read its text.
  `handleArtifactClick` gained the `open` action → `handlers.onOpen`. Meta gained
  `langToken` (hljs token for the viewer) + `lines`.
- App.vue: Explore branch wrapped in `.explore-layout` (flex row) with
  `<ArtifactPanel/>` mounted (renders only when open). Panel width
  `clamp(360px,42%,720px)`.
- i18n: `coach.artifactLines`/`artifactView`/`artifactClose` (en/zh).

## v10.143 — Fix: Explore artifact split layout (multi-root scoped-style trap)
- Bug in v10.142: chat appeared split even with no artifact open, and didn't
  restore to full width after closing the viewer.
- Root cause: `.explore-layout > .explore-chat { flex:1 }` was in App.vue's
  SCOPED style, but ExploreChat is MULTI-ROOT (`<section>` + teleported
  `<ComposerPopout>`), so Vue does NOT add the parent's scoped data-attribute to
  its root → the rule never matched → chat sized to content (right-side gap).
- Fix: set `flex:1; min-width:0` on `.explore-chat` in ExploreChat's OWN scoped
  style; removed the dead App.vue rule.
- LESSON (reusable): a parent's scoped CSS cannot target a multi-root child's
  root element. Style such a child from within the child component, or use
  `:deep()`. [[feedback_table_layout_fixed_widths]]-style gotcha.

## v10.144 — Artifact viewer: line numbers + HTML/SVG live preview
- Enhanced ArtifactPanel.vue (v10.142 viewer): text/code → left line-number
  gutter; html/svg → live preview in a sandboxed iframe with a Preview|Code
  toggle (default Preview). Mirrors Claude (sample CSS: `.linenumber` +
  `content:attr(data-line-number)` + iframe).
- `kind` = html/svg/text from `current.lang` (hljs token) + content sniff
  (`<svg`, `<!doctype html>`). Preview iframe: `sandbox="allow-scripts"` (NO
  same-origin → isolated); SVG wrapped in a centering HTML doc as srcdoc.
- Line-number gutter approach: a parallel `<pre>` of 1..N beside the
  renderMarkdown-highlighted `<pre>`, sharing `--art-code-lh` line-height +
  matching padding; `white-space:pre` (no wrap) keeps 1 line = 1 number. Only
  the code column scrolls horizontally; body scrolls vertically over both. This
  avoids splitting hljs-highlighted HTML (multiline tokens) per line.
- hljs token colors are GLOBAL (`[data-theme] .hljs-*`), so the code view does
  NOT need a `.coach-response` wrapper for colors — but I kept the class on the
  scroll div; `:deep(pre)` strips margin/border/bg for alignment.
- i18n: `coach.artifactPreview`/`artifactCode` (en/zh). Reuses v10.142
  langToken. Card/store/threshold unchanged.

## v10.145 — Artifact viewer: Claude elevated bg + draggable resize bar
- ArtifactPanel.vue refinements to match Claude: (1) panel background switched
  from `--bg-primary` to `--bg-secondary` (= Claude bg-000 elevated; chat/body
  is bg-primary = Claude bg-100) so the panel reads as a raised surface; gutter
  moved to `--bg-primary` (recessed); pre/hljs transparent; iframe white.
- (2) Draggable resize bar: `.artifact-resizer` (cursor:col-resize) on the
  panel's left edge. `panelWidth` ref persisted to
  `localStorage['explore_artifact_width']`; drag clamps panel≥320 / chat≥280 /
  ≤80vw. Right edge captured at pointerdown; window pointermove/up listeners;
  `dragging` flag adds user-select:none. Chat (flex:1) shrinks automatically
  (v10.143) — no App.vue change.
- Claude dark bg tokens (from sample CSS): bg-000 hsl(60 2.1% 18.4%) elevated,
  bg-100 hsl(60 2.7% 14.5%) main — app's bg-secondary/bg-primary already map to
  these.

## v10.146 — Fix: artifact resize bar (color states + drag smoothness)
- Drag felt clumsy: the preview <iframe> captured pointer events when the cursor
  crossed it, halting window pointermove. FIX: `setPointerCapture(e.pointerId)`
  on the handle in startResize + `.artifact-panel--dragging .artifact-iframe
  { pointer-events:none }` + rAF-coalesced width updates. REUSABLE LESSON: any
  drag/resize over an iframe MUST use setPointerCapture (or an overlay), else the
  iframe swallows the move events.
- Color states (ArtifactPanel.vue resizer): `::before` = full-height border
  line, `::after` = small grip bar. Rest: both `--border-color`. Hover: line
  `--accent-blue` (light), grip `color-mix(--accent-blue 65%, black)` (dark).
  Drag/active: both back to `--border-color`. Dragging rules placed AFTER hover
  (equal specificity → source order wins).

## v10.147 — Resizer drag color + custom ~1/3 chat scrollbar
- Resizer (ArtifactPanel.vue): dragging now turns BOTH the border line + grip
  LIGHT BLUE (`--accent-blue`); corrected v10.146 which reverted to border color.
  Hover: line light blue, grip darker (color-mix accent+black). Grip width 6px.
- Custom chat scrollbar (ExploreChat.vue): native bar hidden
  (`scrollbar-width:none` + `::-webkit-scrollbar{width:0}`); replaced by a custom
  `.chat-thumb` fixed at ~1/3 of the view height (`(clientHeight-2*INSET)/3`),
  draggable via setPointerCapture + window pointermove/up, position from
  `scrollTop/range`. `updateThumb()` called from onScroll, ResizeObserver, the
  messages watch, and onNewChat. Track `.chat-scrollbar` inset `right:4px` = the
  gap from the artifact grip bar. `.explore-scroll` wrapped in
  `.explore-scroll-wrap` (relative) to host the overlay.
- The custom thumb is a FIXED fraction (not content-proportional) per the user's
  explicit choice.

## v10.148 — Explore: Chat/History/New-chat → left vertical rail
- Moved Explore's view switch from a horizontal top bar to a Claude-style left
  vertical rail (`.explore-rail` in ExploreChat.vue): labeled icon+text items
  New chat / Chat / History + a collapse toggle (168px ↔ 56px icons-only).
  `.explore-chat` is now `flex-direction: row` → rail | `.explore-main`; combined
  with App.vue `.explore-layout` the area reads rail | chat | artifact-panel.
- `railCollapsed` persisted in `localStorage['explore_rail_collapsed']`; collapsed
  hides `.rail-label` (tooltips via title).
- CRITICAL for tests: kept `.explore-tab` on Chat & History + `.explore-newchat`
  on New chat (ExploreChat.test.ts selects `.explore-tab`[0]=Chat,[1]=History +
  `.explore-newchat`). The active class is now `.rail-item.active` (was
  `tab-active`).
- Search NOT duplicated in the rail — CoachHistoryTab already has search/filters.
- i18n: `coach.railToggle` (en/zh). Explore-only; Task CoachPanel tabs untouched.

## v10.149 — Explore: full-bleed edges + recessed rail bg
- Match Claude (sample-1): Explore shell is now full-bleed (rail flush to left
  page border, artifact viewer flush to right border). `.app-main--explore`
  overrides the shared centered layout with `max-width:none; margin:0;
  padding-left/right:0`. Task/View keep centered max-width + padding.
- New token `--bg-sunken` (recessed sidebar surface): dark #1F1E1C (≈ Claude
  bg-200), light #ECEAE4. Rail bg switched from `--bg-secondary` (elevated) to
  `--bg-sunken`. Layering now: rail (sunken) | chat (bg-primary) | artifact panel
  (bg-secondary elevated) — matches Claude.
- Collapsed rail width 56→52px. Surface tokens summary: bg-sunken < bg-primary <
  bg-secondary < bg-tertiary (dark = darker→lighter).

## v10.150 — Explore rail: same bg as chat panel
- Reverted v10.149's recessed rail: `.explore-rail` background `var(--bg-sunken)`
  → `transparent` so the rail matches the main chat panel (page --bg-primary).
  Flush-left + collapse + thin border-right divider kept.
- Removed the now-unused `--bg-sunken` token (dark + light) from variables.css.
- Surface layering now: rail = chat (bg-primary) | artifact panel (bg-secondary
  elevated). User prefers the rail to blend with the chat, NOT a darker sidebar.

## v10.151 — Explore-mode context limit + Context calculator
- New `src/utils/contextCalculator.ts`: `contextBytes()` measures UTF-8 byte size
  of the messages array via `TextEncoder` (so multibyte Chinese counts by true
  wire size, not char length). `contextUsage()` → `{bytes, limit, percent, over}`;
  `formatKB()` → "92.0 KB".
- Per-model limit lives in `src/config/llm.ts`: `DEFAULT_CONTEXT_LIMIT_BYTES`
  (92KB), `MODEL_CONTEXT_LIMITS` (seeded `minimax → 90KB`), `getContextLimitBytes()`
  (case-insensitive substring match on the active model, else 92KB default). Add
  new model windows to MODEL_CONTEXT_LIMITS, not scattered constants.
- Enforcement is **Explore-only** and does NOT touch shared `useLLM` /
  `createStreamFlow` (Task mode stays untouched). Two layers, both using the same
  calculator: ExploreChat composer shows a live `X / 92.0 KB` badge (red `.over`)
  + disables Send; `App.vue handleExploreSend` is the authoritative guard that
  blocks + toasts before `requestExploreCoach` (also covers replay/continue).
- Over-limit behavior = **block + warn** (no silent truncation). i18n keys
  `coach.contextOverLimit` / `coach.contextBadgeTitle`; `{used}`/`{limit}`/`{model}`
  filled via manual `.replace()` because `t()` has no interpolation.

## v10.152 — Multi-file attachments + render-as-files
- Composer attachment store is now **multi-file**: `attachedFiles = ref<Attachment[]>([])`
  in `useAttachment.ts` (was a single `attachedFile`). Shared by BOTH the Explore
  composer (`ExploreChat.vue`) and the Task form (`DescriptionEditor.vue`) — both
  got `multiple` inputs + a wrapping `.attach-chip-row` with per-file `detach(name)`.
  `attach()` de-dupes by filename; `detachAll()` clears after a send.
- **Display ↔ API decoupling** (the important bit): a user `ChatMessage.content`
  holds ONLY the typed text; files live on `message.attachments` (`{name,size,content}`,
  type in `api.ts`). File bodies are re-inlined into the upstream string ONLY in
  `useLLM.ts` when building `apiMessages` (`inlineAttachments(msg.content, msg.attachments)`).
  So the bubble renders **clickable file cards** (ChatBubble `.attach-card`, downloads via
  `downloadFile`) instead of a wall of inlined text, while the model still gets the content.
- `applyAttachment()` is now a thin wrapper over the pure `inlineAttachments(text, files)`.
  Never inline files into displayed/persisted content again — only at apiMessages build time.
- Persistence mirrors toolEvents: `addRecord(…, attachments?)` + `_restoreInto` use the
  same conditional-spread so cards survive reload/replay/continue and stay byte-identical
  for non-attachment records.
- Ties into v10.151: the 92KB projection (composer badge + `handleExploreSend`) re-inlines
  each message's attachments so the measured size matches what is actually sent.
- Shared `createStreamFlow` was touched (re-inline loop) but it's a no-op without
  attachments, so Task mode / the MCP-gateway path is unaffected — rule still respected.

## v10.153 — Rename chat-log headers in history
- Sessions are derived groupings keyed by `sessionId` with NO stored title. Custom
  names live in a separate localStorage store `coach-session-names` in
  `useCoachHistory.ts` (`sessionNames` ref + `getSessionName`/`setSessionName`).
  Header in `CoachHistoryTab.vue` shows custom name, else `firstUserPreview()`.
- Trigger: pencil button (revealed on `.session-header` hover) → inline `<input>`;
  Enter/blur saves, Esc cancels. `@click.stop` on input + `@click.prevent.stop` on
  pencil so editing doesn't toggle the `<details>` card. Blank name deletes the
  custom name (reverts to auto-preview).
- Shared component → works for BOTH Explore and Task coach history (names keyed by
  globally-unique sessionId; no channel gating).
- Cleanup: `clearHistory()` wipes names + LS key; `deleteRecords()` runs
  `pruneOrphanNames()` to drop names whose session has no records left.

## v10.154 — Chat-log buffer indicator
- History action bar (`CoachHistoryTab.vue`) shows a buffer indicator right of the
  "Download Raw" button: `recordCount / MAX_RECORDS` text + a mini progress bar.
- `MAX_RECORDS` (200) is now EXPORTED from `useCoachHistory.ts` (was module-private);
  the cap is GLOBAL across all channels (`addRecord` slices `coachHistory` to 200,
  FIFO). Indicator shows the global count, not per-channel (tooltip notes this).
- Color escalates via classes: blue → `buffer-warn` (amber, reuses `isNearCap` ≥180)
  → `buffer-full` (red, `recordCount >= MAX_RECORDS`). Fill width = recordCount/MAX_RECORDS.
- Reused existing `recordCount` + `isNearCap`; only new export was `MAX_RECORDS`.
  i18n `coach.historyBufferTitle` ({n}/{max} via manual replace).

## v10.155 — Collapse history session cards by default
- `CoachHistoryTab.vue` grouped-session `<details>` no longer has the `open`
  attribute — chat-log cards start collapsed so a long history is scannable.
  Summary header (rename pencil, preview, time+count, Continue) stays visible;
  click to expand. Native `<details>`, no JS state; resets on tab remount.
  Chevron handled by existing `details[open] > .session-header::before` rotation.

## v10.156 — Fix composer attachment "×" clipped for long filenames
- Attachment chips (`.attach-chip` in ExploreChat.vue + DescriptionEditor.vue) had
  the `×` remove button clipped for longer filenames: the chip was inline-flex with
  `max-width + overflow:hidden` and the filename was a bare text node (min-width:auto)
  that wouldn't shrink, pushing the × past the clip boundary.
- Fix: filename now lives in `<span class="attach-chip-name">` (flex:1; min-width:0;
  overflow:hidden; text-overflow:ellipsis) so ONLY the name truncates; icon + ×
  stay `flex-shrink:0` and always visible. Chip dropped its own overflow/ellipsis.
  `:title="f.name"` shows full name on hover. `detach(name)` was already correct.
- Lesson: when a flex "chip/pill" gains trailing controls, truncate the text child,
  not the whole flex container — container overflow:hidden clips the controls.

## v10.157 — Context limit measured in TOKENS (was bytes)
- SUPERSEDES the v10.151 byte-based context guardrail. `contextCalculator.ts` now
  ESTIMATES TOKENS, not bytes: `estimateTokens(text)` = CJK chars (`/[　-鿿＀-￯]/`) ≈1
  token each + remaining chars/4; `estimateContextTokens` adds 4 tokens/message
  overhead. `contextUsage` → `{ tokens, limit, percent, over }`; `formatTokens`
  (`1.5K`/`128K`). (`contextBytes`/`formatKB` are gone.)
- Why: LLM context windows are token-based; bytes are language-inconsistent
  (EN ~4 bytes/tok, ZH ~2–3) — bad for a bilingual app. It's a pre-send WARNING
  guardrail (model still enforces the real limit), so an estimate is fine — no
  tokenizer dependency added.
- `config/llm.ts`: `DEFAULT_CONTEXT_LIMIT_TOKENS=128000` + `MODEL_CONTEXT_LIMITS`
  (tokens, real per-model windows, ordered MOST-SPECIFIC FIRST since first
  `includes` wins) + `getContextLimitTokens()`. Edit these as models change.
- Badge shows `1.2K / 128K tok`; i18n `contextBadgeTitle`/`contextOverLimit` say tokens.

## v10.158 — Two model fields + Explore composer model picker
- LLM Settings now has TWO model slots (was single `glm-model`): `model-1` (Task +
  default Explore) and `model-2` (optional secondary), plus `explore-model` (which
  one Explore uses). `config/llm.ts`: `model1`/`model2`/`taskModel`/`exploreModel`
  refs, `availableModels` (computed, drops empty model2), `getModel1/2`+`setModel1/2`,
  `getTaskModel`, `getExploreModel`+`setExploreModel`, `reconcileExplore`.
  REMOVED `getModel`/`setModel`/`currentModel` — use `getTaskModel`/`taskModel`
  (Task surfaces) or `getExploreModel`/`exploreModel` (Explore) instead.
- `getModel1()` migrates legacy `glm-model` → no data loss for existing users.
- Per-path model: direct path (`_callGLMStream`, Task/Analyze) sends `getTaskModel()`;
  brokered path (`_callBrokeredLLM`, Explore) sends `getExploreModel()`. Server
  unchanged (forwards client's `model`).
- Explore composer has a `<select>` over `availableModels`; Task is locked to Model 1.
- Export/import settings JSON: `model-1`/`model-2` (was `glm-model`); import still
  reads old `glm-model` as Model 1.
- `getContextLimitTokens(model = getExploreModel())` default is now the Explore model.

## v10.159 — Brokered (Explore) errors must ride the `data:` channel
- BUG (fixed): Explore could give an empty reply with NO error toast. The server
  (`server/routes/llm.ts`) writes SSE headers immediately, so upstream failures hit
  the catch with `headersSent` already true and were written as an SSE COMMENT
  (`: error ...`). The client (`_callBrokeredLLM`) only parses `data:` lines, so it
  silently ignored the comment → blank bubble.
- Fix: server `writeSSEError()` emits `data: {"error":{"message":...}}`; client parses
  `{error}` and `throw`s so `createStreamFlow` → `handleExploreSend` shows the toast.
- LESSON: on the brokered SSE path, anything the SPA must see (incl. errors) MUST be a
  `data:` event, never an SSE comment. Also narrowed the client's JSON.parse `try` so a
  real thrown error isn't swallowed by the "ignore malformed line" catch.
- Common real trigger this now surfaces: the Explore-selected model isn't served by the
  proxy, or the brokered server (`deploy/.env`) lacks its baseURL/key. Task mode uses the
  direct browser path, so Task working + Explore silent ⇒ brokered server/model issue.

## v10.160 — Explore multi-modal (image attachments)
- Explore composer accepts images (png/jpg/jpeg/gif/webp, ≤4MB) → vision model. EXPLORE
  ONLY; Task stays text-only. `Attachment` gained `kind:'text'|'image'` + `mime`; images
  read as base64 data URLs.
- THREE representations of an attachment (don't conflate):
  1) Display: ChatBubble renders image `kind` as `<img class="attach-image">` thumbnail.
  2) API: `buildMultimodalContent()` (used only when `createStreamFlow` opt `multimodal:true`,
     set on exploreCoach) → OpenAI parts `[{type:'text'},{type:'image_url',image_url:{url}}]`.
     `LLMChatMessage.content` is now `string | LLMContentPart[]`; server schema content is
     `oneOf[string,array]`; ChatOpenAI/ReactAgent handle vision.
  3) Persistence: SESSION-ONLY. `stripImageContent()` blanks image base64 before `addRecord`
     (useLLM) and before `saveResponsesToStorage` (App.vue) — base64 would blow the
     localStorage quota. Reloaded images show `coach.imageNotRetained` placeholder.
- `inlineAttachments()` renders images as `[Image: name]` placeholder (NEVER base64) so the
  text/direct path and the token guard never carry base64. Token guard counts images at a
  flat ~800 tokens (`PER_IMAGE_TOKENS` in contextCalculator), not the data URL.

## v10.161 — Explore server↔upstream config & TLS (debugging guide)
- Explore (brokered) does NOT use the SPA "LLM Settings" — those drive ONLY Task (direct
  browser path). Explore uses the SERVER env from `deploy/.env`: `LLMPROXY_BASE_URL` +
  `LLMPROXY_API_KEY` (read in `server/llm/openai-client.ts`). So "I set the LLM setting but
  Explore fails" is expected.
- Symptom seen: Task works, Explore "Connection error." then "terminated". Both = server↔proxy
  transport failure (surfaced by v10.159). Classic cause: the NODE server doesn't trust the
  corporate TLS cert the BROWSER trusts (browser=OS/corp CA, Node=own bundle).
- Diagnosis aids added: `server/routes/llm.ts` now appends `err.cause.code` to the toast +
  logs `causeCode/causeMsg` (TLS code like DEPTH_ZERO_SELF_SIGNED_CERT vs UND_ERR_SOCKET/
  ECONNRESET). `openai-client.ts` boot-logs the proxy URL/key/insecure status.
- Fixes: `LLMPROXY_INSECURE_TLS=true` (DEV escape hatch → sets NODE_TLS_REJECT_UNAUTHORIZED=0)
  or PROD-correct `NODE_EXTRA_CA_CERTS=<corp-root-ca.pem>` (must be a REAL env var before Node
  starts — NOT via --env-file). Server `bodyLimit` raised 1MB→8MB (`LLM_BODY_LIMIT_MB`) so
  multi-modal image turns don't 413.

## v10.162 — Explore UND_ERR_SOCKET after model-selection (key entitlement, NOT MCP)
- Regression timeline: Explore worked when it sent ONE fixed model; v10.158 made it send the
  SELECTED model (`getExploreModel()`), after which both models → `terminated (UND_ERR_SOCKET)`.
  MCP/tools is NOT the cause (bound since v10.133, before the regression).
- Root-cause class: Explore (server path) authenticates to the proxy with the SERVER's
  `deploy/.env` `LLMPROXY_API_KEY`, which is a DIFFERENT credential than the SPA key Task uses.
  `UND_ERR_SOCKET` (proxy closes, no HTTP response) ⇒ gateway-level reject — most likely the
  server key isn't entitled to the selected model. Same model working in Task ≠ working in
  Explore because of the different key/path.
- Diagnostics added: `server/routes/llm.ts` logs `llm/chat request {model,tools,multimodal}`
  and appends `[model=…]` to the surfaced error → the toast shows EXACTLY which model the
  server tried. `EXPLORE_DISABLE_MCP=true` strips tool-binding (isolation lever; not the fix).
- Lesson: when debugging Explore-only failures, FIRST confirm the exact model the server sent
  and that `LLMPROXY_API_KEY` is entitled to it — don't assume model parity with Task.

## v10.163 — ACTUAL root cause of Explore UND_ERR_SOCKET: empty assistant messages in history
- CORRECTION to v10.162: it was NOT key entitlement and NOT the model. The captured request
  payload showed the `messages` array full of `{role:'assistant',content:''}` from prior FAILED
  turns. The client re-sends the whole history every turn → the proxy rejects requests that
  contain empty assistant messages → drops the socket (`UND_ERR_SOCKET`). Self-perpetuating:
  one failure left an empty placeholder, poisoning all later turns and piling up more.
- Why it persisted: `createStreamFlow`'s generic-error AND cancel branches left the empty
  assistant placeholder in `messages.value` (only the 429 branch popped it). New chat "didn't
  help" because any single failure immediately re-polluted.
- Fix (v10.163): `apiMessages` now SKIPS empty turns (`!content.trim() && !attachments`) so empty
  assistant/user messages are never sent; generic-error + cancel branches POP the empty
  placeholder. Also: images sent only for the CURRENT turn + a vision model (`isVisionModel()` in
  config/llm.ts; history/text models → `[Image: name]` placeholder), and New chat calls `detachAll()`.
- LESSON: never ship empty assistant messages to an OpenAI-compatible proxy; clean failed-turn
  placeholders out of chat history before re-sending. The decisive diagnostic was the actual
  Network request payload, not the model/key.
- (v10.163 was a real bug + needed fix, but NOT the final cause — see v10.164.)

## v10.164 — THE final cause of Explore UND_ERR_SOCKET: Fastify coerced string content → array
- After v10.163 the wire payload was clean (all-string `content`) yet the server STILL logged
  `multimodal:true` and dropped. Wire shows string, server sees array ⇒ Fastify/ajv COERCED it.
- Cause: the v10.160 server schema change `content: oneOf:[{type:'string'},{type:'array'}]` +
  Fastify's default ajv type-coercion rewrote the string `content` into an array → corrupted
  payload → proxy rejects → socket drop. Broke at v10.160 exactly; pre-v10.160 `{type:'string'}`
  never coerced. Hit ALL models / every text turn / `multimodal:true` with no image.
- Fix: `server/routes/llm.ts` `content` schema → `{}` (no `type` ⇒ ajv leaves it untouched;
  string stays string, real vision parts-array stays array). Added `contentTypes` to the request
  log. Regression test: string content reaches the agent as a string.
- BIG LESSON: a `oneOf`/multi-type request schema for a field + Fastify ajv `coerceTypes` can
  silently MUTATE request data. If wire ≠ what the handler sees, suspect schema coercion. For
  pass-through fields that may be string OR structured, use `content: {}` (no type), not `oneOf`.
- Diagnostic that cracked it: compare the DevTools Network request payload (wire) against what
  the server logs/forwards (handler) — the mismatch pinpointed coercion.

## v10.165 — Image attachment gated to vision models (qwen) in Explore
- `ExploreChat.vue`: `acceptHint` is computed from `isVisionModel(exploreModel)` — text models
  (minimax) get a text-only file picker; vision models (qwen) also accept images. `handleFileSelect`
  rejects image files on a text model (`toast.imageNeedsVisionModel`); `onModelChange` drops any
  already-attached images when switching to a text model. Backstop is the v10.163 send-time gating.
- A full "Lessons Learned" retrospective of the Explore UND_ERR_SOCKET saga (4 layers: invisible
  errors → empty-assistant re-send → stale image → Fastify content coercion) is in PLAN.md under
  the v10.165 entry. Key meta-lesson: when wire ≠ handler, suspect request-schema coercion.

## v10.166 — Readable model-select dropdown
- Native `<select>` dropdowns default to a near-white option list. Style `.composer-model-select
  option` with `background-color: var(--bg-secondary)` + `color: var(--text-primary)` so options
  match the composer surface and are readable (Chromium/Edge honor option bg/color).

## v10.167 — Explore message UX (user meta-row, AI elapsed header, no empty-state flash)
- `ChatBubble` is shared by Task (bubble) + Explore (stacked). New chat UX is **Explore-only** —
  gate every addition on `layout === 'stacked'` so Task is untouched (project rule).
- User meta-row (date · Retry · Edit · Copy) sits under the user bubble, revealed on
  `.chat-msg:hover` / `:focus-within`. Copy uses `@/utils/clipboard` `copyText` (never raw clipboard).
- Retry/Edit on ANY user turn = truncate everything after it (drop reply + later turns + their
  history records via `hashId` → `deleteRecords`) then regenerate. Built on the existing
  `request(payload, _isAutoRetry=true)` primitive via new `regenerate(payload?)` flow method
  (`regenerateExploreCoach`); history is rebuilt from the message array so edited text flows through
  without re-pushing a user turn. Pass a fresh `buildPayload('coach')` so it works post-reload
  (when `_lastPayload` is null). Edit also calls `updateRecordContent(hashId, text)`.
- "Thought for Xs" header = time-to-first-token: `ChatMessage.firstTokenMs` set in `useLLM` on the
  first chunk (`streamStart − assistant.timestamp`; placeholder timestamp = request-start).
- "No content available" came from `formatCoach` on empty content. Fix is in `ChatBubble`'s content
  watcher: keep `formattedContent=''` for empty content. Do NOT `v-if` `.coach-response` — its click
  listener is attached once in `onMounted`, so the element must stay in the DOM.

## v10.168 — Locale-aware dates must use the app toggle, not OS fallback
- `toLocaleDateString(undefined, …)` falls back to the **OS locale** — on a zh Windows box that
  renders Chinese dates even in English mode. Always pass an explicit locale tied to the app's
  language toggle: `isZh.value ? 'zh-CN' : 'en-US'` (see `ChatBubble.vue` `dateLabel`).

## v10.169 — Per-session history download named by label
- History export functions (`exportAsJson/Markdown/Records` in `useCoachHistory.ts`) take an optional
  `baseName?`; default stays `coach-history-<date>` so the action-bar merge-all path is unchanged.
  Per-session download passes `sanitizeFilename(sessionTitle(group))` (custom name ?? first-message
  preview). `sanitizeFilename` strips `\ / : * ? " < > |`, collapses whitespace, caps 60, falls back 'chat'.
- UI: hover-revealed download icon in each `CoachHistoryTab` session header → reuses `DownloadModal`
  (format chooser) but scoped to one session via `downloadSessionId`. Ungrouped/legacy records have no
  label so they keep only the action-bar export.

## v10.170 — Bare (un-delimited) LaTeX auto-wrap for KaTeX
- Math renderer = KaTeX via remark-math/rehype-katex in `src/utils/markdown.ts` (kept; correct choice —
  sync/streaming-friendly, NOT MathJax). All preprocessing assumed DELIMITED math (`$ $$ \[ \(`); models
  that ignore the `$`-delimiter system-prompt instruction emit bare LaTeX that leaked as text.
- Fix: `wrapBareLatex()` conservatively wraps a whole line in `$$…$$` only when it's clearly a standalone
  equation (no `$`, no `|`, no CJK, not a markdown structural line, has a strong LaTeX command or `ident=…\cmd`
  shape, ≤2 prose words). MUST track BOTH fenced-code state AND open multiline `$$` blocks (inner lines have no
  `$` of their own — wrapping them corrupts the block; that was the first-cut regression). Also un-doubles
  `\cmd`→`\cmd` within wrapped lines. Inline bare LaTeX in prose is intentionally NOT handled (false-positive risk).
- Also strengthened `response-format.md` (ALWAYS delimit; never raw commands; no doubled backslashes).

## v10.171 — Brand renamed AGec → EXA (language-agnostic gradient wordmark)
- App brand mark is **EXA** (was AGec). It is English-only / NOT translated — `AppHeader.vue` renders a
  single `aria-label="EXA"` wordmark regardless of the language toggle (no more `currentLang` v-if split).
- Artistic treatment: `.brand-exa` = purple→blue gradient text (reuses `--accent-purple`/`--accent-blue`,
  the Explore-hero/thinking-orb gradient); `.brand-x` is the focal glyph (brighter blue→cyan gradient,
  1.18em, weight 900, stronger glow) symbolizing "infinite boundaries (X)". Old `.logo-a/.logo-g/.logo-ec` removed.
- `index.html` title = EXA, html lang = en. `header.title` i18n key = 'EXA' in both locales (only the
  removed ZH header branch used it).

## v10.172 — Brand is EAX (was EXA); dots mirror letter colors
- Final brand mark order is **EAX** (E A X), NOT EXA. `AppHeader.vue` wordmark uses three per-letter
  solid brand colors: `.brand-e` purple (`--accent-purple`), `.brand-a` blue (`--accent-blue`),
  `.brand-x` cyan `#22d3ee` (focal: larger/heavier/glow). The three header dots `.dot-e/.dot-a/.dot-x`
  use the SAME three colors left→right so they mirror the letters (replaced the old mac red/amber/blue).
- All brand strings = 'EAX' (index.html title, i18n header.title en+zh, aria-label).

## v10.173 — Claude-style borderless tables in Explore (stacked)
- Markdown tables are wrapped in `<div class="table-scroll">` by `markdown.ts` (flat replace before
  DOMPurify) for horizontal scroll; the base `.coach-response table` no longer uses `display:block`
  (that caused shrink-wrap/narrow tables) — it's `display:table; width:100%` now, filling the column.
- Explore Claude look is scoped to `.layout-stacked .coach-response` (table/th/td): borderless, no header
  fill, bold header with single bottom border, thin row dividers only, airy padding, sans font, flush-left
  first column. Task (bubble) keeps the boxed grid (now full-width). See `src/styles/coach-response.css`.

## v10.174 — AI file blocks → download chip (`:::file` verbatim, streaming-safe)
- AI can emit `:::file name="x.md"` … `:::` (open-source remark-directive `:::` convention) and it renders
  as a single download chip. `extractFileBlocks()` in `markdown.ts` runs FIRST: fence-aware line scanner,
  captures the body VERBATIM into `<div class="file-artifact" … data-content-b64>` (UTF-8 base64, inert
  through remark/rehype/DOMPurify). Body is NEVER parsed → inner ```/tables/math can't break it.
- Streaming: an unterminated `:::file` → `file-artifact--pending` chip and the partial body is DROPPED
  (no spill/truncation before the closing `:::`).
- Non-interference is the key constraint: extractor only matches exact `:::file`/`:::` LINES (and skips code
  fences), so normal inline `$…$`/`$$`/`|tables|` are untouched (tests in `fileArtifact.test.ts` assert this).
- Chip render/click in `codeArtifact.ts` (`enhanceFileArtifacts` + `handleArtifactClick` file branch, base64
  `encodeContent`/`decodeContent`, `fileMetaForFilename`); invoked from `ChatBubble.enhanceArtifacts`.
  System prompt (`response-format.md`) teaches the convention, scoped to explicit file requests only.

## v10.179 — Docker deploy: pass LLM env into the container
- The container CMD does NOT load deploy/.env; runtime env must be in the compose `environment:` block.
  Added `LLMPROXY_BASE_URL/LLMPROXY_API_KEY/EXPLORE_DISABLE_MCP/INTERNAL_API_TOKEN` (interpolated from
  deploy/.env, like QUALITY_API_KEY). Previously only QUALITY_API_KEY was passed → prod Explore/Task chat
  would 502. (This LLM-env fix was kept when the v10.175–v10.179 Mermaid/PlantUML diagram feature was
  rolled back to v10.174.)
- Dev gotcha: editing deploy/.env does NOT restart `npm run server` (tsx watch only watches source) — must
  force-kill the port (`Get-NetTCPConnection -LocalPort 8080 … Stop-Process`) and restart.

## v10.175 (post-rollback) — SVG artifact preview was blank white
- `:::file name="*.svg"` cards open in `ArtifactPanel` Preview (`kind:'svg'` → iframe `srcdoc` = `SVG_WRAP_STYLE` +
  source). Blank-but-Code-shows-source means the render, not the pipeline, is the problem. Two causes for AI
  SVGs: white/transparent art on a flat `#fff` bg (invisible), and `width/height="100%"` collapsing in a
  flex/centered box. Fix in `SVG_WRAP_STYLE`: light CHECKERBOARD backdrop (reveals white/transparent art) +
  `svg{width:auto;height:auto;max-width/height:100%}` (renders at viewBox intrinsic size, scaled to fit).
  Reuse this pattern for any standalone-SVG/image preview.

## v10.176 — File-as-card is prompt-driven, not heuristic
- "Requested file → download card; illustrative code → inline" is an INTENT decision only the model can make,
  so it lives in `src/config/skills/response-format.md`, NOT in rendering. `:::file name="…"` always cards
  (any length, both layouts); plain ```fences collapse only at 40 lines (`LONG_CODE_LINE_THRESHOLD`).
- Explore's whole system prompt = `getResponseFormat()` (`useLLM.ts:677`); Task/Analyze append it. A
  localStorage `response-format` override (Settings edit) SHADOWS the default `.md` until reset — check this
  first if a prompt edit "doesn't take effect".

## v10.177–v10.178 — Artifact card names (model name, else section heading)
- The deployed GWM model does NOT reliably emit `:::file` or fence filenames even for explicit file requests
  (snapshot showed a 719-line ```html → card titled `snippet.html`). So prompt-only naming is insufficient;
  the renderer must derive a name. Don't assume prompt directives like `:::file` are honored.
- Naming priority in `enhanceCodeBlocks` (`codeArtifact.ts`): fence filename (```lang name.ext, carried by
  `remarkCodeFilename` in `markdown.ts` as `<code data-filename>`) → `detectFilenameHint` (first-line `// app.js`)
  → **nearest preceding heading** (`nearestHeading()` scans prev siblings + climbs; `safeNamePart` keeps CJK) →
  `snippet.ext`. Heading-derivation is the model-agnostic fallback that fixed the "snippet" complaint.
- `:::file name="…"` cards were already AI-named. AST/DOM over regex: fence meta via mdast `hProperties`, heading
  via DOM walk — never regex the rendered HTML.
- The fence filename is carried AST-side: `remarkCodeFilename` in `markdown.ts` copies a `code` node's info-string
  filename onto the rendered `<code>` as `data-filename` (survives rehype-highlight + DOMPurify). Reuse this
  pattern (mdast `hProperties`) to surface any fence metadata in the DOM — do NOT regex the rendered HTML.
- `:::file name="…"` cards were already named (AI-supplied). All naming intent comes from the model via the
  prompt's "Naming" section in `response-format.md`.

## v10.179 — rehype-highlight `languages` REPLACES the default set (highlighting gotcha)
- Syntax highlighting was silently dead for python/cpp/js/etc.: `markdown.ts` passed
  `rehypeHighlight({ languages: { cmake, makefile } })`. In rehype-highlight v7 the `languages` map
  **overrides** lowlight's `common` bundle instead of extending it — so only the two custom langs tokenized;
  everything else got an `hljs language-*` class but **no token spans** (looked highlighted, wasn't). This was
  the long-standing "pre-existing, unrelated" `formatCoach.test.ts` hljs failure.
- Fix: `import { common } from 'lowlight'` and spread it back — `languages: { ...common, cmake, makefile }`.
  Any time you add a custom highlight.js language, you MUST spread `common` too or you nuke all the defaults.
- Side effect to watch: tests that assert a literal code string (e.g. `self.m = m`) break once highlighting
  works, because token spans split the text. Assert a contiguous sub-slice (`.m = m`) instead.
- The `===COACH_TURN===` coach divider is GONE by design (multi-turn = separate ChatMessage[] entries since the
  Coach chat-UI redesign). Dead CSS `.coach-response-divider` lingers but nothing emits the marker.
