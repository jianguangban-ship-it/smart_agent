# Redesign Plan: JIRA AI-Powered Task Workstation v8.0

## Analysis of Current Application

The existing app is a **single HTML file (~1200 lines)** that bundles:
- Vue 3 (from CDN)
- Tailwind CSS (from CDN)
- All logic, styles, config, and i18n in one file

**Current features:**
1. Three-column layout: AI Coach | Task Form | AI Review + JIRA Response
2. Structured 5-part task summary builder (Vehicle/Product/Layer/Component/Detail)
3. Searchable assignee combobox with team filtering
4. AI Coach guidance with quick-action template chips
5. AI Agent analysis + JIRA ticket creation (2-step workflow)
6. Quality score progress bar with live preview
7. i18n (EN/ZH), Test/Prod mode toggle
8. JSON response panels with syntax highlighting

**Problems to solve:**
- Depends on CDN (Vue, Tailwind) — cannot run offline
- Monolithic single file — hard to maintain
- No type safety
- Limited interactivity and UX polish

---

## Technology Choice: TypeScript + Vite + Vue 3

**Why TypeScript over plain JavaScript:**
- Type safety for complex form state, API payloads, and config data
- Better IDE autocomplete for the large team/project configuration objects
- Catches errors at build time (e.g., wrong payload shape sent to webhook)
- Better maintainability as the project grows

**Stack:**
| Layer | Choice | Reason |
|-------|--------|--------|
| Language | **TypeScript** | Type safety, maintainability |
| Framework | **Vue 3 + Composition API** | Already familiar from current code, SFC support |
| Build Tool | **Vite** | Fast dev server, zero-config TS support, bundles everything locally |
| Styling | **CSS Modules + CSS Custom Properties** | No CDN needed, scoped styles per component |
| Icons | **Inline SVG components** | No external icon library needed |
| State | **Vue Reactivity (ref/reactive)** | Already used, no extra library needed |

**All dependencies installed locally via npm — zero internet needed at runtime.**

---

## New Project Structure

```
requirement_engineering_agent/
├── index.html                    # Entry HTML (minimal shell)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts                   # App bootstrap
│   ├── App.vue                   # Root layout component
│   ├── styles/
│   │   ├── variables.css         # CSS custom properties (theme tokens)
│   │   ├── global.css            # Base styles, scrollbar, animations
│   │   └── transitions.css       # Vue transition classes
│   ├── i18n/
│   │   ├── index.ts              # i18n composable (useI18n)
│   │   ├── en.ts                 # English translations
│   │   └── zh.ts                 # Chinese translations
│   ├── config/
│   │   ├── projects.ts           # PROJECT_CONFIG, TEAM_MEMBERS
│   │   ├── constants.ts          # TASK_TYPES, FIBONACCI, VEHICLE/PRODUCT/LAYER options
│   │   └── webhook.ts            # WEBHOOK_CONFIG, URL mode logic
│   ├── types/
│   │   ├── form.ts               # FormState, SummaryState interfaces
│   │   ├── api.ts                # Payload, AIResponse, JiraResponse types
│   │   └── team.ts               # TeamMember, Project interfaces
│   ├── composables/
│   │   ├── useForm.ts            # Form state, validation, quality score
│   │   ├── useWebhook.ts         # API call logic (analyze, create, coach)
│   │   ├── useCombobox.ts        # Searchable dropdown logic
│   │   └── useToast.ts           # Toast notification system
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppHeader.vue     # Header with lang/mode toggles
│   │   │   └── PanelShell.vue    # Reusable panel wrapper (header + body + resize)
│   │   ├── form/
│   │   │   ├── TaskForm.vue      # Main form container
│   │   │   ├── BasicInfoSection.vue    # Project, Assignee, Type, Points
│   │   │   ├── SummaryBuilder.vue      # 5-part summary with live preview
│   │   │   ├── DescriptionEditor.vue   # Description textarea with templates
│   │   │   ├── AssigneeCombobox.vue    # Searchable assignee selector
│   │   │   ├── StoryPointsPicker.vue   # Fibonacci point selector
│   │   │   └── QualityMeter.vue        # Quality score bar + label
│   │   ├── panels/
│   │   │   ├── CoachPanel.vue          # AI Coach panel (left)
│   │   │   ├── AIReviewPanel.vue       # AI Agent review panel (right)
│   │   │   ├── JiraResponsePanel.vue   # JIRA creation result (right)
│   │   │   └── ProcessingSummary.vue   # Summary card after analysis
│   │   ├── shared/
│   │   │   ├── StatusDot.vue           # Animated status indicator
│   │   │   ├── JsonViewer.vue          # Syntax-highlighted JSON display
│   │   │   ├── IconButton.vue          # Reusable icon button
│   │   │   ├── ToastContainer.vue      # Toast notification overlay
│   │   │   └── QuickChip.vue           # Quick action chip button
│   │   └── dev/
│   │       └── DevTools.vue            # Payload viewer + webhook config (collapsible)
│   └── utils/
│       ├── formatJson.ts         # JSON syntax highlightingp
│       ├── formatCoach.ts        # Coach response markdown→HTML parser
│       └── validators.ts         # Form validation helpers
```

---

## UI/UX Redesign Ideas

### 1. Improved Layout (Responsive Three-Column)

```
┌──────────────────────────────────────────────────────────────────┐
│  [Logo] JIRA AI Task Workstation v8.0     [EN|中文] [Test|Prod] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ AI Coach ──────┐  ┌─ Task Form ───────┐  ┌─ AI Review ───┐ │
│  │                  │  │ ┌──────────────┐  │  │               │ │
│  │  Guidance &      │  │ │ Basic Info   │  │  │  AI Agent     │ │
│  │  Suggestions     │  │ │ Project|Type │  │  │  Response     │ │
│  │                  │  │ │ Assignee     │  │  │               │ │
│  │  [Quick Chips]   │  │ └──────────────┘  │  ├───────────────┤ │
│  │                  │  │ ┌──────────────┐  │  │               │ │
│  │  ─ ─ ─ ─ ─ ─ ─  │  │ │ Summary      │  │  │  JIRA Result  │ │
│  │                  │  │ │ [5-part]     │  │  │               │ │
│  │  Coach response  │  │ │ Live Preview │  │  ├───────────────┤ │
│  │  with formatted  │  │ │ Quality ████ │  │  │  Summary Card │ │
│  │  markdown        │  │ └──────────────┘  │  │  Points|Tasks │ │
│  │                  │  │ ┌──────────────┐  │  │               │ │
│  │                  │  │ │ Description  │  │  ├───────────────┤ │
│  │                  │  │ │              │  │  │ ▶ Dev Tools   │ │
│  │                  │  │ └──────────────┘  │  │   (collapsed) │ │
│  │ [Get Guidance]   │  │ [Reset] [Analyze] │  │               │ │
│  └──────────────────┘  │         [Create]  │  └───────────────┘ │
│                        └───────────────────┘                     │
├──────────────────────────────────────────────────────────────────┤
│  Toast notifications appear here (bottom-right, auto-dismiss)    │
└──────────────────────────────────────────────────────────────────┘
```

### 2. New Interactive Features

| Feature | Description |
|---------|-------------|
| **Toast Notifications** | Replace inline error banner with stackable toasts (success/error/warning) that auto-dismiss after 5s. Less intrusive, won't shift layout. |
| **Keyboard Shortcuts** | `Ctrl+Enter` = Submit/Analyze, `Ctrl+Shift+Enter` = Create JIRA, `Escape` = Close dropdowns. Shortcut hints shown on buttons. |
| **Form Section Collapse** | Each form section (Basic Info, Summary, Description) can be collapsed/expanded. Sections auto-expand when incomplete. |
| **Smooth Transitions** | Vue `<Transition>` for panel content changes, dropdown open/close, button state changes. |
| **Better Loading States** | Skeleton placeholders instead of spinner-only states in panels. Shows progress context. |
| **Confirmation Dialog** | Before JIRA creation ("Confirm Create"), show a modal with payload summary for final review. |
| **Auto-save Draft** | Form state persisted to `localStorage`. Restore on page reload with "Resume draft?" prompt. |
| **Resizable Panels** | CSS `resize` handle on coach and review panels (kept from original, improved with drag handle visual). |
| **Copy to Clipboard** | One-click copy for JSON payloads, JIRA ticket IDs, and formatted summaries. |

### 3. Visual Design Improvements

- **Consistent spacing**: 8px grid system instead of mixed px values
- **Better color contrast**: Ensure WCAG AA compliance for all text
- **Subtle gradients**: Header and panel headers use subtle gradient backgrounds
- **Focus indicators**: Clear focus rings for accessibility (keyboard navigation)
- **Empty states**: Illustrated empty states with contextual guidance (not just text)
- **Button hierarchy**: Primary (filled) → Secondary (outlined) → Ghost (text-only)
- **Micro-animations**: Button press scale, input focus glow, status dot pulse

---

## Implementation Steps

### Step 1: Project Scaffolding
- Initialize Vite + Vue 3 + TypeScript project
- Install all dependencies locally (vue, typescript, vite)
- Configure `tsconfig.json`, `vite.config.ts`
- Create directory structure

### Step 2: Type Definitions & Config
- Define TypeScript interfaces (`FormState`, `TeamMember`, `Project`, `APIPayload`, etc.)
- Migrate `PROJECT_CONFIG`, `TEAM_MEMBERS`, constants to typed config files
- Migrate `WEBHOOK_CONFIG` with typed URL mode logic

### Step 3: Core Composables
- `useI18n()` — reactive language switching with typed translation keys
- `useForm()` — form state, computed summary, quality score, validation
- `useWebhook()` — API calls (analyze, create, coach) with error handling
- `useCombobox()` — dropdown state, filtering, keyboard navigation
- `useToast()` — toast notification queue with auto-dismiss

### Step 4: Shared Components
- `PanelShell.vue` — reusable wrapper with header, status dot, resizable body
- `StatusDot.vue`, `JsonViewer.vue`, `QuickChip.vue`, `IconButton.vue`
- `ToastContainer.vue` — fixed-position toast overlay

### Step 5: Form Components
- `AssigneeCombobox.vue` — searchable dropdown with highlight matching
- `SummaryBuilder.vue` — 5-part inputs + live preview + quality meter
- `DescriptionEditor.vue` — textarea with template chip insertion
- `StoryPointsPicker.vue` — Fibonacci button group
- `BasicInfoSection.vue` — project select, assignee, type
- `TaskForm.vue` — orchestrates all form sections

### Step 6: Panel Components
- `CoachPanel.vue` — AI coach with chips, loading state, formatted response
- `AIReviewPanel.vue` — AI analysis JSON display
- `JiraResponsePanel.vue` — JIRA creation result
- `ProcessingSummary.vue` — summary card with corrected points, subtask count
- `DevTools.vue` — collapsible payload viewer + webhook config

### Step 7: Layout & App Shell
- `AppHeader.vue` — logo, title, lang toggle, mode toggle, status badge
- `App.vue` — three-column grid layout, responsive breakpoints
- Global styles: CSS variables, animations, transitions

### Step 8: Polish & Testing
- Add keyboard shortcuts (`Ctrl+Enter`, etc.)
- Add localStorage draft auto-save/restore
- Add `<Transition>` animations on panel content
- Cross-browser test (Chrome, Firefox, Edge)
- Verify fully offline operation (no network requests for assets)

---

## How to Run Locally

After implementation, the user runs:

```bash
# Install dependencies (one-time, requires internet)
npm install

# Start dev server (no internet needed after install)
npm run dev
# → opens http://localhost:5173

# Build for production (static files, no server needed)
npm run build
# → outputs to dist/ folder, open dist/index.html
```

---

## Summary

| Aspect | Current | Redesigned |
|--------|---------|------------|
| Files | 1 HTML (1200 lines) | ~30 focused files |
| Language | JavaScript | TypeScript |
| Dependencies | CDN (online) | npm (local) |
| Styling | Inline + Tailwind CDN | CSS Modules + Custom Properties |
| Components | Monolithic | 15+ SFC components |
| Error handling | Inline banner | Toast notifications |
| State persistence | None | localStorage draft |
| Accessibility | Minimal | Keyboard shortcuts, focus rings |
| Build | None | Vite (instant HMR) |

---

## Completed Improvements — v8.1 (2026-02-22)

### Feature 1: GLM Direct API for AI Coach

Replaced the n8n webhook-only coach path with a unified composable that supports two modes.

**New files:**
| File | Purpose |
|------|---------|
| `src/config/llm.ts` | GLM base URL (`https://open.bigmodel.cn/api/paas/v4/chat/completions`), default model (`glm-4-flash`), localStorage helpers for `glm-api-key` / `glm-model` / `coach-mode`, reactive `coachMode` ref |
| `src/composables/useLLM.ts` | Unified coach composable — reads `coachMode` and routes to GLM API or n8n webhook; owns `isCoachLoading` + `coachResponse` state |
| `src/components/settings/LLMSettings.vue` | Settings modal: GLM/Webhook toggle, API key (password field), model name; saves to localStorage on confirm |
| `src/types/template.ts` | `TemplateDefinition`, `TemplateLabel`, `TemplateContent` interfaces |

**Modified files:**
| File | Change |
|------|--------|
| `src/types/api.ts` | Added `LLMChatMessage`, `LLMRequestBody`, `LLMResponseBody`, `CoachMode` types |
| `src/composables/useWebhook.ts` | Removed `requestCoach`, `coachResponse`, `isCoachLoading` (migrated to `useLLM`) |
| `src/components/layout/AppHeader.vue` | Added ⚙ gear button + `openSettings` emit; clicking opens LLMSettings modal |
| `src/App.vue` | Imports `useLLM`; wires `LLMSettings` modal; `handleCoachRequest` calls `useLLM.requestCoach`; `handleReset` also calls `clearCoachResponse` |
| `tsconfig.json` | Added `"resolveJsonModule": true` |
| `src/i18n/zh.ts` / `en.ts` | Added `settings.*` translation keys (title, coachMode, modeLLM, modeWebhook, apiKey, model, save, cancel, saved) |

**localStorage keys used:**
| Key | Values | Default |
|-----|--------|---------|
| `glm-api-key` | any string | `''` |
| `glm-model` | model name | `glm-4-flash` |
| `coach-mode` | `'llm'` \| `'webhook'` | `'llm'` |

### Feature 2: Template JSON File System

Moved all quick-chip template content out of `App.vue` into independent JSON files.

**New files:**
```
src/config/templates/
├── ac-template.json       key: "template"
├── optimize.json          key: "optimize"
├── bug-report.json        key: "bugReport"
├── change-request.json    key: "changeReq"
└── index.ts               TEMPLATES array + getTemplateContent(key, lang)
```

**JSON file shape:**
```json
{
  "key": "template",
  "icon": "📋",
  "label": { "zh": "AC 模板", "en": "AC Template" },
  "content": { "zh": "...", "en": "..." }
}
```

**Modified files:**
| File | Change |
|------|--------|
| `src/components/panels/CoachPanel.vue` | `chips` computed now maps `TEMPLATES` instead of hardcoded array |
| `src/App.vue` | `applyCoachChip` uses `getTemplateContent(key, lang)` from `index.ts` |

**To add a new template chip:** create a new `.json` in `src/config/templates/` with the correct shape and add one import line + array entry in `index.ts`. No Vue code changes needed.

---

---

## Completed Improvements — v8.2 (2026-02-23)

### Feature: Analyze Mode Switch for AI Review Panel

Mirrors the Coach mode switch pattern. "AI Agent 审核消息" (AIReviewPanel) now supports GLM API or n8n Webhook for the analyze action.

**Architecture change:** `useWebhook.ts` is now JIRA-create-only. Both Coach and Analyze live in `useLLM.ts`, each supporting two modes. `_callGLM` and `_callWebhook` are shared private helpers to avoid duplication.

**Modified files:**
| File | Change |
|------|--------|
| `src/types/api.ts` | Added `AnalyzeMode = 'llm' \| 'webhook'` |
| `src/i18n/zh.ts` / `en.ts` | Added `settings.analyzeMode` key |
| `src/config/llm.ts` | Added `getAnalyzeMode`, `setAnalyzeMode`, `analyzeMode` ref; `LS_KEY_ANALYZE_MODE = 'analyze-mode'` |
| `src/composables/useLLM.ts` | Refactored to shared `_callGLM` + `_callWebhook` helpers; added `isAnalyzeLoading`, `analyzeResponse`, `requestAnalyze`, `clearAnalyzeResponse`; `buildAnalyzeSystemPrompt` added |
| `src/composables/useWebhook.ts` | Removed `analyzeTask`, `aiAgentResponse`; now exports only JIRA create logic |
| `src/components/settings/LLMSettings.vue` | Added Analyze Mode toggle; API key/model fields dim only when BOTH modes are webhook; `bothWebhook` computed |
| `src/components/panels/AIReviewPanel.vue` | Detects `markdown_msg`/`message` key → renders with `formatCoachResponse`; falls back to `JsonViewer` for webhook JSON; added full `:deep()` markdown styles in purple accent |
| `src/App.vue` | `formIsSubmitting` + `formCurrentAction` computed shims; `handleAnalyze` calls `requestAnalyze`; `handleReset` calls `clearAnalyzeResponse`; all bindings updated |

**New localStorage key:**
| Key | Values | Default |
|-----|--------|---------|
| `analyze-mode` | `'llm'` \| `'webhook'` | `'webhook'` |

Default `'webhook'` preserves existing behavior for users who haven't changed the setting.

---

---

## Completed Improvements — v8.3 (2026-02-23)

### Feature: Skill Files for Coach & Analyze System Prompts

Extracted the GLM system prompts from `useLLM.ts` into editable `.md` files. Users can customize AI behavior from the Settings UI without touching code.

**New files:**
| File | Purpose |
|------|---------|
| `src/config/skills/coach-skill.md` | Default coach system prompt (editable) |
| `src/config/skills/analyze-skill.md` | Default analyze system prompt (editable) |
| `src/config/skills/index.ts` | `getCoachSkill(lang)`, `getAnalyzeSkill(lang)`, set/reset helpers; loads via `?raw` import |

**Modified files:**
| File | Change |
|------|--------|
| `src/composables/useLLM.ts` | Removed `buildCoachSystemPrompt` + `buildAnalyzeSystemPrompt`; calls `getCoachSkill(lang)` / `getAnalyzeSkill(lang)` from skills index |
| `src/components/settings/LLMSettings.vue` | Added Coach Skill + Analyze Skill textarea editors with Reset to Default buttons |
| `src/i18n/zh.ts` / `en.ts` | Added `coachSkill`, `analyzeSkill`, `skillReset`, `skillHint` keys |

**Key behavior:**
- Skill files bundled at build time via Vite `?raw` import → no server needed
- localStorage overrides take precedence over bundled defaults
- `{lang}` placeholder in `.md` files → replaced at runtime with `'zh'` or `'en'`
- Skill textareas are dimmed/disabled when the corresponding mode is set to `'webhook'`
- Reset button clears localStorage override and restores the `.md` file default immediately

**New localStorage keys:**
| Key | Purpose |
|-----|---------|
| `coach-skill` | Overrides `coach-skill.md` default |
| `analyze-skill` | Overrides `analyze-skill.md` default |

---

---

## Completed Improvements — v8.4 (2026-02-23)

### Feature: Streaming GLM Responses

GLM API calls now use `stream: true` (SSE) for both Coach and Analyze modes. Tokens render progressively into the panels as they arrive instead of waiting for the full response.

**Modified files:**
| File | Change |
|------|--------|
| `src/types/api.ts` | Added `LLMStreamChunk` interface for SSE delta parsing |
| `src/composables/useLLM.ts` | Replaced `_callGLM` (blocking) with `_callGLMStream(systemPrompt, payload, onChunk)` using `ReadableStream` + `TextDecoder`; both `requestCoach` and `requestAnalyze` accumulate chunks into their response refs progressively |
| `src/components/panels/CoachPanel.vue` | Template: spinner shows only when `isLoading && !response`; content renders as soon as first token arrives; green blinking cursor shown while streaming |
| `src/components/panels/AIReviewPanel.vue` | Same pattern with purple blinking cursor |

**Streaming architecture:**
- Request sent with `{ stream: true }` → response body is a `ReadableStream` of SSE lines
- Reader loop: `reader.read()` → `TextDecoder.decode(..., { stream: true })` → split on `\n` → parse `data: {...}` lines → extract `choices[0].delta.content`
- Each non-empty content token calls `onChunk(text)` which appends to `accumulated` string and replaces `coachResponse.value` with `{ markdown_msg: accumulated, message: accumulated }`
- `[DONE]` sentinel ends the loop; `isLoading` set to `false` in `finally`

**UX behavior:**
- Initial wait (no tokens yet): full-panel spinner as before
- Once first token arrives: content pane appears, renders partial markdown, blinking cursor at bottom
- On completion: cursor disappears, full response displayed

---

---

## Completed Improvements — v8.5 (2026-02-23)

### Feature: Stream Abort / Cancel

Users can now cancel an in-progress GLM stream at any point. The Cancel button appears in the CoachPanel footer and in the AIReviewPanel body (both during the initial spinner wait and while streaming content).

**Modified files:**
| File | Change |
|------|--------|
| `src/composables/useLLM.ts` | `_callGLMStream` accepts `signal: AbortSignal`; passes to `fetch()` and checks `signal.aborted` before each `reader.read()` in a try/finally that calls `reader.releaseLock()`; `requestCoach`/`requestAnalyze` create a new `AbortController`, store it in `_coachAC`/`_analyzeAC`, and catch `AbortError` → return `'cancelled'`; added `cancelCoach()` and `cancelAnalyze()` functions |
| `src/components/panels/CoachPanel.vue` | Footer replaced with Cancel button (red, stop-square icon) while `isLoading`; normal request button shown otherwise; added `cancel: []` emit |
| `src/components/panels/AIReviewPanel.vue` | Cancel button added below spinner (initial wait phase) and in a top-right row above streaming content; added `cancel: []` emit |
| `src/App.vue` | Destructures `cancelCoach`/`cancelAnalyze`; wires `@cancel` on both panels; `handleCoachRequest`/`handleAnalyze` check `err !== 'cancelled'` before showing error toast — cancelled requests are silent |

**Key design decisions:**
- `AbortController.signal` passed to `fetch()` — browser cancels the network request body, causing `reader.read()` to throw `AbortError`
- `signal.aborted` pre-check at top of read loop as a safety net for any browser variance
- `reader.releaseLock()` in `finally` to cleanly release the stream reader on both normal and aborted exit
- Return sentinel `'cancelled'` (not `null`, not an error string) so callers can distinguish cancellation from success and errors
- On cancellation: any partial content streamed so far remains visible in the panel; streaming cursor disappears immediately; no toast fires

---

---

## Completed Improvements — v8.5b (2026-02-23)

### Feature: Cancel on Reset

Cancels any active GLM stream when the user clicks Reset, preventing ghost callbacks after the form is cleared.

**Modified files:**
| File | Change |
|------|--------|
| `src/App.vue` | `handleReset` calls `cancelCoach()` + `cancelAnalyze()` before `resetForm()` / `clearResponses()` / `clearCoachResponse()` / `clearAnalyzeResponse()` |

---

---

## Completed Improvements — v8.6 (2026-02-23)

### Feature: Retry after Cancel

After cancelling a stream, a Retry button appears in both panels that re-sends the last payload without the user having to re-submit the form.

**Modified files:**
| File | Change |
|------|--------|
| `src/composables/useLLM.ts` | Added `coachWasCancelled` / `analyzeWasCancelled` reactive refs; `_lastCoachPayload` / `_lastAnalyzePayload` plain vars store the last sent payload; `retryCoach()` / `retryAnalyze()` call `requestCoach/Analyze(_lastPayload)`; `clear*Response()` also resets `*WasCancelled` |
| `src/components/panels/CoachPanel.vue` | Added `wasCancelled` prop + `retry` emit; Retry button (neutral border, turns green on hover) shown above "Get Writing Guidance" when `wasCancelled && !isLoading` |
| `src/components/panels/AIReviewPanel.vue` | Added `wasCancelled` prop + `retry` emit; Retry button right-aligned below content area when `!isAnalyzing && wasCancelled` |
| `src/App.vue` | Added `handleCoachRetry()` / `handleAnalyzeRetry()` handlers; wired `:was-cancelled` + `@retry` on both panels |
| `src/i18n/zh.ts` / `en.ts` | Added `coach.retryBtn` and `panel.retryBtn` keys |

---

---

## Completed Improvements — v8.7 (2026-02-23)

### Feature: Retry on Error

Extends the Retry button to also appear after a network or API error (not just after cancellation).

**Modified files:**
| File | Change |
|------|--------|
| `src/composables/useLLM.ts` | Added `coachHadError` / `analyzeHadError` reactive refs; set to `true` in the catch block for non-AbortError failures; reset in `clear*Response()` and at the start of each new request; exported via return object |
| `src/components/panels/CoachPanel.vue` | Added `hadError` prop; Retry button condition changed to `(wasCancelled \|\| hadError) && !isLoading` |
| `src/components/panels/AIReviewPanel.vue` | Added `hadError` prop; Retry shown in empty state when `hadError`; streaming-content Retry condition changed to `!isAnalyzing && (wasCancelled \|\| hadError)` |
| `src/App.vue` | Destructures `coachHadError` / `analyzeHadError`; passes as `:had-error` to both panels |

---

---

## Completed Improvements — v8.8 (2026-02-23)

### Feature: Error Boundary for GLM Auth Failures

`_callGLMStream` now distinguishes HTTP 401 / 429 / 5xx with specific i18n messages instead of a raw status string.

**Modified files:**
| File | Change |
|------|--------|
| `src/composables/useLLM.ts` | `if (!response.ok)` block checks `status === 401` → `t('error.glm401')`, `status === 429` → `t('error.glm429')`, `status >= 500` → `t('error.glm5xx')`, fallback generic with raw status |
| `src/i18n/en.ts` | Added `error.glm401`, `error.glm429`, `error.glm5xx` |
| `src/i18n/zh.ts` | Added same keys in Chinese |

**Error messages:**
| Key | EN | ZH |
|-----|----|----|
| `glm401` | Invalid API key. Click ⚙ Settings to update it. | API Key 无效，请点击 ⚙ 设置进行更新。 |
| `glm429` | Rate limit exceeded. Please wait a moment and retry. | 请求频率超限，请稍候后重试。 |
| `glm5xx` | GLM service is temporarily unavailable. Please retry shortly. | GLM 服务暂时不可用，请稍后重试。 |

These errors set `coachHadError` / `analyzeHadError = true`, which surfaces the Retry button automatically.

---

---

## Completed Improvements — v8.9 (2026-02-23)

### Feature: API Key Validation

Inline "Test" button next to the GLM API Key field in Settings. Sends a minimal request and shows a green/red badge without blocking the Save flow.

**Modified files:**
| File | Change |
|------|--------|
| `src/components/settings/LLMSettings.vue` | API key field wrapped in `.key-row` flex container; `btn-test` button added; `validationState` (`'idle' \| 'testing' \| 'valid' \| 'invalid'`) and `validationError` refs added; `handleTestKey()` async function sends `max_tokens: 1` POST; badge rendered below row; `watch(localApiKey)` clears badge on edit; modal-open watch also resets badge |
| `src/i18n/en.ts` / `zh.ts` | Added `settings.testKey`, `settings.testing`, `settings.keyValid` |

**Validation logic:**
- HTTP 200–299 → `valid`
- HTTP 429 → `valid` (rate-limited but key accepted)
- HTTP 401 → `invalid` + `t('error.glm401')`
- Network error → `invalid` + `t('error.connectionFailed')`
- Other HTTP errors → `invalid` + raw `HTTP NNN: statusText`

**UX notes:**
- Test button disabled while: both modes are webhook, field is empty, or test in flight
- Badge clears on any keystroke in the key field
- Badge resets when modal reopens (no stale state from previous session)
- Save is never blocked — validation is advisory

---

---

## Completed Improvements — v8.10 (2026-02-23)

### Feature: Keyboard Shortcut for Settings

`Ctrl+,` opens the LLMSettings modal. `Escape` closes whichever modal is open.

**Modified files:**
| File | Change |
|------|--------|
| `src/App.vue` | `handleKeyboard` extended with two new branches: `Escape` closes Settings modal first, then confirm modal; `Ctrl+,` opens Settings modal (guarded — no-op if confirm modal is already open to prevent stacking) |

**Full shortcut map (all handled by `handleKeyboard` in `App.vue`):**
| Shortcut | Action |
|----------|--------|
| `Ctrl+,` | Open Settings modal |
| `Escape` | Close Settings or Confirm modal |
| `Ctrl+Enter` | Run AI Analyze |
| `Ctrl+Shift+Enter` | Open Confirm Create modal (requires existing analyze response) |

---

---

## Completed Improvements — v8.11 (2026-02-23)

### Feature: Settings Modal Scroll

Settings modal now caps at 80% viewport height and scrolls internally instead of overflowing on shorter screens.

**Modified files:**
| File | Change |
|------|--------|
| `src/components/settings/LLMSettings.vue` | Added `max-height: 80vh` + `overflow-y: auto` to `.modal-content` |

---

---

## Completed Improvements — v8.12 (2026-02-23)

### Feature: Copy Response Button

Clipboard icon button in the header of CoachPanel and AIReviewPanel. Copies raw markdown text and fires a brief toast.

**Modified files:**
| File | Change |
|------|--------|
| `src/components/layout/PanelShell.vue` | Added `#header-actions` named slot; wrapped right side of header in `.panel-right` flex container |
| `src/components/panels/CoachPanel.vue` | Copy button in `#header-actions` (visible when `rawText && !isLoading`); `rawText` computed reads `response.message`; `copyResponse()` writes to clipboard + fires 2 s toast; green hover accent |
| `src/components/panels/AIReviewPanel.vue` | Same pattern (visible when `isMarkdownResponse && !isAnalyzing`); purple hover accent |

**UX notes:**
- Button hidden during streaming; appears only after the stream completes
- Copies `response.message` (raw markdown), not rendered HTML
- Reuses existing `toast.copied` i18n key with a 2 s duration override

---

---

## Completed Improvements — v8.13 (2026-02-23)

### Feature: Mode Badges in Panel Headers

Small "GLM" or "n8n" chip in the header of CoachPanel and AIReviewPanel. Driven by the shared reactive refs from `llm.ts` — updates instantly when Settings are saved.

**Modified files:**
| File | Change |
|------|--------|
| `src/components/panels/CoachPanel.vue` | Imports `coachMode` ref; badge added to `#header-actions` before copy button; always visible; `.badge-llm` (blue) / `.badge-n8n` (orange) classes |
| `src/components/panels/AIReviewPanel.vue` | Same with `analyzeMode` ref |

**Badge colours:**
| Value | Label | Background | Border/Text |
|-------|-------|------------|-------------|
| `'llm'` | GLM | `rgba(88,166,255,0.15)` | `--accent-blue` |
| `'webhook'` | n8n | `rgba(210,153,34,0.15)` | `--accent-orange` |

**Note:** `v-if` was moved from the `<template #header-actions>` tag down to just the copy button, so the slot now always renders (required for the always-visible badge).

---

---

## Completed Improvements — v8.14 (2026-02-23)

### Feature: Retry Cooldown

After clicking Retry, the button disables for 2 seconds and shows a live countdown (`2s` → `1s`) before re-enabling. Prevents accidental double-submission on flaky connections.

**Modified files:**
| File | Change |
|------|--------|
| `src/components/panels/CoachPanel.vue` | `retryCountdown` ref + `_cooldownTimer` var; `handleRetry()` emits `retry` then starts 1 s interval; `onUnmounted` clears timer; button `:disabled="retryCountdown > 0"`, label shows countdown; `:hover` guard changed to `:hover:not(:disabled)`; `.retry-btn:disabled` style added |
| `src/components/panels/AIReviewPanel.vue` | Same; both retry buttons (empty-state `hadError` + post-stream) share the single `retryCountdown` ref so clicking either locks both |

---

---

## Completed Improvements — v8.15 (2026-02-23)

### Feature: Persist Last Responses

On every successful Coach or Analyze completion, the response and a form snapshot are serialised to `localStorage`. On page reload, if a draft is restored and the snapshot matches the current form exactly, the responses are rehydrated into their refs automatically.

**Modified files:**
| File | Change |
|------|--------|
| `src/App.vue` | Three localStorage key constants (`coach-last-response`, `analyze-last-response`, `response-form-snapshot`); four helpers: `buildFormSnapshot()` (stringifies 6 form fields), `saveResponsesToStorage()`, `clearResponsesFromStorage()`, `restoreResponsesFromStorage()`; save called in all four success paths (`handleAnalyze`, `handleCoachRequest`, `handleAnalyzeRetry`, `handleCoachRetry`); clear called in `handleReset`; restore called in `onMounted` after `restoreDraft()` returns true |

**Restore conditions:**
- Skipped entirely if no draft was present (`restoreDraft()` returns false)
- Skipped if stored snapshot doesn't match the current (restored) form — exact JSON string comparison
- Malformed localStorage entries caught and silently ignored

---

---

## Completed Improvements — v8.16 (2026-02-23)

### Feature: Invalidate Stored Responses on Form Edit

Any change to the six form fields that make up the response snapshot immediately removes the three response localStorage keys. Prevents stale responses from being restored after a form edit + page reload.

**Modified files:**
| File | Change |
|------|--------|
| `src/App.vue` | Added `watch` to Vue imports; added a lazy `watch` over `[form.projectKey, form.issueType, computedSummary, form.description, form.assignee, form.estimatedPoints]` → calls `clearResponsesFromStorage()`; does not fire during draft restoration (lazy, not immediate) |

---

---

## Completed Improvements — v8.17 (2026-02-23)

### Feature: Skill Character Counter

Live `{n} chars · ~{n÷4} tokens` counter in the bottom-right of each skill section in Settings. Updates on every keystroke. Dims automatically with the textarea when mode is set to webhook.

**Modified files:**
| File | Change |
|------|--------|
| `src/components/settings/LLMSettings.vue` | `<p class="skill-hint">` replaced with `.skill-footer` flex row; `.skill-counter` span shows `localCoachSkill.length` / `localAnalyzeSkill.length` and estimated token count inline; `.skill-footer`, `.skill-counter` CSS added |

---

---

## Completed Improvements — v8.18 (2026-02-24)

### Feature: Word / Sentence Count in Description

Live word and sentence counter below the task description textarea. Updates on every keystroke. Shows `0 words · 0 sentences` when empty.

**Modified files:**
| File | Change |
|------|--------|
| `src/components/form/DescriptionEditor.vue` | Added `wordCount` and `sentenceCount` computed refs; `.desc-footer` + `.desc-counter` rendered below textarea |
| `src/i18n/en.ts` | Added `form.descWords`, `form.descSentences` |
| `src/i18n/zh.ts` | Added same keys in Chinese (`词`, `句`) |

---

---

## Completed Improvements — v8.19 (2026-02-24)

### Feature: Stream Token Speed Indicator

Live `{n} tok/s` throughput label shown next to the blinking cursor in CoachPanel and AIReviewPanel during GLM streaming. Resets to 0 on cancel, error, or clear.

**Modified files:**
| File | Change |
|------|--------|
| `src/composables/useLLM.ts` | Added `coachStreamSpeed` / `analyzeStreamSpeed` refs; token count and elapsed time tracked in `requestCoach` / `requestAnalyze` `onChunk` callbacks |
| `src/components/panels/CoachPanel.vue` | Added `streamSpeed` prop; `.stream-footer` flex row replaces inline cursor; speed label shown when `streamSpeed > 0` |
| `src/components/panels/AIReviewPanel.vue` | Same pattern with purple accent |
| `src/App.vue` | Destructures and passes `coachStreamSpeed` / `analyzeStreamSpeed` as `:stream-speed` |

---

### Feature: Multiple LLM Providers

Settings modal now has a "Provider Base URL" field. Any OpenAI-compatible endpoint (Ollama, local proxies, etc.) can be used by entering its base URL. Stored in `localStorage` under `provider-url`.

**New localStorage key:**
| Key | Default |
|-----|---------|
| `provider-url` | `''` (falls back to GLM_BASE_URL) |

**Modified files:**
| File | Change |
|------|--------|
| `src/config/llm.ts` | Added `getProviderUrl()`, `setProviderUrl()`; falls back to `GLM_BASE_URL` when empty |
| `src/composables/useLLM.ts` | `_callGLMStream` uses `getProviderUrl()` instead of `GLM_BASE_URL` |
| `src/components/settings/LLMSettings.vue` | Added Provider Base URL field above API Key; `handleTestKey` uses local provider URL; `handleSave` calls `setProviderUrl` |

---

### Feature: Skill Diff Indicator

Orange `● modified` badge appears next to the Coach Skill and Analyze Skill labels in Settings when a localStorage override is active. Disappears immediately when "Reset to Default" is clicked.

**Modified files:**
| File | Change |
|------|--------|
| `src/config/skills/index.ts` | Added `coachSkillModified` / `analyzeSkillModified` reactive refs; `setCoachSkill`/`setAnalyzeSkill` set them to `true`; `resetCoachSkill`/`resetAnalyzeSkill` set them to `false` |
| `src/components/settings/LLMSettings.vue` | `.skill-label-row` flex wrapper; `v-if="coachSkillModified"` badge with `.skill-modified-badge` style |

---

### Feature: Export / Import All Settings

Two buttons in Settings (Export ⬇ / Import ⬆) at the bottom of the modal. Export downloads a dated JSON file covering all settings. Import reads a JSON file and populates all local state fields without saving until the user clicks Save.

**Exported keys:** `provider-url`, `glm-api-key`, `glm-model`, `coach-mode`, `analyze-mode`, `coach-skill`, `analyze-skill`, `custom-templates`

**Modified files:**
| File | Change |
|------|--------|
| `src/components/settings/LLMSettings.vue` | Added `handleExport()` (Blob download) and `handleImport()` (FileReader); `.export-row` flex row + `.btn-export` / `.btn-import` styles |
| `src/i18n/en.ts` / `zh.ts` | Added `settings.exportImport`, `settings.exportSettings`, `settings.importSettings` |

---

### Feature: Graceful 429 Backoff

When the GLM API returns HTTP 429, instead of showing an error, a 10-second countdown starts in the panel. The panel body shows an orange timer with a cancel button. On reaching 0, the request is automatically retried. Works for both Coach and Analyze modes.

**Architecture:** `GLM429Error` custom class thrown in `_callGLMStream` → caught in `requestCoach`/`requestAnalyze` → starts `setInterval` countdown → auto-calls `requestCoach`/`requestAnalyze` recursively at 0.

**Modified files:**
| File | Change |
|------|--------|
| `src/composables/useLLM.ts` | Added `GLM429Error` class; `coachBackoffSecs` / `analyzeBackoffSecs` refs; `_coachBackoffTimer` / `_analyzeBackoffTimer`; backoff cleared in `cancelCoach`/`cancelAnalyze` and `clearCoachResponse`/`clearAnalyzeResponse` |
| `src/components/panels/CoachPanel.vue` | Added `backoffSecs` prop; `v-if="backoffSecs > 0"` template branch in empty state with clock icon, countdown, and cancel button |
| `src/components/panels/AIReviewPanel.vue` | Same pattern |
| `src/App.vue` | Passes `coachBackoffSecs` / `analyzeBackoffSecs` as `:backoff-secs` |
| `src/i18n/en.ts` / `zh.ts` | Added `coach.backoffLabel`, `coach.backoffCancel`, `panel.backoffLabel` |

---

### Feature: Skill File Per Language

Coach and Analyze system prompts are now authored as separate language-specific `.md` files instead of a single file with `{lang}` substitution. localStorage overrides still take priority.

**New files:**
| File | Purpose |
|------|---------|
| `src/config/skills/coach-skill-zh.md` | Chinese coach prompt |
| `src/config/skills/coach-skill-en.md` | English coach prompt |
| `src/config/skills/analyze-skill-zh.md` | Chinese analyze prompt |
| `src/config/skills/analyze-skill-en.md` | English analyze prompt |

**Modified files:**
| File | Change |
|------|--------|
| `src/config/skills/index.ts` | Imports all 4 lang-specific files; `getCoachSkill(lang)` / `getAnalyzeSkill(lang)` use lang-specific defaults instead of `applyLang({lang})`; added `getCoachSkillDefault(lang)` / `getAnalyzeSkillDefault(lang)` exports |
| `src/components/settings/LLMSettings.vue` | `handleResetCoach`/`handleResetAnalyze` use `getCoachSkillDefault(currentLang())` instead of `coachSkillDefault`; modal-open watch initialises textareas from lang-specific defaults |

---

### Feature: Template Chip Editor

Collapsible "Template Chips" section added to Settings modal. Lists all chips (built-in + custom) with expand-to-edit per chip (icon, zh/en labels, zh/en content). Supports move up/down, delete, add new chip. Changes saved to `custom-templates` localStorage on Settings Save. Reset restores built-in defaults.

**New localStorage key:** `custom-templates` — full JSON array of `TemplateDefinition[]`

**Modified files:**
| File | Change |
|------|--------|
| `src/config/templates/index.ts` | Added `effectiveTemplates` reactive ref; `setCustomTemplates()`, `resetCustomTemplates()`, `customTemplatesModified` ref; `getTemplateContent` uses `effectiveTemplates.value` |
| `src/components/settings/LLMSettings.vue` | `localTemplates` ref (deep clone); `toggleChipEdit`, `moveChip`, `deleteChip`, `addChip`, `handleResetTemplates`; collapsible `<details>` section with chip list; `handleSave` calls `setCustomTemplates` or `resetCustomTemplates` |
| `src/components/panels/CoachPanel.vue` | Imports `effectiveTemplates` instead of `TEMPLATES`; `chips` computed uses `effectiveTemplates.value` |
| `src/i18n/en.ts` / `zh.ts` | Added `settings.templateEditor`, `settings.templateReset`, `settings.addChip` |

---

### Feature: Dev Tools Integration

New "Agent State" collapsible section in DevTools panel surfaces all AI state at a glance without opening Settings.

**Surfaced information:** Coach mode badge, Analyze mode badge, Active model, Coach/Analyze skill modified status, Custom templates modified status, Streaming active flag + speed, Backoff countdown, Error/cancelled state per panel.

**Modified files:**
| File | Change |
|------|--------|
| `src/components/dev/DevTools.vue` | Extended `defineProps` with 16 new props; added "Agent State" `<details>` section; `.mode-badge`, `.speed-badge`, `.state-divider` styles |
| `src/App.vue` | Imports `coachMode`, `analyzeMode`, `getModel`, `coachSkillModified`, `analyzeSkillModified`, `customTemplatesModified`; `activeModel` computed; passes all 16 new props to `<DevTools>` |
| `src/i18n/en.ts` / `zh.ts` | Added all `dev.*` keys: `agentState`, `coachMode`, `analyzeMode`, `model`, `coachSkill`, `analyzeSkill`, `customTemplates`, `streaming`, `streamSpeed`, `yes`, `no`, `backoff` |

---

## Completed Improvements — v8.20 (2026-02-25)

### Feature: Dark / Light Theme Toggle

Sun/Moon icon button in the header switches between dark and light themes. Preference survives page reload.

**New files:**
| File | Purpose |
|------|---------|
| `src/composables/useTheme.ts` | `isDark` ref, `toggleTheme()`, reads/writes `localStorage` key `theme`, applies `data-theme` attribute to `<html>` |

**Modified files:**
| File | Change |
|------|--------|
| `src/styles/variables.css` | Renamed `:root` to `:root, [data-theme="dark"]`; added `[data-theme="light"]` block with full light-mode color overrides |
| `src/components/layout/AppHeader.vue` | Imports `useTheme`; Sun SVG shown in dark mode, Moon SVG in light mode; `.theme-btn` style added |
| `src/i18n/en.ts` / `zh.ts` | Added `header.themeDark` / `header.themeLight` tooltip keys |

**Light theme color values:**
| Variable | Light value |
|----------|------------|
| `--bg-primary` | `#ffffff` |
| `--bg-secondary` | `#f6f8fa` |
| `--bg-tertiary` | `#eef0f3` |
| `--border-color` | `#d0d7de` |
| `--text-primary` | `#1f2328` |
| `--text-muted` | `#656d76` |
| `--accent-*` | Darkened for light-bg contrast |

---

### Feature: Summary Preview Copy Button

Clipboard icon button in the QualityMeter header. Copies the assembled 5-part summary text and fires a 2s toast.

**Modified files:**
| File | Change |
|------|--------|
| `src/components/form/QualityMeter.vue` | Added `<slot name="header-actions" />` inside `.meter-right` |
| `src/components/form/SummaryBuilder.vue` | Fills `#header-actions` slot with copy button; `copySummary()` writes `computedSummary` to clipboard + toast; button hidden when summary is empty; reuses `.copy-btn` style pattern |

---

### Feature: Assignee Avatar / Initials

Colored initials circle shown before each assignee name in the combobox dropdown. Color is deterministically derived from the user ID.

**Modified files:**
| File | Change |
|------|--------|
| `src/components/form/AssigneeCombobox.vue` | Added `getInitials(name)` (handles CJK + Latin) and `getAvatarColor(id)` (hash → one of 5 accent colors) helpers; `.avatar` div added before `.option-info` in each option row; `.avatar` CSS (28px circle, flex center) |

---

### Feature: Form Field Character Limits

Live character counter below the Component and Detail free-text inputs. Color changes warn as the limit approaches.

**Modified files:**
| File | Change |
|------|--------|
| `src/components/form/SummaryBuilder.vue` | `COMPONENT_MAX = 50`, `DETAIL_MAX = 100` constants; `counterColor(len, max)` returns orange at ≥80%, red at 100%; `.field-input-wrap` + `.field-counter` added; `maxlength` attr on both inputs |

---

## Completed Improvements — v8.21 (2026-02-25)

### Feature 1: Task History Log

Persists the last 20 successfully created JIRA tickets to localStorage and surfaces them in a collapsible panel in the right column.

**New files:**
| File | Purpose |
|------|---------|
| `src/composables/useTicketHistory.ts` | `TicketEntry` interface (`key`, `summary`, `project`, `issueType`, `date`); `ticketHistory` ref pre-loaded from `localStorage` key `ticket-history`; `addTicket(entry)` prepends + trims to 20 entries + persists; `clearHistory()` removes all |
| `src/components/panels/TicketHistoryPanel.vue` | Collapsible `<details>` panel; lists entries newest-first; each row shows ticket key (mono, `--accent-blue`), truncated summary, project + type badge, relative timestamp (`Xm ago` / `Xh ago` / `Xd ago`); "Clear" button in header |

**Modified files:**
| File | Change |
|------|--------|
| `src/App.vue` | Imports `addTicket`; in `confirmCreate()` success path, extracts ticket key from `jiraResponse` (`response?.key \|\| response?.jira_result?.key`); calls `addTicket({key, summary, project, issueType, date})`; adds `<TicketHistoryPanel />` in `.col-right` below `<DevTools>` |
| `src/i18n/en.ts` / `zh.ts` | Added `history.title`, `history.empty`, `history.clear`, `history.ticketKey` |

**localStorage key:** `ticket-history` (JSON array of `TicketEntry[]`, max 20 items)

---

### Feature 2: Webhook Response Diff

Word-level diff between the previous and current analyze response. No external library — pure LCS implementation.

**New files:**
| File | Purpose |
|------|---------|
| `src/utils/diffText.ts` | `diffWords(oldText, newText): string` — tokenises both strings into word+whitespace tokens, builds LCS table (`O(m·n)`), backtracks to produce `{ type: 'same'|'add'|'del', text }` parts, serialises to HTML with `<ins class="diff-add">` (green) and `<del class="diff-del">` (red strikethrough); unchanged tokens rendered as escaped plain text |

**Modified files:**
| File | Change |
|------|--------|
| `src/composables/useLLM.ts` | Added `previousAnalyzeResponse = ref<unknown>(null)`; at start of `requestAnalyze`, saves current `analyzeResponse.value` to `previousAnalyzeResponse` before clearing; resets to `null` in `clearAnalyzeResponse()`; exported in return object |
| `src/components/panels/AIReviewPanel.vue` | New `previousResponse: unknown` prop; `showDiff` ref (default `false`); `canShowDiff` computed (true when `isMarkdownResponse && !!previousResponse && prevRawText`); "Diff" / "Normal" toggle button in `#header-actions` with active state styling; diff view renders `diffWords(prevText, newText)` via `v-html` with `.diff-view` monospace pre-wrap container; `:deep(.diff-add)` / `:deep(.diff-del)` CSS |
| `src/App.vue` | Destructures `previousAnalyzeResponse` from `useLLM()`; passes as `:previous-response` to `<AIReviewPanel>` |
| `src/i18n/en.ts` / `zh.ts` | Added `panel.showDiff`, `panel.hideDiff` |

**Design notes:**
- Diff button only appears after a second analyze run (when `previousAnalyzeResponse` is populated)
- Diff is computed on the raw `message` string (pre-formatter), so token boundaries are consistent
- `.diff-view` uses monospace pre-wrap so whitespace tokens preserve line breaks

---

### Feature 3: Hotkey Cheat Sheet Modal

Pressing `?` anywhere (outside an input) opens a modal listing all keyboard shortcuts.

**New files:**
| File | Purpose |
|------|---------|
| `src/components/shared/HotkeyModal.vue` | `v-model` boolean; same `<Transition name="modal">` + `.modal-overlay` + `.modal-content` pattern as `LLMSettings.vue`; `<kbd>`-styled table with two columns (key | action) built from a computed `hotkeys` array; close button + overlay click + Escape all dismiss |

**Modified files:**
| File | Change |
|------|--------|
| `src/App.vue` | Added `showHotkeyModal = ref(false)`; in `handleKeyboard`: `Escape` now closes hotkey modal first (before settings / confirm); `?` branch — no modifier keys, guards `e.target.tagName` against `INPUT` / `TEXTAREA` — opens modal; `<HotkeyModal v-model="showHotkeyModal" />` added to template |
| `src/i18n/en.ts` / `zh.ts` | Added `hotkeys.title`, `hotkeys.analyze`, `hotkeys.create`, `hotkeys.settings`, `hotkeys.escape`, `hotkeys.showCheatsheet` |

**Shortcuts documented:**

| Key | Action |
|-----|--------|
| `Ctrl+Enter` | Run AI Analyze |
| `Ctrl+Shift+Enter` | Open Create JIRA modal |
| `Ctrl+,` | Open Settings |
| `Escape` | Close modal |
| `?` | Show this cheat sheet |

---

### Feature 4: Bulk Template Import

Drag-and-drop a `TemplateDefinition[]` JSON file onto the CoachPanel chip area to import templates. Also exposed as a file-input button inside the Template Chip Editor in Settings.

**Merge behavior:** append imported templates (skip duplicates by `key`); fire toast with count.

**Modified files:**
| File | Change |
|------|--------|
| `src/components/panels/CoachPanel.vue` | Added `isDragging` ref; `@dragover.prevent`, `@dragleave`, `@drop.prevent` on `.chips` wrapper; drop handler reads `DataTransfer.files[0]` → `FileReader` → JSON parse → validates array → emits `importTemplates(templates[])`; `.chips` gets dashed border + blue tint when `isDragging`; "Drop JSON here" overlay hint shown during drag; `importTemplates` added to `defineEmits` |
| `src/App.vue` | Handles `@import-templates` from `CoachPanel`; `handleTemplateImport(incoming)` computes existing key set, filters to `toAdd`, calls `setCustomTemplates([...effectiveTemplates, ...toAdd])`, fires toast `"N templates imported"` or `"No new templates"` info |
| `src/components/settings/LLMSettings.vue` | Added "Import Templates" `<label>`+`<input type="file" accept=".json">` button beside "Add Chip" in `.chip-list-actions`; `handleImportTemplates(e)` reads file → validates array → filters duplicates by key → merges into `localTemplates`; `.btn-import-chip` style added |
| `src/i18n/en.ts` / `zh.ts` | Added `settings.importTemplates`, `toast.templatesImported` |

**Validation:** both import paths silently ignore non-array JSON and malformed files (no error overlay, matching existing pattern).

---

## Completed Improvements — v8.22 (2026-02-25)

### Fix: Copy Button Available in n8n Webhook Mode

The copy icon in AI Coach and AI Review panels was previously gated behind `isMarkdownResponse` / `rawText`, so it never appeared when the response was a plain JSON object from an n8n webhook. Now shows whenever any response is present.

**Modified files:**
| File | Change |
|------|--------|
| `src/components/panels/AIReviewPanel.vue` | `v-if` changed from `isMarkdownResponse && !isAnalyzing` to `response && !isAnalyzing`; `copyResponse()` falls back to `JSON.stringify(props.response, null, 2)` when `rawText` is empty |
| `src/components/panels/CoachPanel.vue` | `v-if` changed from `rawText && !isLoading` to `response && !isLoading`; same `JSON.stringify` fallback in `copyResponse()` |

---

### Feature: Free-Input Story Points

A free-text input field appended after the "8" preset button, letting users enter any positive integer as story points. Preset buttons and custom input are mutually exclusive.

**Modified files:**
| File | Change |
|------|--------|
| `src/components/form/StoryPointsPicker.vue` | Added `customRaw` string ref; `hasCustom` computed; `selectPreset()` clears input before emitting; `onCustomInput()` strips non-digits and emits parsed value; input styled identical to buttons (32px height, same border/radius/gap); button `active` class gated on `!hasCustom`; input `active` class applied when `hasCustom`; pre-populates on mount when stored `modelValue` is not a Fibonacci preset |

**Behavior details:**
- Selecting a preset button → `customRaw` cleared → button highlights blue, input blank
- Typing in input → `hasCustom = true` → all preset buttons deactivate → input highlights blue
- Non-digit characters stripped in-place via `replace(/[^\d]/g, '')`; max 3 characters
- Clearing the input does not emit — previous value is preserved until a new selection is made
- On page load: if `modelValue` is not in `[1, 2, 3, 5, 8]`, input pre-fills with the stored value

---

### Feature: Coach Skill On/Off Toggle

A toggle button in the CoachPanel header lets users disable the coach system prompt for free-form chat without JIRA-review constraints.

**Modified files:**
| File | Change |
|------|--------|
| `src/composables/useLLM.ts` | Added module-level `export const coachSkillEnabled = ref(true)`; `_callGLMStream` spreads system message conditionally (`systemPrompt ? [{role:'system',...}] : []`); `requestCoach` passes `''` when `coachSkillEnabled` is `false` |
| `src/components/panels/CoachPanel.vue` | Imports `coachSkillEnabled`; toggle button in `#header-actions` visible only when `coachMode === 'llm'`; green pill when ON, muted gray when OFF; clicking flips the ref directly |
| `src/i18n/en.ts` / `zh.ts` | Added `coach.skillOn` / `coach.skillOff` |

**Behavior:**
- **Skill ON** (default) — system prompt sent as usual → focused JIRA-review coaching behavior
- **Skill OFF** — system message omitted entirely from GLM request → model responds freely to the task context; useful for general questions, brainstorming, or non-JIRA topics
- State is a module-level singleton ref; resets to `true` on page reload (safe default)
- Button hidden in n8n webhook mode (system prompt concept does not apply)

---

### Feature: JIRA Panel Loading Spinner

The JIRA Create Issue Response panel now shows a spinner while `isCreating` is true, consistent with the loading animations in CoachPanel and AIReviewPanel.

**Modified files:**
| File | Change |
|------|--------|
| `src/components/panels/JiraResponsePanel.vue` | Added loading state block (`v-if="isCreating && !response"`) before the empty state; spinner SVG + loading text styled with JIRA brand blue `#2684FF`; `spin` keyframe added |
| `src/i18n/en.ts` / `zh.ts` | Added `panel.jiraCreating` ("Creating JIRA ticket…" / "正在创建 JIRA 工单…") |

**Design:** JIRA brand blue `#2684FF` chosen to match the JIRA logo colour, distinguishing it from Coach (green `--accent-green`) and Analyze (purple `--accent-purple`).

---

### Fix: Ticket History Keys as JIRA Hyperlinks

Ticket keys in the TicketHistoryPanel were plain `<span>` elements. Now rendered as `<a>` links pointing to `https://jira.gwm.cn/browse/{key}`, consistent with the same URL pattern used in ProcessingSummary.

**Modified files:**
| File | Change |
|------|--------|
| `src/components/panels/TicketHistoryPanel.vue` | `.entry-key` `<span>` replaced with `<a :href="'https://jira.gwm.cn/browse/' + entry.key" target="_blank" rel="noopener noreferrer">`; `text-decoration: none` base style + `underline` on hover |

---

## Completed Improvements — v8.23 (2026-02-26)

### UI Design Polish

Comprehensive visual quality pass fixing color hierarchy bugs, adding depth shadows, smoothing theme transitions, and correcting the version label.

**Modified files:**
| File | Change |
|------|--------|
| `src/styles/variables.css` | Fixed `--text-secondary` dark mode value (`#f6f7f8` → `#adbac7` — was brighter than `--text-primary`, causing inverted text hierarchy); fixed light mode `--text-secondary` (`#24292f` → `#57606a`); improved `--text-muted` dark (`#8b949e` → `#768390`); brightened `--accent-orange` dark (`#d29922` → `#e3b341`) and light (`#9a6700` → `#bf8700`) for better readability; added `--shadow-sm`, `--shadow-panel`, `--shadow-modal` tokens for both themes |
| `src/styles/global.css` | Added `transition: background-color 0.3s ease, color 0.3s ease` to `body` so theme switching animates smoothly instead of snapping |
| `src/components/layout/PanelShell.vue` | Added `box-shadow: var(--shadow-panel)` to `.panel` — panels now have subtle depth lift off the background |
| `src/App.vue` | Added `box-shadow: var(--shadow-modal)` to `.modal-content` |
| `src/components/settings/LLMSettings.vue` | Added `box-shadow: var(--shadow-modal)` to `.modal-content` |
| `src/components/shared/HotkeyModal.vue` | Added `box-shadow: var(--shadow-modal)` to `.modal-content` |
| `src/components/layout/AppHeader.vue` | Updated version label from `v8.0` to `v8.23` |

**Design notes:**
- The `--text-secondary` inversion bug meant secondary text was visually louder than primary text — now corrected across both themes
- Shadow tokens are theme-aware: dark mode uses stronger shadows (0.4 opacity), light mode uses subtle shadows (0.06–0.18 opacity) matching GitHub's design system
- Theme transition applies only to `background-color` and `color` on `body`; individual components inherit the change naturally

---

## Completed Improvements — v8.25 (2026-02-27)

### LLM Config: Bug Fixes, Generic Labels & Model Dropdown

Three improvements to the LLM settings system:

#### Bug Fixes
| Bug | Location | Fix |
|-----|----------|-----|
| Hardcoded model fallback `'glm-4.7-flash'` | `LLMSettings.vue:342` | Use `GLM_DEFAULT_MODEL` constant |
| Skill init bypassed abstraction (raw `localStorage.getItem`) | `LLMSettings.vue:183-184, 208-209` | Use `getCoachSkill(lang)` / `getAnalyzeSkill(lang)` |

#### Generic LLM Provider Labels
Removed GLM/ZhipuAI-specific branding from UI labels so any OpenAI-compatible provider works without confusion:
| Key | Before | After |
|-----|--------|-------|
| `settings.modeLLM` | `'GLM API (Direct)'` | `'Direct API'` |
| `settings.apiKey` | `'GLM API Key'` | `'API Key'` |
| `settings.apiKeyPlaceholder` | `'Enter your ZhipuAI API Key'` | `'Enter API key for your provider'` |
| `settings.modelPlaceholder` | `'glm-4.7-flash'` | `'e.g. glm-4.7-flash, gpt-4o ...'` |
| `error.glm5xx` | `'GLM service is temporarily unavailable'` | `'LLM service is temporarily unavailable'` |

#### Model Name Dropdown (datalist combobox)
Replaced plain text input with `<input list>` + `<datalist>` — user can pick from presets or type any custom model name freely.

**New export in `src/config/llm.ts`:** `LLM_MODEL_PRESETS`

| Group | Models |
|-------|--------|
| GLM (ZhipuAI) | glm-4.7-flash, glm-4-plus, glm-4-air, glm-z1-flash, glm-z1-airx |
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo |
| Anthropic | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5-20251001 |
| DeepSeek | deepseek-chat, deepseek-reasoner |
| Qwen (Alibaba) | qwen-turbo, qwen-plus, qwen-max |
| Mistral | mistral-large-latest, mistral-small-latest |

**Files changed:**
| File | Change |
|------|--------|
| `src/config/llm.ts` | Add `LLM_MODEL_PRESETS` |
| `src/components/settings/LLMSettings.vue` | Bug fixes + model datalist combobox + URL normalization in Test button |
| `src/composables/useLLM.ts` | Auto-append `/chat/completions` if base URL given |
| `src/i18n/en.ts` | Generic provider labels, updated URL field hint |
| `src/i18n/zh.ts` | Generic provider labels (ZH), updated URL field hint |

#### Test Results — 2026-02-27
Tested against GWM internal proxy (`https://llmproxy.gwm.cn/v1`) with model `default/deepseek-v3-2`.

| ID | Test Case | Result |
|----|-----------|--------|
| TC-01 | Save settings | ✅ Pass |
| TC-02 | Settings restored on re-open | ✅ Pass |
| TC-03 | Model datalist dropdown appears | ✅ Pass |
| TC-04 | API Key Test button | ✅ Pass |
| TC-05 | Coach Direct API streaming | ✅ Pass |
| TC-06 | Coach response completes | ✅ Pass |
| TC-07 | Analyze Direct API streaming | ✅ Pass |
| TC-08 | Analyze response completes | ✅ Pass |
| TC-09 | Blank URL falls back to GLM default | ✅ Pass |

**All 9 test cases passed.** URL normalization (base URL → `/chat/completions` auto-append) confirmed working.

---

## Completed Improvements — v8.24 (2026-02-26)

### Documentation: Bilingual User Manual

Added a comprehensive user manual (`USER_MANUAL.md`) at the project root, written in both English and Chinese. Covers all front-end features for end users who will access the cloud-deployed app.

**New files:**
| File | Purpose |
|------|---------|
| `USER_MANUAL.md` | 509-line bilingual (EN/ZH) user manual in Markdown format |

**Sections covered:**
| Section | Content |
|---------|---------|
| Overview | App purpose and key capabilities |
| Interface Layout | ASCII diagram of the 3-column layout |
| First-Time Setup | Settings, API key, mode selection, model configuration |
| Step-by-Step Workflow | Full ① → ⑧ flow diagram |
| Header Controls | Language toggle, Test/Prod mode, theme, settings |
| AI Coach Panel | Writing guidance, Skill ON/OFF toggle, template chips, drag-drop import, copy, 429 backoff countdown |
| Task Form | Basic info, story points (preset + custom), 5-part summary, quality meter, description word/sentence counter, action buttons |
| AI Smart Analysis | What AI reviews, reading results, diff view toggle |
| Creating a JIRA Ticket | Payload preview modal, confirm/cancel, JIRA response panel |
| Ticket History | Reading entries, hyperlinks, clearing history |
| Settings | All fields, skill editor, template chip management, export/import |
| Keyboard Shortcuts | Full table + `?` modal reference |
| Tips & Troubleshooting | 7 common issues with solutions |

---

## Completed Improvements — v8.26 (2026-03-02)

### Performance Sprint

Comprehensive performance pass targeting keystroke-frequency hot paths and streaming render overhead.

#### 1. Debounced Draft Auto-Save
**Problem:** `saveDraft()` called `localStorage.setItem(JSON.stringify(...))` synchronously on every keystroke via a `deep: true` watcher.
**Fix:** 300ms debounce on the watcher. Also removed redundant spread copies in the watch source — `deep: true` handles nested reactivity directly.
**File:** `src/composables/useForm.ts`

#### 2. Debounced Response Storage Clearing
**Problem:** `clearResponsesFromStorage()` fired 3x `localStorage.removeItem` on every character typed in the description field.
**Fix:** 500ms debounce on the watcher.
**File:** `src/App.vue`

#### 3. Hoisted `useI18n()` in `formatCoachResponse`
**Problem:** `formatCoachResponse()` called `useI18n()` inside its function body, creating new closures on every streaming token (dozens/sec).
**Fix:** Moved `useI18n()` call to module scope — safe because the custom `useI18n()` returns functions that close over a module-level `currentLang` ref.
**File:** `src/utils/formatCoach.ts`

#### 4. rAF-Throttled Streaming Render
**Problem:** `formattedResponse`/`formattedAnalysis` computed properties ran `formatCoachResponse()` (12 sequential regex passes) on every streaming token.
**Fix:** Replaced computed with `ref` updated via `requestAnimationFrame`. The raw `response` prop still updates at full speed (cursor/speed indicators), but expensive HTML formatting runs at most once per display frame.
**Files:** `src/components/panels/CoachPanel.vue`, `src/components/panels/AIReviewPanel.vue`

#### 5. Debounced `jsonPayload`
**Problem:** `jsonPayload` computed rebuilt `JSON.stringify(buildPayload('preview'), null, 2)` on every keystroke, feeding the always-mounted DevTools panel.
**Fix:** Replaced computed with a 500ms debounced `ref`. The confirm modal and DevTools tolerate slight staleness.
**File:** `src/App.vue`

#### 6. Extracted `createStreamFlow` Factory
**Problem:** Coach and Analyze request flows were ~130 lines each of near-identical code — same state shape, same 429 backoff logic, same abort controller pattern. Bug fixes had to be applied in two places.
**Fix:** Extracted `createStreamFlow()` factory function that both flows instantiate. The factory encapsulates: reactive state refs, abort controller lifecycle, streaming accumulation, 429 backoff timer, and error handling. Public API preserved — no changes needed in consuming components.
**File:** `src/composables/useLLM.ts`

#### 7. Fixed 429 Timer Leak
**Problem:** If `requestCoach`/`requestAnalyze` was called while a 429 backoff timer was already running, a second `setInterval` started without clearing the first — leaking timers.
**Fix:** `createStreamFlow.request()` now clears any existing backoff timer at the start of every call.
**File:** `src/composables/useLLM.ts`

#### 8. Max 429 Retry Limit (3 attempts)
**Problem:** 429 auto-retry looped indefinitely if the server kept rate-limiting.
**Fix:** Added `MAX_429_RETRIES = 3` constant. After 3 consecutive 429 retries, the flow stops and surfaces `error.maxRetries` to the user. Retry count resets on fresh user-initiated calls.
**Files:** `src/composables/useLLM.ts`, `src/i18n/en.ts`, `src/i18n/zh.ts`

**Files changed:**
| File | Change |
|------|--------|
| `src/composables/useForm.ts` | Debounce draft watcher (300ms) |
| `src/composables/useLLM.ts` | `createStreamFlow` factory, timer leak fix, max 3 retries |
| `src/utils/formatCoach.ts` | Hoist `useI18n()` to module scope |
| `src/components/panels/CoachPanel.vue` | rAF-throttled `formattedResponse` |
| `src/components/panels/AIReviewPanel.vue` | rAF-throttled `formattedAnalysis` |
| `src/App.vue` | Debounce `clearResponsesFromStorage`, lazy `jsonPayload` |
| `src/i18n/en.ts` | Add `error.maxRetries` |
| `src/i18n/zh.ts` | Add `error.maxRetries` |
| `src/components/layout/AppHeader.vue` | Version → v8.26 |

---

## Completed Improvements — v8.27 (2026-03-02)

### i18n: Full Localization Pass

Localized all remaining hardcoded English strings across the codebase. Added 13 new i18n keys to both `en.ts` and `zh.ts`.

#### Localized Strings

| Location | Before | After |
|----------|--------|-------|
| `TicketHistoryPanel.vue` — `relativeDate()` | `'just now'`, `'Xm ago'`, `'Xh ago'`, `'Xd ago'` | `t('history.justNow')`, `t('history.minsAgo')`, etc. |
| `ProcessingSummary.vue` — JIRA label | `'JIRA Ticket'` | `t('panel.jiraTicket')` |
| `CoachPanel.vue` — drag-drop errors | `'Please drop a valid .json file'`, `'Invalid template JSON file'` | `t('toast.invalidDropFile')`, `t('toast.invalidTemplateJson')` |
| `App.vue` — template import toast | `'No new templates to import (duplicates skipped)'` | `t('toast.noDuplicateTemplates')` |
| `DevTools.vue` — 7 labels | `'Active URL'`, `'Coach'`, `'Analyze'`, `'Coach Error/Cancel'`, `'Analyze Error/Cancel'`, `'error'`, `'cancelled'` | `t('dev.activeUrl')`, `t('dev.coach')`, etc. |

**Files changed:**
| File | Change |
|------|--------|
| `src/i18n/en.ts` | +13 keys: `history.justNow/minsAgo/hoursAgo/daysAgo`, `panel.jiraTicket`, `toast.invalidDropFile/invalidTemplateJson/noDuplicateTemplates`, `dev.activeUrl/coach/analyze/coachErrorCancel/analyzeErrorCancel/error/cancelled` |
| `src/i18n/zh.ts` | Matching 13 ZH keys |
| `src/components/panels/TicketHistoryPanel.vue` | `relativeDate()` uses `t()` |
| `src/components/panels/ProcessingSummary.vue` | JIRA label uses `t()` |
| `src/components/panels/CoachPanel.vue` | Drag-drop toasts use `t()` |
| `src/components/dev/DevTools.vue` | All labels use `t()` |
| `src/App.vue` | Template import toast uses `t()` |
| `src/components/layout/AppHeader.vue` | Version → v8.27 |

---

## Completed Improvements — v8.29 (2026-03-02)

### Keyboard Navigation, Focus Rings & Testing Foundation

Added visible `:focus-visible` rings for keyboard users, arrow-key roving navigation for button groups, and bootstrapped the Vitest testing framework with 52 unit tests covering all pure utility functions.

#### Changes

1. **Focus rings** — Global `:focus-visible` rule in `global.css` gives all focusable elements a blue outline on keyboard focus. Inputs suppress double-styling since they already have `box-shadow`.
2. **Arrow-key navigation** — New `useRovingIndex` composable enables ArrowLeft/Right/Up/Down navigation within button groups. Wired into type-buttons (BasicInfoSection) and story-point buttons (StoryPointsPicker).
3. **Vitest infrastructure** — Installed `vitest`, `@vue/test-utils`, `jsdom`. Added `test` config to `vite.config.ts` and `test`/`test:watch` scripts to `package.json`.
4. **Unit tests (52 tests, 4 suites):**
   - `diffText.test.ts` — 9 tests for LCS word-diff (identical, add, delete, replace, empty, HTML escaping)
   - `formatCoach.test.ts` — 19 tests for markdown formatting + structured response rendering
   - `formatJson.test.ts` — 8 tests for JSON syntax highlighting
   - `useForm.test.ts` — 16 tests for canSubmit, qualityScore, qualityScoreColor/Label, computedSummary

**New files:**
| File | Purpose |
|------|---------|
| `src/composables/useRovingIndex.ts` | Arrow-key roving focus for button groups |
| `src/utils/__tests__/diffText.test.ts` | Unit tests for diffWords |
| `src/utils/__tests__/formatCoach.test.ts` | Unit tests for formatCoachResponse |
| `src/utils/__tests__/formatJson.test.ts` | Unit tests for formatJson |
| `src/composables/__tests__/useForm.test.ts` | Unit tests for useForm computeds |

**Files changed:**
| File | Change |
|------|--------|
| `src/styles/global.css` | `:focus-visible` ring + suppress on `.input-base` |
| `src/composables/useRovingIndex.ts` | **NEW** |
| `src/components/form/BasicInfoSection.vue` | Wire `useRovingIndex` on type-buttons |
| `src/components/form/StoryPointsPicker.vue` | Wire `useRovingIndex` on points-picker |
| `vite.config.ts` | Add Vitest `test` block |
| `package.json` | Add `vitest`, `@vue/test-utils`, `jsdom`; `test` scripts |
| `src/components/layout/AppHeader.vue` | Version → v8.29 |

---

## Completed Improvements — v8.28 (2026-03-02)

### Accessibility: Foundational ARIA Pass

Added ARIA roles, labels, and focus management across the entire app. Screen readers can now identify modals, the combobox, icon-only buttons, form labels, and panel regions.

#### Changes

1. **Modals** — Added `role="dialog"`, `aria-modal="true"`, `aria-labelledby` to all 3 modals (confirm, settings, hotkey). Created `useFocusTrap` composable for keyboard focus trapping inside open modals.
2. **AssigneeCombobox** — Full ARIA combobox pattern: `role="combobox"` on input, `aria-expanded`, `aria-controls`, `aria-activedescendant`; `role="listbox"` on dropdown; `role="option"` + `aria-selected` on each option.
3. **Icon-only buttons** — Added `aria-label` to all icon-only buttons (theme toggle, settings gear, copy buttons, skill toggle, diff toggle, clear button, modal close button).
4. **Form labels** — `for`/`id` associations on SummaryBuilder selects/inputs (vehicle, product, layer, component, detail) and BasicInfoSection project select. `role="group"` + `aria-label` on type-buttons and StoryPointsPicker.
5. **PanelShell** — `role="region"` + `:aria-label="title"` on the panel wrapper.

**New file:**
| File | Purpose |
|------|---------|
| `src/composables/useFocusTrap.ts` | Reusable focus trap for modals |

**Files changed:**
| File | Change |
|------|--------|
| `src/composables/useFocusTrap.ts` | **NEW** — focus trap composable |
| `src/App.vue` | `role="dialog"`, `aria-modal`, `aria-labelledby` on confirm modal; focus trap |
| `src/components/settings/LLMSettings.vue` | Same ARIA attrs on settings modal; focus trap |
| `src/components/shared/HotkeyModal.vue` | Same ARIA attrs; focus trap; `aria-label` on close btn |
| `src/components/form/AssigneeCombobox.vue` | Full ARIA combobox pattern |
| `src/components/layout/AppHeader.vue` | `aria-label` on theme + settings buttons; version → v8.28 |
| `src/components/panels/CoachPanel.vue` | `aria-label` on copy + skill toggle buttons |
| `src/components/panels/AIReviewPanel.vue` | `aria-label` on copy + diff buttons |
| `src/components/form/SummaryBuilder.vue` | `for`/`id` on labels+inputs; `aria-label` on copy btn |
| `src/components/form/BasicInfoSection.vue` | `for`/`id` on project label+select; `role="group"` on type buttons |
| `src/components/form/StoryPointsPicker.vue` | `role="group"` + `aria-label` on wrapper |
| `src/components/layout/PanelShell.vue` | `role="region"` + `aria-label` |
| `src/components/panels/TicketHistoryPanel.vue` | `aria-label` on clear button |

---

## Potential Next Improvements

### High Priority
- [x] **Word / sentence count in description** — live word count below the task description textarea (e.g. "42 words"); helps writers gauge verbosity before submitting; analogous to the skill character counter

### Medium Priority
- [x] **Stream token speed indicator** — track tokens-per-second during streaming and show a subtle throughput label (e.g. "42 tok/s") near the blinking cursor; useful for diagnosing slow GLM responses
- [x] **Multiple LLM providers** — extend `llm.ts` and `LLMSettings.vue` to support any OpenAI-compatible endpoint (ZhipuAI, local Ollama, etc.); provider base URL stored in localStorage; `_callGLMStream` uses the active URL
- [x] **Skill diff indicator** — show a small "modified" dot or border on the skill label when a localStorage override is active; clicking "Reset to Default" removes the indicator
- [x] **Task history log** — collapsible panel showing last 20 created tickets with key, summary, project/type, and relative date; Clear button; persisted to localStorage
- [x] **Webhook response diff** — word-level LCS diff between previous and current analyze response; Diff/Normal toggle in AIReviewPanel header; green additions, red strikethrough removals
- [x] **Hotkey cheat sheet modal** — `?` key opens a styled modal listing all keyboard shortcuts; Escape dismisses
- [x] **Bulk template import** — drag-and-drop `TemplateDefinition[]` JSON onto chip area or use Import button in Settings; merges skipping duplicate keys; toast with count

- [x] **Free-input story points** — custom number field after the "8" preset button; mutually exclusive with preset buttons (selecting a button clears input, typing deactivates buttons); digits-only, max 3 chars; pre-populates on load if stored value is non-preset
- [x] **Copy button in n8n mode** — copy icon in AI Coach and AI Review panels now appears for webhook JSON responses too; falls back to `JSON.stringify(response, null, 2)` when no `message` string is present
- [x] **Ticket history hyperlinks** — ticket keys in TicketHistoryPanel are now `<a>` links to `https://jira.gwm.cn/browse/{key}`, opening in a new tab; underline on hover; matches the same URL pattern used in ProcessingSummary
- [x] **Coach skill on/off toggle** — button in CoachPanel header (LLM mode only) enables or disables the system prompt; OFF = no system message sent, model responds freely without JIRA-review constraints; resets to ON on page reload
- [x] **JIRA panel loading spinner** — spinning loader in JIRA brand blue (`#2684FF`) with localised text shown while ticket creation is in progress; matches animation pattern of Coach (green) and Analyze (purple) panels

### Low Priority / Polish
- [x] **Export/Import all settings** — one-click JSON export covering API key, model, coach/analyze mode, and both skill overrides; paste on another machine to restore full config
- [x] **Graceful 429 backoff** — when `glm429` is caught, auto-schedule a retry after a configurable delay (default 10 s) with a visible countdown in the panel rather than requiring the user to click Retry manually
- [x] **Skill file per language** — support `coach-skill-zh.md` / `coach-skill-en.md` as distinct source files so Chinese and English prompts can be authored fully independently rather than relying on `{lang}` substitution
- [x] **Template chip editor** — add/edit/reorder chips directly in Settings without touching JSON files in `src/config/templates/`; store overrides in localStorage the same way skill files do
- [x] **Dev Tools integration** — surface coach mode, analyze mode, active model, skill customisation status, `hadError` / `wasCancelled` state, and stream-active flag in the DevTools panel
- [x] **Dark/Light theme toggle** — Sun/Moon button in header; `[data-theme="light"]` CSS override block; `useTheme.ts` composable; preference persisted to localStorage
- [x] **UI design polish** — fixed `--text-secondary` color inversion bug; added `--shadow-panel/modal` tokens; applied box-shadow to panels and modals; smooth theme transition on body; version label updated
- [x] **Summary preview copy button** — clipboard icon in QualityMeter header (via named slot); copies assembled 5-part summary; fires toast on success
- [x] **Assignee avatar/initials** — colored initials circle before each name in the combobox dropdown; color deterministically hashed from user ID; handles CJK + Latin names
- [x] **Form field character limits** — live `{n}/50` counter under Component, `{n}/100` under Detail; turns orange at 80%, red at 100%; `maxlength` enforced

---

## v8.30 — Build Optimization

### Changes
- [x] **Manual chunks** — `manualChunks` function in `vite.config.ts` splits vendor (vue/@vue) and config (`src/config/**`) into separate chunks; improves caching since framework and config data change rarely
- [x] **Drop console/debugger** — `esbuild.drop: ['console', 'debugger']` strips any console/debugger statements from production builds as a safeguard
- [x] **Hidden sourcemaps** — `build.sourcemap: 'hidden'` generates `.map` files for error-tracking tools without exposing `sourceMappingURL` to end users
- [x] **Version bump** — v8.29 → v8.30 in AppHeader
- [x] **Equal-height columns** — left (Coach) and center (TaskForm) columns now stretch to the same grid row height via flex layout
- [x] **Remove stale webhook refs** — cleaned up dead `bothWebhook`, `localMode`, `localAnalyzeMode` references in LLMSettings template (leftover from removed n8n mode)
- [x] **KaTeX math rendering** — integrated KaTeX for LaTeX formula display in AI Coach and Review panels; supports `\(...\)`, `\[...\]`, `$$...$$`, `$...$` delimiters; placeholder-based extraction prevents `<br>` contamination inside TeX; KaTeX split into its own chunk (260 KB / 77 KB gzip) for independent caching

## v8.31 — UX Refinements: Action Buttons & Auto-grow Textarea

### Changes
- [x] **Auto-grow description textarea** — textarea expands automatically with content via `scrollHeight` watcher; min-height 160px preserved; resize handle removed
- [x] **Relocate Writing Guidance button** — moved from CoachPanel footer into TaskForm action bar alongside Analyze and Create; users no longer scroll through long Coach content to find it
- [x] **Icon-only action buttons** — all action buttons converted to compact 36px icon-only squares with hover tooltips; removes text clutter from the action bar
- [x] **Color-coded buttons** — Reset (red), Writing Guidance (yellow), Analyze Task (blue), Create JIRA (green) for instant visual recognition
- [x] **i18n updates** — shortened "Get Writing Guidance" → "Writing Guidance" / "获取写作指导" → "写作指导"; added `coaching` loading-state key

## v8.32 — Dynamic Focus Layout, Response Dividers & LaTeX Fix

### Changes
- [x] **Dynamic Focus Layout** — when Skill OFF is active, right panel (AI Review, JIRA, DevTools) collapses to `0fr` and left panel expands from `3fr` → `5fr` via CSS grid transition (250ms ease-in-out); toggling Skill ON restores the 3-column layout with smooth animation; mobile breakpoint unaffected
- [x] **Hide Analyze button in free-chat mode** — Analyze Task button auto-hides (`v-show`) when `coachSkillEnabled` is OFF; prevents accidental clicks since task analysis is irrelevant in free-form chat mode
- [x] **Unified response dividers** — response boundary between accumulated AI Coach turns now uses a distinct `===COACH_TURN===` marker rendered as a `2px solid #58a6ff` blue line (`coach-response-divider`); in-response `---` horizontal rules remain as subtle `1px dashed` separators (`coach-hr`); enables clear visual distinction between complete AI answers
- [x] **LaTeX Markdown-escape fix** — AI models that pre-escape `*` and `_` for Markdown safety (e.g. `$i_d^{\*}$`) now have these stripped inside math delimiters before KaTeX rendering; `\*` → `*` and `\_` → `_` (when not part of a LaTeX command); prevents broken formula output
- [x] **New test cases** — 5 tests added to `formatCoach.test.ts` covering LaTeX escape stripping, response-boundary divider rendering, and in-response `---` rendering

## v8.33 — Markdown Rendering Engine & Payload Consistency

### Design: Replace custom regex markdown parser with markdown-it

The old `formatMarkdownText()` in `formatCoach.ts` was a hand-rolled chain of ~12 regex substitutions that converted markdown to HTML. Each new markdown feature (tables, code blocks, blockquotes, nested lists) would require yet another fragile regex. Tables specifically were not supported — the AI Coach returning a markdown table would render as raw pipe characters.

**Decision:** Adopt the same architecture used by react-markdown/remark-math in the React ecosystem, but for Vue:

| Layer | Library | Role |
|-------|---------|------|
| Markdown parsing | **markdown-it** | GFM tables, fenced code, lists, headings, bold/italic, links, blockquotes — all built-in |
| Math rendering | **markdown-it-texmath** + **katex** (existing) | `$...$`, `$$...$$`, `\(...\)`, `\[...\]` parsed as first-class tokens |
| XSS sanitization | **DOMPurify** | Sanitizes `v-html` output; allows KaTeX/math tags, blocks `<script>`, `<iframe>`, etc. |

**Why markdown-it over marked or unified/rehype:**
- Plugin-based, battle-tested, GFM tables enabled by default (no extra plugin)
- `markdown-it-texmath` integrates KaTeX directly as a markdown-it plugin — math delimiters are tokenized at parse time, not regex-replaced afterwards
- `html: true` mode delegates sanitization to DOMPurify, which is more robust than trusting the parser to escape everything
- Smaller bundle impact than the full unified/remark/rehype stack

### Design: Payload content controlled by Skill/Task-Coach toggles

The "View Request Payload" in DevTools should show exactly what will be sent to the AI. The actual LLM request is composed of two parts: **system prompt** (from skill) + **user message** (from payload data). These must stay consistent.

**Payload rules:**

| Toggle State | Payload `data` fields | Coach system prompt | Coach user message |
|---|---|---|---|
| **Skill-ON + Task-Coach-ON** | `project_key`, `project_name`, `issue_type`, `summary`, `description`, `assignee`, `estimated_points` | coach skill | `buildUserMessage()` — structured with all fields |
| **Skill-ON + Task-Coach-OFF** | `description` only | coach skill | description text directly |
| **Skill-OFF** | `description` only | (empty) | description text directly |

Analyze and Create actions always use the full payload regardless of toggles (they require all fields for JIRA ticket creation/structured review).

### Changes

#### Markdown rendering engine
- [x] **markdown-it integration** — new `src/utils/markdown.ts` configures markdown-it with `html: true`, `breaks: true`, `linkify: true`; texmath plugin for KaTeX math; DOMPurify sanitization with allow-list for KaTeX tags (`eq`, `eqn`, `section`, `annotation`)
- [x] **formatCoach.ts rewrite** — `formatMarkdownText()` reduced from ~50 lines of regex to 15 lines calling `renderMarkdown()`; structured output (status badges, info rows, comment lists) unchanged
- [x] **CSS migration** — both `CoachPanel.vue` and `AIReviewPanel.vue` styles updated from custom `.coach-*` classes to standard HTML element selectors (`h1`–`h6`, `strong`, `code`, `pre`, `table`, `ul`, `ol`, `blockquote`, `a`); structured coach classes (`.coach-status-badge`, `.coach-info-row`, etc.) preserved
- [x] **Table rendering** — markdown tables now render as proper `<table>` with styled `<thead>`, hover rows, horizontal scroll on overflow; no more raw pipe characters
- [x] **Code block rendering** — fenced code blocks render in `<pre><code>` with language class, tertiary background, border, horizontal scroll
- [x] **Blockquote rendering** — `>` quoted text renders with purple left border and tertiary background
- [x] **texmath CSS** — added `markdown-it-texmath/css/texmath.css` import to global styles
- [x] **Type declaration** — added `markdown-it-texmath` module declaration in `env.d.ts`
- [x] **AI-escaped math fix preserved** — `\*` → `*` and `\_` → `_` cleanup inside math delimiters runs before markdown-it parsing

#### Payload consistency
- [x] **Toggle-aware `buildPayload()`** — for `coach` and `preview` actions, payload `data` now includes only description when Skill-OFF or Task-Coach-OFF; full fields only when both Skill-ON and Task-Coach-ON; `analyze`/`create` actions always return full payload
- [x] **Live preview reactivity** — `coachSkillEnabled` and `taskCoachEnabled` added as watch dependencies to the debounced payload watcher; DevTools preview updates immediately when toggles change
- [x] **Optional data fields** — `WebhookPayload.data` fields (except `description`) made optional in `src/types/api.ts` to support reduced payloads
- [x] **Coach user message alignment** — coach `getUserMessage` sends description text directly when Skill-OFF or Task-Coach-OFF (matches payload); calls `buildUserMessage()` only when Skill-ON + Task-Coach-ON (matches full payload)
- [x] **Dynamic `buildUserMessage()`** — only includes fields that are present in the payload (checks for `undefined`); no more hardcoded field list

#### Tests
- [x] **Updated test suite** — `formatCoach.test.ts` assertions updated for markdown-it output (standard HTML elements instead of custom classes); added new tests for tables, code blocks, and blockquotes; all 26 tests pass

### Modified files

| File | Change |
|------|--------|
| `package.json` | Added `markdown-it`, `markdown-it-texmath`, `dompurify`; devDeps `@types/markdown-it`, `@types/dompurify` |
| `src/utils/markdown.ts` | **New** — markdown-it + texmath + DOMPurify rendering pipeline |
| `src/utils/formatCoach.ts` | Replaced regex parser with `renderMarkdown()` call; removed `extractMath()` (now handled by texmath plugin) |
| `src/components/panels/CoachPanel.vue` | CSS: custom `.coach-*` classes → standard HTML element selectors + table/code/blockquote styles |
| `src/components/panels/AIReviewPanel.vue` | Same CSS migration as CoachPanel |
| `src/styles/global.css` | Added `markdown-it-texmath/css/texmath.css` import |
| `env.d.ts` | Added `markdown-it-texmath` module type declaration |
| `src/types/api.ts` | `WebhookPayload.data` fields made optional (except `description`) |
| `src/App.vue` | `buildPayload()` branches by Skill/Task-Coach toggles for coach/preview; watch includes toggle refs |
| `src/composables/useLLM.ts` | `buildUserMessage()` dynamic field inclusion; coach `getUserMessage` aligned with payload content |
| `src/utils/__tests__/formatCoach.test.ts` | Updated for markdown-it output; added table, code block, blockquote tests |

## v8.34 — Syntax Highlighting & Interactive JSON Viewer

### Design: Code syntax highlighting with highlight.js

AI Coach and Task Review panels frequently return fenced code blocks (C/C++, Python, shell scripts). Without syntax highlighting, code blocks are monochrome and hard to read.

**Decision:** Integrate **highlight.js** via markdown-it's built-in `highlight` callback — no extra plugin needed. Tree-shaken imports register only the languages relevant to automotive SW engineering, keeping the bundle small (~70 KB added).

**Registered languages:** C, C++, Python, JavaScript, TypeScript, Java, Bash/Shell, JSON, XML/HTML, YAML, SQL, CMake, Makefile

**Theme:** `github-dark-dimmed` — matches the app's dark UI color palette.

**Why highlight.js over alternatives:**
- markdown-it has native `highlight` option in its constructor — zero-plugin integration
- Tree-shakable: import only the languages needed, not the full 190+ language bundle
- `react-syntax-highlighter` (user's suggestion) is a React wrapper around highlight.js/Prism — same engine, but won't work in Vue

### Design: Interactive JSON Viewer (react-json-view style)

The old `JsonViewer` was a flat `v-html` dump using `formatJson()` — just regex-colored text with no interactivity. For a capable AI agent, users need to inspect structured API responses (JIRA results, webhook payloads) with the same UX as browser DevTools or react-json-view.

**Decision:** Rebuild `JsonViewer` as a recursive Vue component tree (`JsonNode`) with:

| Feature | Implementation |
|---------|---------------|
| Collapsible nodes | Click caret or bracket to fold/unfold objects and arrays |
| Type-colored values | `.jv-string` (blue), `.jv-number` (cyan), `.jv-boolean` (red), `.jv-null` (gray italic) |
| Purple keys | Object property names in `.jv-key` for visual distinction |
| Item count metadata | "3 items" / "5 keys" shown after brackets |
| Indentation guides | Dashed vertical `border-left` connecting parent to children |
| Row hover | Subtle blue tint on `.jv-row:hover` |
| Expand/Collapse All | Toolbar buttons; controlled via `generation` + `expandDepth` props |
| Default expand depth | 2 levels — shows top-level structure without overwhelming detail |
| Copy JSON | Preserved from original component |

**Why custom Vue component over a library:**
- `react-json-view` is React-only
- Vue JSON viewer libraries are poorly maintained or bloated
- Custom component is ~120 lines, perfectly themed, zero dependencies

### Changes

#### Syntax highlighting
- [x] **highlight.js integration** — `src/utils/markdown.ts` imports `highlight.js/lib/core` with 13 tree-shaken language registrations; markdown-it `highlight` callback tries exact language match, falls back to auto-detection
- [x] **Theme CSS** — `highlight.js/styles/github-dark-dimmed.min.css` imported in `src/styles/global.css`
- [x] **Panel CSS update** — `CoachPanel.vue` and `AIReviewPanel.vue` code block styles updated: `<pre>` keeps structural styles (border-radius, padding, border), `<pre code.hljs>` gets transparent background so highlight.js theme colors show through
- [x] **Syntax highlighting tests** — 2 new tests in `formatCoach.test.ts` verify `hljs-keyword` spans appear for C++ and Python code blocks (28 total)

#### Interactive JSON Viewer
- [x] **JsonNode.vue** — new recursive tree component with collapse/expand toggle, type-colored values, key/index rendering, comma placement, item count metadata, indentation guides
- [x] **JsonViewer.vue rewrite** — toolbar with Copy / Expand All / Collapse All buttons; delegates rendering to `JsonNode`; parses string input to object; controls `expandDepth` and `generation` props
- [x] **Deleted `formatJson.ts`** — dead utility no longer imported by any component
- [x] **Test rewrite** — replaced 8 dead `formatJson()` tests with 21 real `JsonNode` component tests covering primitives, objects, arrays, collapse/expand, commas, empty containers
- [x] **i18n** — added `dev.expandAll` / `dev.collapseAll` keys in EN and ZH

### Modified files

| File | Change |
|------|--------|
| `package.json` | Added `highlight.js` dependency |
| `src/utils/markdown.ts` | highlight.js core + 13 language imports; `highlight` callback in markdown-it config |
| `src/styles/global.css` | Added `highlight.js/styles/github-dark-dimmed.min.css` import |
| `src/components/panels/CoachPanel.vue` | Code block CSS: transparent background for `.hljs` inside `<pre>` |
| `src/components/panels/AIReviewPanel.vue` | Same code block CSS update |
| `src/components/shared/JsonViewer.vue` | Rewritten with toolbar + `JsonNode` delegation |
| `src/components/shared/JsonNode.vue` | **New** — recursive collapsible JSON tree renderer |
| `src/utils/formatJson.ts` | **Deleted** — no longer used |
| `src/utils/__tests__/formatJson.test.ts` | Rewritten: 8 dead tests → 21 real `JsonNode` component tests |
| `src/utils/__tests__/formatCoach.test.ts` | Added 2 syntax highlighting tests (C++, Python) |
| `src/i18n/en.ts` | Added `dev.expandAll`, `dev.collapseAll` |
| `src/i18n/zh.ts` | Added `dev.expandAll`, `dev.collapseAll` |
