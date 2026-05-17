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
