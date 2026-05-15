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
