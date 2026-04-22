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

---

## v8.35 — Task Coach label consistency fix (2026-03-09)

### Design rationale

When the **Skill toggle** is switched OFF, the Task Coach button was correctly disabled and visually grayed out, but its **label** still showed "Task Coach ON" if it had been enabled before. This created a confusing inconsistency — the button looked off but said "ON". The fix ensures the label, title, and aria-label all reflect the effective state by requiring **both** `taskCoachEnabled` and `coachSkillEnabled` to be true before showing "Task Coach ON".

### Changes

- [x] **Task Coach label fix** — button text, `title`, and `aria-label` now use `(taskCoachEnabled && coachSkillEnabled)` instead of just `taskCoachEnabled`, so the label reads "Task Coach OFF" whenever Skill is OFF
- [x] **USER_MANUAL.md** — added dedicated "Task Coach Toggle" section documenting the dependency on Skill toggle and the automatic label/state behavior
- [x] **Version bump** — v8.34 → v8.35

### Modified files

| File | Change |
|------|--------|
| `src/components/panels/CoachPanel.vue` | Task Coach button: label, title, aria-label now check both `taskCoachEnabled && coachSkillEnabled` |
| `src/components/layout/AppHeader.vue` | Version bump v8.34 → v8.35 |
| `USER_MANUAL.md` | Version bump + added Task Coach Toggle section with dependency explanation |

---

## v8.36 — Chat-style Coach Panel UI (2026-03-09)

### Design rationale

The Coach panel was a single-response renderer that concatenated multi-turn conversations with `===COACH_TURN===` separators. This produced a wall of text that was hard to follow. The redesign transforms it into a **proper chat UI** with distinct user/agent message bubbles, avatars, typing indicators, and auto-scroll — following the requirements in `new_requirements.MD`.

Key architectural decisions:
- **`createStreamFlow` dual mode** — Added `chatMode` flag to the shared factory, so the Analyze flow stays unchanged while Coach uses a `ChatMessage[]` array model
- **Full conversation history** sent to the LLM API — each request includes the full `[system, user, assistant, user, ...]` message chain, enabling true multi-turn dialogue instead of the `_historyPrefix` string hack
- **Per-bubble formatting** — Each assistant message is independently formatted via `formatCoachResponse()`, with RAF-throttling applied per ChatBubble during streaming
- **Backward-compatible** — `coachResponse` still works as a computed ref (returns last assistant message) so DevTools and response persistence don't break

### Changes

- [x] **`ChatMessage` interface** — Added to `types/api.ts` with `id`, `role`, `content`, `timestamp`, `isStreaming` fields
- [x] **`useLLM.ts` rewrite** — `createStreamFlow` now supports `chatMode: true` with messages array model; `_callGLMStream` accepts full `LLMChatMessage[]` instead of separate system/user strings; removed `_historyPrefix` concatenation
- [x] **`ChatBubble.vue`** — New component: role-based layout (user right / agent left), avatar with breathing halo animation during streaming, bubble corner connection, RAF-throttled markdown rendering, timestamp
- [x] **`CoachPanel.vue` rewrite** — Template now renders `ChatBubble` list with auto-scroll, typing indicator (3 animated dots), stream footer, and retry row; empty state with chips preserved
- [x] **`App.vue` wiring** — Props changed from `:response` to `:messages`; persistence updated to serialize/restore `ChatMessage[]` with format migration
- [x] **Avatar assets** — `agent_avy.png` and `user_avy.png` copied to `public/` for static serving
- [x] **`formatCoach.ts` cleanup** — Removed `===COACH_TURN===` divider preprocessing (dead code since messages are now separate array entries)
- [x] **i18n** — Added `coach.userLabel`, `coach.agentLabel`, `coach.typing` keys in EN and ZH

### Visual specifications (from new_requirements.MD)

| Spec | Implementation |
|------|---------------|
| Avatar size | 36x36px |
| Avatar shape | `border-radius: 10px` (rounded rectangle) |
| Agent thinking indicator | Breathing green halo animation on avatar |
| User bubble | Right-aligned, blue-tinted background, sharp top-right corner |
| Agent bubble | Left-aligned, neutral background, sharp top-left corner |
| Loading state | 3 animated bouncing dots with agent avatar |
| Auto-scroll | `watch` on message array + `nextTick` smooth scroll |
| Avatar preloading | Static assets in `public/`, no dynamic import jitter |

### Modified files

| File | Change |
|------|--------|
| `src/types/api.ts` | Added `ChatMessage` interface |
| `src/composables/useLLM.ts` | Chat mode in `createStreamFlow`, messages array model, full history API calls |
| `src/components/chat/ChatBubble.vue` | **New** — chat bubble with avatar, role-based layout, streaming support |
| `src/components/panels/CoachPanel.vue` | Rewritten: message list + ChatBubble + typing indicator + auto-scroll |
| `src/App.vue` | Wire `coachMessages`, update persistence format |
| `src/utils/formatCoach.ts` | Removed `===COACH_TURN===` dead code |
| `src/i18n/en.ts` | Added `coach.userLabel`, `coach.agentLabel`, `coach.typing` |
| `src/i18n/zh.ts` | Added `coach.userLabel`, `coach.agentLabel`, `coach.typing` |
| `src/components/layout/AppHeader.vue` | Version bump v8.35 → v8.36 |
| `public/agent_avy.png` | **New** — agent avatar static asset |
| `public/user_avy.png` | **New** — user avatar static asset |

---

## v8.36 continued — Sidebar-accent layout, smart scroll, shortcut reorganization, cancel/reset morph

### Sidebar-accent layout
Replaced bubble-based chat design with a cleaner **sidebar-accent** layout matching the reference UI:
- Both roles left-aligned; no bubble backgrounds
- 2px colored vertical border: **blue** for Agent, **gray** for User
- Uppercase role label ("AI COACH" / "YOU") above content
- Agent avatar visible; user identified by label + gray accent bar
- Shared `.coach-response` CSS extracted to `src/styles/coach-response.css` (global import, zero duplication)

### Smart auto-scroll
- Added `@vueuse/core` dependency; `useScroll` tracks whether user is at bottom
- Auto-scroll **pauses** when user scrolls up to read history; resumes when they scroll back down
- New messages always trigger smooth scroll; streaming chunks use instant scroll

### TransitionGroup animations
- Messages enter/exit via Vue `<TransitionGroup name="chat-msg">` (slide-up + fade)
- Typing indicator wrapped in `<Transition>` for smooth appear/disappear

### Avatar preloading
- `<link rel="preload">` added to `index.html` for both avatar images — no first-paint flash

### Keyboard shortcut reorganization

| Shortcut | Before | After |
|----------|--------|-------|
| `Ctrl+Enter` | Analyze Task | **Writing Guidance** |
| `Ctrl+Shift+Enter` | Create JIRA | **Analyze Task** |
| `Ctrl+Shift+C` | — | **Create JIRA** |
| `Ctrl+,` | Settings | Settings (unchanged) |

### Cancel/Reset button morph
The Reset button in TaskForm now **morphs** into a Cancel button during coach streaming:
- **Coach loading** → red pulsing stop-square icon, emits `cancelCoach`
- **Idle** → red circular-arrow icon, emits `reset`
- Icon swap uses Vue `<Transition name="icon-swap" mode="out-in">` with scale+rotate animation
- Removed the inline cancel button from CoachPanel's stream footer (was hard to catch while scrolling)

### Modified files

| File | Change |
|------|--------|
| `src/components/chat/ChatBubble.vue` | Rewritten: sidebar-accent layout with role label + 2px colored border |
| `src/components/panels/CoachPanel.vue` | Typing indicator restyled; `<TransitionGroup>`; smart scroll via `@vueuse/core`; removed inline cancel btn |
| `src/components/form/TaskForm.vue` | Reset button morphs to Cancel during coach loading; `icon-swap` transition; `cancelCoach` emit |
| `src/App.vue` | Wire `@cancel-coach`; shortcut keys reorganized |
| `src/components/shared/HotkeyModal.vue` | Updated shortcut table |
| `src/styles/coach-response.css` | **New** — extracted shared coach markdown styles |
| `src/styles/global.css` | Import `coach-response.css` |
| `src/i18n/en.ts` | New shortcut + hotkey labels |
| `src/i18n/zh.ts` | New shortcut + hotkey labels |
| `index.html` | Avatar preload hints |
| `USER_MANUAL.md` | Updated keyboard shortcuts section |
| `package.json` | Added `@vueuse/core` dependency |

---

## v8.37 — Portrait + Bubble Layout, Slate Theme, Theme-Aware Syntax (2026-03-09)

### Design Rationale
Refactored the Coach chat UI from a sidebar-accent layout to a polished **Portrait + Bubble** design. Agent messages appear on the left with a white card bubble and subtle shadow; user messages sit on the right with a blue-tinted bubble and flex-row-reverse layout. Updated the light theme palette to Tailwind's slate scale for a cleaner, more modern look. Added theme-aware syntax highlighting so code blocks switch from `github-dark-dimmed` (dark mode) to `github-light` colors (light mode). KaTeX math formulas now inherit `--text-primary` instead of using hardcoded black.

### Changes

| # | Change | Detail |
|---|--------|--------|
| 1 | Light theme → slate palette | `--bg-primary: #F8FAFC` (slate-50), `--text-primary: #1E293B` (slate-800), secondary/tertiary/muted all from slate scale |
| 2 | Portrait + Bubble layout | Agent: avatar left, `bg-secondary` bubble, `shadow-sm`, rounded `12px 12px 12px 4px`. User: avatar right (`flex-row-reverse`), blue-tinted bubble (`rgba(88,166,255,0.1)`), rounded `12px 12px 4px 12px` |
| 3 | User avatar | Added circular blue avatar with person icon SVG for user messages |
| 4 | Removed accent bars | Removed 2px vertical accent borders from chat messages |
| 5 | Typing indicator | Updated to bubble style matching new layout |
| 6 | Theme-aware highlight.js | Light-mode CSS overrides (`github-light` palette) scoped via `[data-theme="light"] .hljs` selectors |
| 7 | KaTeX color matching | `.coach-response .katex` inherits `--text-primary` so math formulas match surrounding text |
| 8 | Performance confirmed | `useI18n()` already at module level in `formatCoach.ts`; `saveDraft()` already has 300ms debounce |

### Modified Files

| File | Change |
|------|--------|
| `src/styles/variables.css` | Light theme colors → slate scale |
| `src/styles/coach-response.css` | Light hljs overrides, KaTeX color fix |
| `src/components/chat/ChatBubble.vue` | Full rewrite: Portrait + Bubble layout |
| `src/components/panels/CoachPanel.vue` | Typing indicator → bubble style |
| `src/components/layout/AppHeader.vue` | Version bump → v8.37 |
| `PLAN.md` | This changelog entry |

---

## v8.38 — Strip Bubbles, Borders & Badge Backgrounds (2026-03-09)

### Design Rationale
Removed the card-bubble backgrounds, box-shadows, and rounded corners from chat messages to create a cleaner, more open layout. Stripped decorative backgrounds and borders from status badges, info rows, main-message segments, and issue items. The result is a flatter, content-first design where typography and spacing carry the visual hierarchy instead of containers.

### Changes

| # | Change | Detail |
|---|--------|--------|
| 1 | Remove bubble backgrounds | Agent and user bubbles now transparent — no `background-color`, `box-shadow`, or `border-radius` |
| 2 | Status badges: no background/border | `.coach-status-pass/fail/warn` — removed colored backgrounds and borders, kept colored text |
| 3 | Info row: no bottom border | `.coach-info-row` — removed `border-bottom` divider |
| 4 | Main message: no card | `.coach-main-message` — removed background, border-left accent, border-radius, and padding |
| 5 | Issue items: no card | `.coach-issue-item` — removed background, border-left, border-radius; `.coach-issue-num` — removed filled circle, now text-only |

### Modified Files

| File | Change |
|------|--------|
| `src/components/chat/ChatBubble.vue` | Bubble styles → transparent, no shadow/radius |
| `src/styles/coach-response.css` | Stripped badge, segment, and issue-item decorations |
| `src/components/layout/AppHeader.vue` | Version bump → v8.38 |
| `PLAN.md` | This changelog entry |

---

## v8.39 — Light Theme Warm Palette + Math Rendering Pipeline (2026-03-12)

### Design Rationale
Two-part update: (1) Replaced the cold slate light theme with a warm cream/beige palette inspired by Claude.ai's light theme. (2) Fixed the markdown math rendering pipeline so LaTeX formulas display correctly in both English and Chinese AI responses instead of showing raw `\frac{...}`, `\begin{bmatrix}`, etc.

### Part 1: Warm Light Theme

Migrated light theme from Tailwind slate scale to a warm editorial palette. Dark theme unchanged.

| Token | Old (slate) | New (warm) |
|-------|------------|------------|
| `--bg-primary` | `#F8FAFC` | `#FAF9F6` |
| `--bg-secondary` | `#F1F5F9` | `#F3F1EC` |
| `--bg-tertiary` | `#E2E8F0` | `#E8E5DE` |
| `--border-color` | `#CBD5E1` | `#D6D2C9` |
| `--text-primary` | `#1E293B` | `#1A1A17` |
| `--text-secondary` | `#475569` | `#4A4840` |
| `--text-muted` | `#94A3B8` | `#8F8C83` |

Also added warm semi-transparent accent overlays (`--blue-subtle`, `--green-subtle`, etc.) and warm-tinted shadows. All 16+ component files updated to replace hardcoded `rgba()` with CSS variable references. Light-mode highlight.js overrides updated to warm editorial palette.

### Part 2: Math Rendering Pipeline Fix

**Root causes identified:**
1. `markdown-it-texmath` `brackets` mode (`\[...\]`) conflicts with markdown-it's escape processing — `\[` is consumed as escaped bracket before texmath runs. Fixed by switching to `dollars`-only mode with pre-processing conversion.
2. Math delimiter transformations (`\[` → `$$`) were running on code block content, destroying ASCII art diagrams. Fixed with extract/restore placeholder pattern.
3. LLMs commonly output spaced delimiters (`$ \hat{v} $`) which texmath rejects (requires `$` adjacent to content). Fixed with `fixSpacedDollarDelimiters` pre-processing.
4. LLMs sometimes wrap LaTeX in code fences (` ```latex ... ``` `). Fixed with `unwrapLatexFromCodeBlocks` heuristic.
5. LLMs pre-escape `*` and `_` inside math for markdown safety, breaking LaTeX. Fixed with `cleanMathEscapes`.
6. During SSE streaming, unclosed `$$` or `\[` cause raw LaTeX flashes. Fixed with `hideUnclosedMath` trimming.

**Final rendering pipeline (`renderMarkdown`):**
```
input
  → hideUnclosedMath (streaming only)
  → unwrapLatexFromCodeBlocks
  → extractCodeBlocks (protect code with placeholders)
  → normalizeMathDelimiters (\[...\] → $$...$$, \(...\) → $...$)
  → fixSpacedDollarDelimiters ($ x $ → $x$)
  → cleanMathEscapes (\* → *, \_ → _ inside math)
  → restoreCodeBlocks
  → md.render (markdown-it + texmath/katex)
  → DOMPurify.sanitize
```

**DOMPurify config** updated to allow KaTeX/MathML elements (`math`, `semantics`, `mrow`, `mi`, `mo`, `mfrac`, `msub`, `msup`, etc.) and attributes (`mathvariant`, `encoding`, `xmlns`, etc.).

### Test Coverage

Added `src/utils/__tests__/mathRendering.test.ts` with 29 tests covering:
- Dollar-delimited display/inline math (EKF vehicle dynamics content)
- Bracket-delimited math (`\[...\]`, `\(...\)`) conversion
- LaTeX accidentally in code fences
- ASCII art + math mixed content (code blocks preserved)
- **Spaced dollar delimiters** (`$ \hat{v} $`, `$ Q $`, `$ K = P_{k|k-1} H^T S^{-1} $`)
- Chinese + math mixed content (雅可比矩阵, 状态向量)
- Multiline `$$` bmatrix blocks
- Streaming mode (unclosed delimiters trimmed)
- Currency amounts (`$5`, `$100`) not affected

### Changes

| # | Change | Detail |
|---|--------|--------|
| 1 | Warm light theme | `variables.css` — cream/beige palette, warm shadows, accent overlays |
| 2 | Theme variable migration | 16+ component files — replaced hardcoded `rgba()` with CSS variables |
| 3 | Math pipeline rewrite | `markdown.ts` — code-block-safe pre-processing, dollars-only texmath mode |
| 4 | Spaced delimiter fix | `markdown.ts` — `fixSpacedDollarDelimiters()` handles `$ content $` → `$content$` |
| 5 | Streaming math safety | `markdown.ts` — `hideUnclosedMath()` trims trailing unclosed delimiters |
| 6 | DOMPurify KaTeX allow-list | `markdown.ts` — MathML tags + attributes in `PURIFY_CONFIG` |
| 7 | Streaming flag wiring | `formatCoach.ts`, `ChatBubble.vue`, `AIReviewPanel.vue` — pass `isStreaming` through pipeline |
| 8 | KaTeX/texmath CSS | `coach-response.css` — `.katex-display` overflow scroll, `eqn`/`eq` wrappers, light hljs overrides |
| 9 | Math rendering tests | `mathRendering.test.ts` — 29 tests for all math patterns |

### Modified Files

| File | Change |
|------|--------|
| `src/styles/variables.css` | Light theme → warm cream/beige palette + accent overlays |
| `src/styles/global.css` | Input focus, selection, button transitions use CSS variables |
| `src/styles/coach-response.css` | KaTeX display/inline styles, hljs light overrides, texmath wrappers |
| `src/utils/markdown.ts` | Full pipeline rewrite: extract/restore, spaced delimiters, bracket→dollar conversion |
| `src/utils/formatCoach.ts` | Pass `isStreaming` flag to `renderMarkdown` |
| `src/components/chat/ChatBubble.vue` | Pass `isStreaming` to `formatCoachResponse`, final render on stream end |
| `src/components/panels/AIReviewPanel.vue` | Pass `isAnalyzing` as streaming flag, theme variable CSS |
| `src/utils/__tests__/mathRendering.test.ts` | **New** — 29 tests for math rendering pipeline |
| `PLAN.md` | This changelog entry |

## v8.40 — LaTeX Line Break & Table Math Rendering Fix (2026-03-12)

### Design Rationale
Two LaTeX rendering bugs discovered during frontend testing: (1) `\\[4pt]` line break commands inside display math were being corrupted by the double-escape normalization, rendering raw `\[4pt]` text. (2) LaTeX formulas containing pipe characters (`|`) inside markdown tables were breaking table parsing — e.g. `$P_{k|k-1}$` split on `|` as a column separator, showing raw LaTeX instead of rendered math.

### Bug 1: `\\[4pt]` Line Break Corruption

**Root cause:** The double-escape normalization (`\\[` → `\[`) in `normalizeMathDelimiters` was applied unconditionally. In LaTeX, `\\[4pt]` means "line break with 4pt vertical spacing" — the `\\[` is NOT a display math delimiter. After normalization, `\\[4pt]` became `\[4pt]`, which KaTeX couldn't parse, rendering it as raw text.

**Fix:** Added a negative lookahead to the `\\[` normalization regex to skip `\\[<dimension>]` patterns (e.g. `\\[4pt]`, `\\[6mm]`, `\\[10em]`). Supports all standard LaTeX units: `pt`, `mm`, `cm`, `em`, `ex`, `mu`, `bp`, `dd`, `pc`, `sp`. Also split the single regex into four separate replacements for `\[`, `\]`, `\(`, `\)` for clarity.

### Bug 2: Pipe `|` in Math Inside Tables

**Root cause:** Markdown-it table parsing splits rows on `|` characters. When LaTeX inside a table cell contains `|` (common in Kalman filter notation like `P_{k|k-1}`, `\hat{\mathbf{x}}_{k|k}`), the pipe is interpreted as a column separator, fracturing the math expression across multiple cells and breaking both the table structure and LaTeX rendering.

**Fix:** Added `escapePipesInMath()` pre-processing step that replaces `|` → `\vert` inside `$...$` and `$$...$$` delimiters before markdown-it processes the table. This preserves the mathematical meaning while avoiding table parsing conflicts.

### Updated Rendering Pipeline
```
input
  → hideUnclosedMath (streaming only)
  → unwrapLatexFromCodeBlocks
  → extractCodeBlocks (protect code with placeholders)
  → normalizeMathDelimiters (\[...\] → $$...$$, skip \\[4pt] line breaks)
  → fixSpacedDollarDelimiters ($ x $ → $x$)
  → cleanMathEscapes (\* → *, \_ → _ inside math)
  → escapePipesInMath (| → \vert inside math, for table safety)   ← NEW
  → restoreCodeBlocks
  → md.render (markdown-it + texmath/katex)
  → DOMPurify.sanitize
```

### Test Coverage

Added 8 new tests to `mathRendering.test.ts` (37 total):
- `\\[4pt]` line break preserved inside display math (`$$...$$`)
- `\\[6pt]` line break preserved inside bracket-delimited display math (`\[...\]`)
- `\\[10mm]` line break preserved inside matrix
- Double-escaped display math `\\[...\\]` still converts correctly
- `$P_{k|k-1}$` renders as KaTeX inside markdown table
- `$\hat{\mathbf{x}}_{k|k}$` renders in table cells
- Tables without math unaffected
- Display math with pipes `$$|x| + |y|$$` renders correctly

### Changes

| # | Change | Detail |
|---|--------|--------|
| 1 | Line break fix | `markdown.ts` — negative lookahead in `normalizeMathDelimiters` skips `\\[<dim>]` |
| 2 | Table math fix | `markdown.ts` — new `escapePipesInMath()` replaces `\|` → `\vert` inside math delimiters |
| 3 | Pipeline update | `markdown.ts` — added `escapePipesInMath` step between `cleanMathEscapes` and `restoreCodeBlocks` |
| 4 | New tests | `mathRendering.test.ts` — 8 new tests for line breaks and table math (37 total) |

### Modified Files

| File | Change |
|------|--------|
| `src/utils/markdown.ts` | `normalizeMathDelimiters` negative lookahead + new `escapePipesInMath()` function + pipeline step |
| `src/utils/__tests__/mathRendering.test.ts` | 8 new tests for `\\[4pt]` line breaks and pipe-in-table math |
| `PLAN.md` | This changelog entry |

### Math Rendering — Standards Compatibility Note

The current design covers **LaTeX math mode + AMS-LaTeX subset**, rendered by **KaTeX 0.16.33** (~300+ commands). Preprocessing handles 6+ delimiter/escaping variations that LLMs produce (`$`, `$$`, `\[...\]`, `\(...\)`, double-escaped `\\[...\\]`, spaced `$ x $`, code-fenced LaTeX). Output is dual-format: HTML (visual) + MathML (accessible).

**Supported:** Greek letters, operators, fractions, roots, matrices (`bmatrix`/`pmatrix`/`cases`), accents (`\hat`/`\dot`/`\vec`), font commands (`\mathbf`/`\mathcal`/`\mathbb`), spacing, colors, `\cancel`, `\text{}`, most `amsmath` environments.

**Not supported:** `\newcommand`/`\def` macros, `\tikz`/`\pgfplots` diagrams, `\chemfig`, full document-level LaTeX, AsciiMath, Typst, Office Math (OMML), Content MathML input. Switching to MathJax would broaden coverage but at the cost of slower synchronous rendering and layout reflows during SSE streaming — not worth the trade-off for this use case.

## v8.42 — Markdown Pipeline Rewrite: unified/remark/rehype (2026-03-13)

### Design Rationale
The markdown-it + markdown-it-texmath pipeline used fragile regex-based math parsing (`/\${2}([^$]*?[^\\])\${2}/gmy`) that failed on complex multiline LaTeX from LLM output (e.g. `$\begin{bmatrix}...\end{bmatrix}$` with line breaks). Tests passed but production LLM output triggered edge cases the regex couldn't handle. Replaced the entire pipeline with the unified/remark/rehype ecosystem which uses AST-based parsing — math is detected as tree nodes, not regex matches, eliminating an entire class of fragile interactions between math and markdown features (tables, code blocks, escapes).

### Pipeline Change

**Old (markdown-it):**
```
text → extractCodeBlocks → normalizeMathDelimiters → fixSpacedDollarDelimiters
     → cleanMathEscapes → escapePipesInMath → restoreCodeBlocks
     → markdown-it.render (texmath plugin, hljs highlight callback) → DOMPurify
```

**New (unified/remark/rehype):**
```
text → unwrapLatexFromCodeBlocks → normalizeMathDelimiters
     → normalizeDisplayMathBlocks → fixSpacedDollarDelimiters → escapePipesInMath
     → unified(remarkParse → remarkMath → remarkGfm → remarkBreaks
              → remarkRehype → rehypeRaw → rehypeKatex → rehypeHighlight
              → rehypeStringify) → DOMPurify
```

### Functions Removed (handled by AST)
- `extractCodeBlocks` / `restoreCodeBlocks` — remark-math's AST parser naturally skips code blocks
- `cleanMathEscapes` — remark-math handles escaped `*` and `_` inside math at the AST level

### Functions Added
- `normalizeDisplayMathBlocks` — ensures multiline `$$` blocks have `$$` on its own line for remark-math flow detection

### Functions Kept
- `hideUnclosedMath` — streaming protection (trims trailing unclosed delimiters)
- `unwrapLatexFromCodeBlocks` — detects LaTeX in ````latex` code fences
- `normalizeMathDelimiters` — converts `\[...\]` → `$$...$$`, `\(...\)` → `$...$`
- `fixSpacedDollarDelimiters` — trims spaces in `$ content $` (updated: single-line only for `$$`)
- `escapePipesInMath` — escapes `|` in math for GFM tables (still needed: GFM splits on `|` before remark-math inline parsing)

### Changes

| # | Change | Detail |
|---|--------|--------|
| 1 | Pipeline rewrite | `markdown.ts` — replaced markdown-it + texmath with unified/remark/rehype |
| 2 | New preprocessor | `normalizeDisplayMathBlocks()` — moves multiline `$$` to own lines |
| 3 | CSS cleanup | `global.css` — removed `markdown-it-texmath/css/texmath.css` and `highlight.js/styles/github-dark-dimmed.min.css` imports |
| 4 | Test update | Currency `$5`/`$100` test relaxed — inherently ambiguous with `$` math delimiters |

### Modified Files

| File | Change |
|------|--------|
| `src/utils/markdown.ts` | Full rewrite: unified/remark/rehype pipeline, removed 4 functions, added 1 |
| `src/styles/global.css` | Removed markdown-it-texmath and highlight.js CSS imports |
| `src/utils/__tests__/mathRendering.test.ts` | Relaxed currency amount test assertion |
| `package.json` | Version bump to 8.42.0 |
| `PLAN.md` | This changelog entry |

### Compatibility Note
- `markdown-it` and `markdown-it-texmath` packages remain in `package.json` but are no longer imported. They can be safely removed with `npm uninstall markdown-it markdown-it-texmath @types/markdown-it`.

### Bug Fix Records

| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 1 | Multiline `$\begin{bmatrix}...\end{bmatrix}$` display math not rendered in production | `markdown-it-texmath` used regex `/\${2}([^$]*?[^\\])\${2}/gmy` that failed on complex multiline LaTeX with subtle whitespace/encoding differences in real LLM output | Replaced entire pipeline with AST-based `unified/remark-math` — math parsed as tree nodes, not regex |
| 2 | `$$` on same line as content (e.g. `$$\dot{X}=\begin{bmatrix}...`) not parsed as display math | `remark-math` flow parser requires `$$` on its own line | Added `normalizeDisplayMathBlocks()` preprocessor to move multiline `$$` to own lines |
| 3 | `fixSpacedDollarDelimiters` collapsed multiline `$$` blocks onto one line | Original regex `\$\$\s+([\s\S]+?)\s+\$\$` matched across newlines, destroying block structure | Changed to `[ \t]+` (horizontal whitespace only) for `$$` patterns |
| 4 | Pipe `\|` in math inside GFM tables still split columns | GFM table parser splits on `\|` at block level before `remark-math` inline parsing | Kept `escapePipesInMath()` preprocessor — replaces `\|` → `\vert` inside `$...$` before parsing |

### Test Coverage — 60 tests (all pass)

| Category | Count | Key Scenarios |
|----------|-------|---------------|
| Dollar-delimited math | 7 | Display `$$`, inline `$`, code blocks, headings, lists |
| Bracket-delimited math | 3 | `\[...\]`, `\(...\)`, no raw delimiter leaks |
| LaTeX in code fences | 2 | Unwrap ````latex` → `$$`, no raw `\begin` leak |
| Code blocks + math mixed | 4 | ASCII art preserved, pipes not mangled |
| Spaced dollar delimiters | 7 | `$ content $` → `$content$`, currency `$5`, multiple on same line |
| Multiline `$$` bmatrix | 2 | Same-line `$$`, no blank line after heading |
| Chinese text display math | 3 | Chinese paragraphs, `$$` with Chinese, bmatrix with Chinese context |
| `\\[4pt]` line breaks | 4 | `\\[4pt]`, `\\[6pt]`, `\\[10mm]`, double-escaped `\\[...\\]` |
| Pipe in math + tables | 4 | `$P_{k\|k-1}$` in table, pipe in display math |
| Streaming mode | 3 | Unclosed `$$`, unclosed `\[`, complete blocks |
| Code block protection | 3 | ````markdown` as code, `$` in code blocks, inline code with `$` |
| LLM edge cases | 6 | `\(...\)`, nested fractions, empty math, bold+math, strikethrough+math, task lists |
| Chinese/English bilingual | 12 | No-space adjacent, full-width punctuation, Chinese tables, Chinese headings, mixed EN/ZH paragraphs, code with Chinese comments, spaced `$` in Chinese, `\[...\]` with Chinese |

---

## v8.41 — View Coach Response (Raw) Debug Panel (2026-03-12)

### Design Rationale
When debugging LaTeX/math rendering issues, it's critical to see the raw AI response text before the markdown pipeline transforms it. This helps determine whether a rendering bug is caused by the AI's output or the rendering pipeline. Added a "View Coach Response (Raw)" collapsible section to the DevTools panel, with the same toolbar buttons (copy, expand all, collapse all) used by the existing "View Request Payload" section.

### Implementation

Added a new `<details>` section in `DevTools.vue` between "View Request Payload" and "Webhook Configuration":
- Shows the last assistant message's raw content as a monospace `<pre>` block
- Only visible when a coach response exists (`v-if="lastCoachRaw"`)
- Toolbar with 3 buttons matching JsonViewer's exact styles (`jv-toolbar`, `jv-copy-btn`, `jv-action-btn`, `jv-icon`):
  - **Copy** — copies raw text to clipboard with toast notification
  - **Expand All** (chevron down) — shows full text, scrollable up to 400px
  - **Collapse All** (chevron up) — collapses to 80px preview height
- `coachMessages` array passed from `App.vue` → `DevTools.vue` as a new prop
- Computed `lastCoachRaw` extracts the last assistant message's content

### Changes

| # | Change | Detail |
|---|--------|--------|
| 1 | Raw coach viewer | `DevTools.vue` — new `<details>` section with `<pre>` raw text display |
| 2 | Toolbar buttons | `DevTools.vue` — copy, expand all, collapse all using same `jv-*` styles as JsonViewer |
| 3 | Prop wiring | `App.vue` — passes `:coach-messages` to DevTools |
| 4 | i18n keys | `en.ts` — `'View Coach Response (Raw)'`, `zh.ts` — `'查看 Coach 响应（原始文本）'` |

### Modified Files

| File | Change |
|------|--------|
| `src/components/dev/DevTools.vue` | New raw coach response section with toolbar, `coachMessages` prop, `copyCoachRaw()`, `rawExpanded` ref |
| `src/App.vue` | Pass `:coach-messages="coachMessages"` to DevTools |
| `src/i18n/en.ts` | Added `viewCoachPayload` key |
| `src/i18n/zh.ts` | Added `viewCoachPayload` key |
| `PLAN.md` | This changelog entry |

---

## v8.43 — Response Format Instructions & DevTools Always-Visible (2026-03-13)

### Response Format Instructions

Added a configurable **response-format.md** skill that is automatically appended to all LLM system prompts (both Coach and Analyze). This tells the LLM to use Markdown formatting with `$`/`$$` math delimiters, standard LaTeX commands, and language matching — ensuring the LLM output is always compatible with our unified/remark/rehype rendering pipeline.

### Integration Design

- `response-format.md` is imported as raw text and appended to the end of every system prompt via `getCoachSkill()` and `getAnalyzeSkill()`
- New `getCoachSkillRaw()` / `getAnalyzeSkillRaw()` functions return skill content WITHOUT the appended format (used by the settings UI so users edit skills cleanly)
- Fully configurable: editable in LLM Settings, persisted via localStorage, resettable to default — same pattern as Coach/Analyze skills

### DevTools: Always-Visible Raw Coach Panel

The "View Coach Response (Raw)" panel was previously hidden (`v-if="lastCoachRaw"`) until the first coach response, making it impossible to see on initial launch. Changed to always-visible with a placeholder message when empty.

### Bug Fix Records

| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 1 | "View Coach Response (Raw)" invisible on initial launch | `v-if="lastCoachRaw"` hid the entire `<details>` when no assistant message existed | Removed `v-if`, show placeholder text when empty |

### Test Coverage — 67 tests (all pass)

| Category | Count | Change |
|----------|-------|--------|
| All previous categories | 66 | Unchanged |
| `\left[...\right]` bracket math | 1 | New: inline math with `\left[-\frac{...}\right]^T` in Chinese context |

### Changes

| # | Change | Detail |
|---|--------|--------|
| 1 | Response format skill | `response-format.md` — Markdown + math formatting instructions for LLM |
| 2 | Skill system integration | `index.ts` — imports `response-format.md`, appends to all system prompts, adds get/set/reset/raw functions |
| 3 | Settings UI | `LLMSettings.vue` — new "Response Format Instructions" textarea section with reset and char/token counter |
| 4 | DevTools fix | `DevTools.vue` — raw coach panel always visible, placeholder when empty |
| 5 | i18n | Added `responseFormat`, `responseFormatHint`, `noCoachResponse` keys in en.ts + zh.ts |
| 6 | Version bump | `package.json` → 8.43.0, `AppHeader.vue` → v8.43 |

### Modified Files

| File | Change |
|------|--------|
| `src/config/skills/response-format.md` | New: LLM response format instructions (Markdown, math, tables, language) |
| `src/config/skills/index.ts` | Import response-format.md, append to system prompts, add raw getters + response format get/set/reset |
| `src/components/settings/LLMSettings.vue` | New Response Format textarea section, use raw skill getters, persist on save |
| `src/components/dev/DevTools.vue` | Always show raw coach panel, placeholder when empty |
| `src/i18n/en.ts` | Added `responseFormat`, `responseFormatHint`, `noCoachResponse` |
| `src/i18n/zh.ts` | Added `responseFormat`, `responseFormatHint`, `noCoachResponse` |
| `src/utils/__tests__/mathRendering.test.ts` | Added `\left[...\right]` bracket math test (67 total) |
| `src/components/layout/AppHeader.vue` | UI version → v8.43 |
| `package.json` | Version → 8.43.0 |
| `PLAN.md` | This changelog entry |

## v8.44

**Coach History — Global Q&A Record Storage with Bubble & Badge UI**

### Design Rationale
- Users needed persistent access to past coach conversations across sessions
- Each message gets a unique 8-char hash ID + full timestamp for identification
- localStorage chosen over IndexedDB — 200-record cap keeps it well within limits
- Singleton composable pattern matches existing `useTicketHistory.ts`

### Changes
1. **CoachHistoryRecord type** — new interface in `api.ts`, derived from ChatMessage minus `isStreaming`
2. **useCoachHistory composable** — singleton with CRUD, search, filter, cap (200), export (JSON/MD)
3. **Chat/History tabs** — CoachPanel gains tab bar below header-actions; Chat is live conversation, History is past records
4. **Hash ID badges** — every chat bubble now shows role badge + timestamp + hash ID
5. **History tab UI** — search (debounced 150ms), role filter, multi-select with checkboxes, delete, clear all
6. **Replay** — click on past USER messages to re-send to coach
7. **Download modal** — compact modal with JSON / Markdown / Both format picker
8. **i18n** — full EN + ZH strings for all new UI elements
9. **Save policy** — only saves on normal completion (not cancel/error/429)

### Modified Files
| File | Change |
|------|--------|
| `src/types/api.ts` | Added `CoachHistoryRecord` interface, `hashId` to `ChatMessage` |
| `src/composables/useCoachHistory.ts` | **New** — history composable |
| `src/composables/useLLM.ts` | Save messages to history on completion |
| `src/components/panels/CoachPanel.vue` | Tab bar, history tab integration, replay emit |
| `src/components/chat/ChatBubble.vue` | Hash ID badge |
| `src/components/coach/CoachHistoryTab.vue` | **New** — history tab UI |
| `src/components/coach/DownloadModal.vue` | **New** — format picker modal |
| `src/components/layout/AppHeader.vue` | Version bump to v8.44 |
| `src/i18n/en.ts` | Coach history i18n keys, confirm dialog keys |
| `src/i18n/zh.ts` | Coach history i18n keys (Chinese), confirm dialog keys |
| `src/App.vue` | Replay handler, setCoachSkillEnabled import |
| `PLAN.md` | This section |

---

## v8.45 — Fix projects.ts data errors & assignee font color

**Date:** 2026-03-16

### Design Rationale
User manually edited `projects.ts` and introduced minor data issues. Additionally, the assignee combobox displayed the selected name as a placeholder styled with `--text-muted`, making it visually dimmer than the project `<select>` which uses `--text-primary`. The fix adds a conditional `.has-selection` CSS class to override placeholder color when an assignee is selected.

### Changes
1. **projects.ts** — Removed leading space in `Suspension Feature Team` team name
2. **projects.ts** — Flagged duplicate ID `GW00285392` (used for both Wan Fei and Li Ziyue in DKKFT)
3. **AssigneeCombobox.vue** — Added `.has-selection` class + CSS rule so selected assignee name renders in `--text-primary` (matching project select color)

### Modified Files
| File | Change |
|------|--------|
| `src/config/projects.ts` | Fixed leading space in SWSU team name |
| `src/components/form/AssigneeCombobox.vue` | Added `has-selection` class toggle + placeholder color override |
| `src/components/layout/AppHeader.vue` | Version bump to v8.45 |
| `PLAN.md` | This section |

---

## v8.46 — Draggable column resize handles for 3-panel layout

**Date:** 2026-03-16

### Design Rationale
The three-column layout (Coach / Task Form / AI Review) used fixed CSS grid ratios (`3fr 3fr 2fr`) with no way to resize. Added drag handles between columns so users can adjust column widths by dragging. Column sizes persist to localStorage. Also fixed the `ProjectKey` type which was missing the 5 new team keys (SWSS, SWBS, SWVV, SWCD, SWSU) added to `projects.ts`.

### Changes
1. **App.vue** — Added two drag handle elements between columns with `mousedown/mousemove/mouseup` drag logic
2. **App.vue** — Grid now uses dynamic `gridTemplateColumns` style bound to reactive `colFractions` ref
3. **App.vue** — Column sizes saved to / restored from localStorage (`grid-col-sizes`)
4. **App.vue** — Drag handles hidden on mobile (`max-width: 1024px`) and when right column is collapsed
5. **team.ts** — Extended `ProjectKey` union type with 5 new keys (SWSS, SWBS, SWVV, SWCD, SWSU)

### Modified Files
| File | Change |
|------|--------|
| `src/App.vue` | Drag handles, resize logic, dynamic grid columns, localStorage persistence |
| `src/types/team.ts` | Extended `ProjectKey` type with new team keys |
| `src/components/layout/AppHeader.vue` | Version bump to v8.46 |
| `PLAN.md` | This section |

---

## v8.47 — Remove misleading panel vertical resize handle

**Date:** 2026-03-16

### Design Rationale
The AIReviewPanel had `resizable` (CSS `resize: vertical`) which showed a drag cursor at the bottom-right corner. With the new column drag handles (v8.46) this was confusing — users saw a resize cursor and tried to drag the panel, misleading them. Removed the vertical resize and let the panel auto-size with a generous `max-height` instead.

### Changes
1. **AIReviewPanel.vue** — Replaced `resizable` prop with `max-height="2500px"` so panel body auto-sizes to content without showing a resize grip

### Modified Files
| File | Change |
|------|--------|
| `src/components/panels/AIReviewPanel.vue` | Removed `resizable`, added `max-height="2500px"` |
| `src/components/layout/AppHeader.vue` | Version bump to v8.47 |
| `PLAN.md` | This section |

---

## v8.48 — Adaptive Screen Sizing (2026-03-16)

**CSS-only proportional scaling for all screen sizes (1366px–3840px)**

### Design Rationale
- Different users have different display screen sizes — from 1366x768 laptops to 3840x2160 4K monitors
- On small screens the 3-column layout felt cramped; on large screens there was too much wasted space
- All 3 columns (Coach + Task Form + AI Review) must remain visible at every size — no collapsing or hiding
- Solution: CSS `clamp()` with linear interpolation `calc(Apx + Bvw)` for fluid sizing
- Each variable calibrated so **1920px viewport = exact current baseline values** (zero visual regression)
- No JavaScript screen detection needed — pure CSS handles everything
- Existing drag-resize column system and `fr`-based grid preserved

### Scaling Behavior
| Screen Size | --space-4 | --font-base | --font-lg | Sidebar Width |
|-------------|-----------|-------------|-----------|---------------|
| 1366x768    | 12px      | 11px        | 13px      | 48px          |
| 1920x1080   | 16px      | 12px        | 14px      | 64px          |
| 2560x1440   | 21px      | 13px        | 15px      | 82px          |
| 3840x2160   | 22px (max)| 16px (max)  | 19px (max)| 86px (max)    |

### Changes
1. **Fluid CSS variables** — Added theme-independent `:root` block with `clamp()` variables for spacing (--space-1 to --space-6), typography (--font-xs to --font-xl), icons (--icon-sm, --icon-md), and element sizing (--avatar-size, --sidebar-width)
2. **Grid constraints** — Added proportional `min-width: clamp(...)` to grid columns; `.app-main` max-width expanded from 2000px to `clamp(1200px, 95vw, 3600px)` for 4K displays
3. **Focus mode fix** — Override `.col-right` min-width to 0 in focus mode to prevent overflow when right panel is hidden
4. **Component updates** — Replaced 100+ hardcoded px values across 14 files with CSS variable references

### Modified Files
| File | Change |
|------|--------|
| `src/styles/variables.css` | Added fluid `:root` block with clamp() variables; removed static --space-* from theme blocks |
| `src/App.vue` | Adaptive padding, modal sizing, grid column min-widths, focus mode override |
| `src/components/layout/AppHeader.vue` | All px replaced with CSS variables; version bump to v8.48 |
| `src/components/layout/AppSidebar.vue` | Sidebar width, icon sizes, spacing all use CSS variables |
| `src/components/layout/PanelShell.vue` | Panel header/body/footer padding and font sizes |
| `src/styles/coach-response.css` | All typography and spacing in markdown rendering |
| `src/components/chat/ChatBubble.vue` | Avatar sizes, message padding, font sizes |
| `src/styles/global.css` | Input base and scrollbar sizing |
| `src/components/settings/LLMSettings.vue` | Modal, field, button, chip editor sizing |
| `src/components/shared/HotkeyModal.vue` | Modal and key display sizing |
| `src/components/shared/ConfirmDialog.vue` | Modal and button sizing |
| `src/components/form/TaskForm.vue` | Form gap, error banner, action buttons |
| `src/components/form/BasicInfoSection.vue` | Section padding, field labels, type buttons |
| `src/components/defects/DefectDetail.vue` | Drawer width: `clamp(360px, 30vw, 620px)` |
| `src/components/shared/ToastContainer.vue` | Toast position and min/max width |
| `package.json` | Version bump to 8.48.0 |
| `PLAN.md` | This section |

---

## v8.49 — Cleanup: remove defect management & fix constants data (2026-03-17)

**Housekeeping release — remove unused defect-tracking module, fix data duplicates in config.**

### Changes

1. **constants.ts** — Removed duplicate entries in `VEHICLE_OPTIONS` (`GWM_DE07-CH`, `GWM_DE06`, `GWM_EC15G` ×3, `GWM_H01`); normalized missing `GWM_` prefix on 6 entries; removed duplicate `EDC` in `PRODUCT_OPTIONS`; fixed spacing in `LAYER_OPTIONS`; reorganized vehicle list by series
2. **Removed defect management module** — Deleted `server/` backend (Fastify + LibSQL), `src/components/defects/` (7 files), `src/components/dashboard/` (3 files), `src/components/shared/EmptyState.vue` & `Pagination.vue`, `src/composables/useDefects.ts`, `useApi.ts`, `useFilters.ts`, and unused `AppSidebar.vue` — none were wired into the main app

### Modified Files
| File | Change |
|------|--------|
| `src/config/constants.ts` | Deduplicated vehicles/products, normalized `GWM_` prefix, fixed spacing |
| `src/components/layout/AppHeader.vue` | Version bump to v8.49 |
| `PLAN.md` | This section |

### Deleted Files
| File / Folder | Reason |
|---------------|--------|
| `server/` | Backend for defect tracking — not part of smart_agent |
| `src/components/defects/` | 7 defect UI components — unused |
| `src/components/dashboard/` | 3 stats/chart components — only served defects |
| `src/components/shared/EmptyState.vue` | Only used by defect table |
| `src/components/shared/Pagination.vue` | Only used by defect table |
| `src/components/layout/AppSidebar.vue` | Defect/dashboard nav — not imported anywhere |
| `src/composables/useDefects.ts` | Defect CRUD composable |
| `src/composables/useApi.ts` | HTTP client — only used by useDefects |
| `src/composables/useFilters.ts` | Filter composable — only used by defects |

---

## v8.50 — Help button linking to user manual wiki (2026-03-20)

**Added a help icon button in the header that opens the Confluence user manual in a new tab.**

### Design Rationale

The user manual is hosted on the corporate Confluence wiki. Rather than embedding markdown rendering inline (which would duplicate content and go stale), a simple external link keeps the manual as the single source of truth. The help button uses a `?` circle SVG icon, placed between the theme toggle and settings gear — consistent with the existing header button styling. On hover it highlights in accent-blue to differentiate it from the settings gear.

### Changes

1. **Help button** — New `<button class="help-btn">` with a question-mark-circle SVG icon, opens `https://wiki.gwm.cn/pages/viewpage.action?pageId=506263489#` in a new tab via `window.open` with `noopener`
2. **Consistent styling** — Button dimensions, border, radius, and transitions match `theme-btn` and `settings-btn`; hover color is `--accent-blue` to visually distinguish help from settings

### Modified Files
| File | Change |
|------|--------|
| `src/components/layout/AppHeader.vue` | Added help button + `openHelp()` function + CSS; version bump to v8.50 |
| `PLAN.md` | This section |

---

## v8.51 — Centralized emoji config (2026-03-20)

**Extracted all hardcoded emojis from components into a single config file `src/config/icons.ts`.**

### Design Rationale

Emojis were scattered across 8+ files (formatCoach.ts, DevTools.vue, HotkeyModal.vue, LLMSettings.vue, TicketHistoryPanel.vue, AppHeader.vue, useLLM.ts, i18n files). Changing a single emoji meant hunting through multiple components. A centralized `ICONS` object makes every emoji visible and editable in one place — just open `src/config/icons.ts`.

### Changes

1. **New file `src/config/icons.ts`** — typed `ICONS` constant with semantic keys (`statusPass`, `team`, `settings`, `coachPanel`, `reviewPanel`, `jiraPanel`, `devAgent`, `importArrow`, etc.)
2. **Updated 10 consumer files** — all replaced inline emojis with `ICONS.xxx` references
3. **Added panel title emojis** — Coach (`💬`), AI Review (`🔍`), JIRA Response (`📝`) panels now show emoji prefixes in their titles, all configurable from `icons.ts`
4. **Template JSON files unchanged** — these are user-editable data (exported/imported), so their emoji values stay as plain strings
5. **i18n files cleaned** — removed the inline `⚙` from error messages (the icon is now sourced from `ICONS.settings` at the call site in `useLLM.ts`)

### Modified Files
| File | Change |
|------|--------|
| `src/config/icons.ts` | **New** — centralized emoji registry |
| `src/utils/formatCoach.ts` | Replaced 5 inline emojis with ICONS refs |
| `src/components/shared/HotkeyModal.vue` | `⌨️` → `ICONS.hotkeys` |
| `src/components/panels/TicketHistoryPanel.vue` | `🎫` → `ICONS.ticketHistory` |
| `src/components/dev/DevTools.vue` | `⚡`, `💡`, `🤖` → ICONS refs |
| `src/components/settings/LLMSettings.vue` | `⬆`/`⬇`/`✏️` → ICONS refs |
| `src/components/panels/CoachPanel.vue` | Added `ICONS.coachPanel` emoji to title |
| `src/components/panels/AIReviewPanel.vue` | Added `ICONS.reviewPanel` emoji to title |
| `src/components/panels/JiraResponsePanel.vue` | Added `ICONS.jiraPanel` emoji to title |
| `src/components/layout/AppHeader.vue` | `⚙` → `ICONS.settings`; version bump to v8.51 |
| `src/composables/useLLM.ts` | `⚙` in error strings → `ICONS.settings` |
| `src/i18n/en.ts` | Removed inline `⚙` from glm401 message |
| `src/i18n/zh.ts` | Removed inline `⚙` from glm401 message |
| `PLAN.md` | This section |

---

## v8.52 — UI text & style polish (2026-03-20)

**Batch of UI text refinements, header branding update, and scrollbar sizing.**

### Design Rationale

Shortened verbose labels, added bold emphasis to DevTools summary labels for visual hierarchy, renamed panels to match their actual function, and introduced a colored logo wordmark for EN mode. Scrollbar thumb was too thin for comfortable gripping in long coach conversations.

### Changes

1. **Header branding** — EN title changed from "Agentic Engineering Platform" to colored **AGec** logo (A=red, G=yellow, ec=blue); ZH title "智能工程平台" unchanged
2. **Test/Prod toggle** — labels uppercased to **TEST** / **PROD** with bold styling
3. **Status badge** — removed "Production" / "Test Mode" text, now shows only the breathing pulse dot
4. **Left panel** — "Writing Coach Message" → **Design Coach** / 设计教练; "Task Coach ON/OFF" → **Task Skill ON/OFF** / 任务技能 开/关
5. **Right panel** — "Task Review Message" → **Task Analysis** / 任务分析; "JIRA System Response" → **JIRA Response** / JIRA 响应
6. **DevTools labels** — "View Request Payload" → **Request Payload**; "View Coach Response (Raw)" → **Coach Response**; "Webhook Configuration" → **Active Webhook**; all four summaries wrapped in `<strong>`
7. **Scrollbar** — thumb width increased from `1.5×` to `2.0×` base unit for easier gripping

### Modified Files
| File | Change |
|------|--------|
| `src/components/layout/AppHeader.vue` | Colored AGec logo, TEST/PROD bold uppercase, pulse-only status badge, version bump to v8.52 |
| `src/components/dev/DevTools.vue` | Shortened labels, bold summaries, renamed webhook key |
| `src/i18n/en.ts` | Renamed 6 labels (coach title, task coach toggle, panel titles, dev labels) |
| `src/i18n/zh.ts` | Corresponding ZH label updates |
| `src/styles/global.css` | Scrollbar width `1.5` → `2.0` multiplier |
| `PLAN.md` | This section |

---

# Domain Agent Roadmap — Cross-Team Intelligent Workstation

> Prioritized development roadmap to transform AGec from a task-creation tool into a qualified, domain-aware engineering agent for automotive/embedded cross-team workflows.

## Phase 0 — Skill Auto-Detection (v8.53) — COMPLETED (2026-03-21)

**Goal**: Auto-select the right AI skill (system prompt) based on user message content.

**Priority**: Prerequisite — provides the routing infrastructure that all subsequent phases plug into.

**Spec**: `docs/superpowers/specs/2026-03-20-skill-auto-detection-design.md`

### Design Rationale

When a user types a message in the Coach panel, the app now automatically selects the best matching skill (system prompt) from an open registry using keyword scoring. This replaces the need for manual skill switching and provides the routing layer that role-aware and domain-aware skills (Phases 1–2) will plug into. The matcher uses pure substring scanning (no tokenization), which works correctly for both English and Chinese without special handling.

### Changes

1. **Skill registry** — `SkillEntry` interface with `id`, `name`, `keywords[]`, `systemPrompt`, optional `getRawPrompt()` for built-in skills with localStorage overrides. Two built-in skills registered: `coach` and `analyze`
2. **Keyword scoring engine** — `matchSkill()` scores each skill by counting keyword substring hits; threshold >= 2 prevents single-word false positives; highest score wins, first-in-registry breaks ties
3. **useLLM.ts integration** — Coach flow runs matcher on raw user input before each request; `activeSkill` and `ignoredSkillId` as module-level refs; `clearCoachResponse()` resets both
4. **Skill chip UI** — dismissible chip above chat area in CoachPanel.vue with per-skill color (green=coach, blue=analyze, purple=ui-ux-pro-max); fade transition; dismiss sets `ignoredSkillId` (sticky until different skill matches or chat cleared)
5. **Unit tests** — 11 test cases covering: multi-keyword match, threshold enforcement, tie-break, Chinese substring matching, lang filtering, case insensitivity, empty input

### Modified Files
| File | Change |
|------|--------|
| `src/config/skills/registry.ts` | **New** — SkillEntry interface, SKILL_REGISTRY array, resolveSystemPrompt() |
| `src/utils/skillMatcher.ts` | **New** — matchSkill() keyword scoring engine |
| `src/utils/__tests__/skillMatcher.test.ts` | **New** — 11 unit tests |
| `src/composables/useLLM.ts` | Import registry + matcher; add activeSkill/ignoredSkillId refs; matcher integration in Coach getSystemPrompt; clearCoachResponse resets skill state |
| `src/components/panels/CoachPanel.vue` | Import activeSkill/ignoredSkillId; add skill chip template + dismissSkill(); chip CSS with per-skill colors + fade transition |
| `src/components/layout/AppHeader.vue` | Version bump to v8.53 |
| `PLAN.md` | This section |

## Phase 1 — Role Awareness (v9.0–v9.2)

**Goal**: The agent behaves differently based on who is using it.

**Priority**: Highest — this is the foundation for all subsequent features. Depends on Phase 0 (skill registry provides the routing layer).

### v9.0 — Role Selector & Role Context — COMPLETED (2026-03-21)

#### Design Rationale

Different engineering roles need different AI guidance. A system architect cares about requirement decomposition and ASIL allocation, while a V&V engineer cares about testability and verification methods. By injecting role context into every LLM prompt, the AI adapts its language, focus areas, and suggestions without requiring separate skill definitions per role.

The role selector uses compact short labels (SYS/SWE/HWE/V&V) in the header to minimize space usage while remaining recognizable. Role definitions are centralized in `useRole.ts` with bilingual context strings and placeholder text.

#### Changes

1. **Role composable** — `useRole.ts` with 5 roles: System Architect (SYS), SW Developer (SWE), HW Designer (HWE), Mechanics Designer (ME), V&V Engineer (V&V). Each role has: bilingual labels, LLM context string, and description placeholder. Persisted to localStorage (`user-role`), defaults to `sw-developer`
2. **Role selector in AppHeader** — toggle group with bold short labels, placed between language and URL mode toggles. Each role has a domain-specific active color: SYS=teal, SWE=green, HWE=amber, ME=slate, V&V=violet
3. **Language toggle colors** — EN=royal blue (`#2563eb`), 中文=Chinese red (`#dc2626`)
4. **Role context injection** — prepended to both Coach and Analyze system prompts, so the AI adapts focus areas per role
5. **Role-specific placeholders** — description textarea shows guidance tailored to each role (e.g., "Include: signal definitions, pin assignments..." for HW Designer)
6. **DevTools visibility** — Active Role and Active Skill displayed in Agent State section for debugging transparency

#### Modified Files
| File | Change |
|------|--------|
| `src/composables/useRole.ts` | **New** — UserRole type, 5 roles (SYS/SWE/HWE/ME/V&V), currentRole ref, setRole(), getRoleContext(), getRolePlaceholder() |
| `src/components/layout/AppHeader.vue` | Role selector with domain-specific active colors (teal/green/amber/slate/violet); language toggle colors (EN=royal blue, 中文=Chinese red); version bump to v9.0 |
| `src/composables/useLLM.ts` | Import getRoleContext; prepend role context to Coach and Analyze system prompts |
| `src/components/form/DescriptionEditor.vue` | Import getRolePlaceholder; replace static i18n placeholder with role-aware computed |
| `src/components/dev/DevTools.vue` | Added Active Role and Active Skill rows in Agent State section |
| `src/i18n/en.ts` | Added `dev.activeRole`, `dev.activeSkill` keys |
| `src/i18n/zh.ts` | Added `dev.activeRole`, `dev.activeSkill` keys |
| `PLAN.md` | This section |

### v9.1 — Role-Specific Coach Templates — COMPLETED (2026-03-21)

#### Design Rationale

Different roles need different structured templates when writing JIRA tickets. A system architect needs requirement decomposition and interface spec templates, while a V&V engineer needs test case and coverage analysis templates. By adding an optional `roles` field to `TemplateDefinition`, templates can be filtered per role while keeping common templates (AC, Bug, Change Request, Optimize) visible to all.

#### Changes

1. **TemplateDefinition extended** — added optional `roles?: UserRole[]` field; omit = shown for all roles
2. **10 role-specific templates** created:
   - **SYS**: Req Decompose (`sysDecomposition`), Interface Spec (`sysInterface`)
   - **SWE**: Acceptance Criteria (`sweAcceptance`), API Contract (`sweApiContract`)
   - **HWE**: HW/SW Interface (`hweInterface`), Resource Budget (`hweResource`)
   - **ME**: Packaging Design (`mePackaging`), Thermal Mgmt (`meThermal`)
   - **V&V**: Test Case (`vvTestCase`), Coverage Analysis (`vvCoverage`)
3. **Role-filtered computed** — `roleFilteredTemplates` filters by `currentRole`; CoachPanel uses this instead of `effectiveTemplates`
4. **Common templates unchanged** — AC Template, Optimize, Bug Template, Change Req remain visible to all roles

#### Modified Files
| File | Change |
|------|--------|
| `src/types/template.ts` | Added optional `roles?: UserRole[]` field |
| `src/config/templates/sys-decomposition.json` | **New** — system requirement decomposition template |
| `src/config/templates/sys-interface.json` | **New** — interface specification template |
| `src/config/templates/swe-acceptance.json` | **New** — SW acceptance criteria template |
| `src/config/templates/swe-api-contract.json` | **New** — API contract definition template |
| `src/config/templates/hwe-interface.json` | **New** — HW/SW interface spec template |
| `src/config/templates/hwe-resource.json` | **New** — ECU resource budget template |
| `src/config/templates/me-packaging.json` | **New** — mechanical packaging design template |
| `src/config/templates/me-thermal.json` | **New** — thermal management template |
| `src/config/templates/vv-test-case.json` | **New** — test case template with verification methods |
| `src/config/templates/vv-coverage.json` | **New** — test coverage analysis template |
| `src/config/templates/index.ts` | Register 10 new templates; add `roleFilteredTemplates` computed |
| `src/components/panels/CoachPanel.vue` | Use `roleFilteredTemplates` instead of `effectiveTemplates` |
| `src/components/layout/AppHeader.vue` | Version bump to v9.1 |
| `PLAN.md` | This section |

### v9.2 — Role-Specific Quality Scoring — COMPLETED (2026-03-21)

#### Design Rationale

A system architect cares most about complete, traceable requirements with thorough descriptions, while a software developer cares about structured acceptance criteria and clear task details. By applying different weight distributions per role, the quality score bar reflects what matters most to each discipline — incentivizing role-appropriate completeness.

#### Weight Distribution

| Field | SYS | SWE | HWE | ME | V&V |
|-------|-----|-----|-----|-----|-----|
| projectKey | 6 | 8 | 6 | 6 | 6 |
| issueType | 6 | 8 | 6 | 6 | 6 |
| assignee | 4 | 8 | 6 | 6 | 4 |
| estimatedPoints | 2 | 6 | 4 | 4 | 2 |
| vehicle–detail | 8×5=40 | 6+6+6+8+12=38 | 8+8+8+10+10=44 | 8+8+8+10+10=44 | 6+6+6+6+8=32 |
| descPresent | 14 | 12 | 12 | 12 | 16 |
| descLength | 28 | 20 | 22 | 22 | 34 |
| **Total** | **100** | **100** | **100** | **100** | **100** |

- **SYS/V&V**: description-dominant (42/50 pts) — thorough documentation matters most
- **SWE**: balanced — detail and acceptance criteria emphasized
- **HWE/ME**: component-heavy — hardware specs and constraints need structure

#### Changes

1. **Role-aware weights** — `ROLE_WEIGHTS` record in `useForm.ts` maps each `UserRole` to its weight distribution
2. **Quality score computed** — reads `currentRole` reactively; score updates instantly when role changes
3. **Test updated** — `useForm.test.ts` mocks `useRole` and adjusts expected values for `sw-developer` weights

#### Modified Files
| File | Change |
|------|--------|
| `src/composables/useForm.ts` | Import `currentRole`; replace hardcoded weights with `ROLE_WEIGHTS` record |
| `src/composables/__tests__/useForm.test.ts` | Mock `useRole`; update description bonus test expectation |
| `src/components/layout/AppHeader.vue` | Version bump to v9.2 |
| `PLAN.md` | This section |

---

## Phase 2 — Domain Knowledge (v9.3–v9.5)

**Goal**: The agent understands automotive engineering standards and vocabulary.

**Priority**: High — without this, the AI gives generic software advice instead of domain-specific guidance.

### v9.3 — Domain Vocabulary & Prompt Engineering

- Create `src/config/domain/` directory with:
  - `vocabulary.ts` — standard terms (ECU, ASIL, FMEA, HIL/SIL, CAN/LIN, calibration, diagnostic)
  - `standards.ts` — key rules from ISO 26262, ASPICE, ISO 21434 (SOTIF) as structured data
- Inject domain context into LLM system prompts so the AI uses correct terminology
- Add domain-specific validation warnings (e.g., missing ASIL level, no safety relevance tag)

### v9.4 — ASPICE Process Awareness

- Map JIRA ticket types to ASPICE work products:
  - System requirement → SYS.2
  - SW requirement → SWE.1
  - Test case → SWE.4 / SWE.5
  - Change request → SUP.10
- Auto-suggest required fields per ASPICE practice
- Show ASPICE process badge on tickets

### v9.5 — Requirement Quality Rules (INCOSE)

- Implement INCOSE requirement quality checks in the quality scoring engine:
  - **Atomic**: one requirement per statement
  - **Complete**: no TBD, TBC, or undefined terms
  - **Unambiguous**: flag vague words (appropriate, sufficient, some, etc.)
  - **Verifiable**: must have measurable acceptance criteria
  - **Traceable**: must reference parent requirement or source
- Show specific violations, not just a score

---

## Phase 3 — Guided Elicitation (v9.6–v9.8)

**Goal**: The agent helps users think, not just review what they wrote.

**Priority**: High — this is the "deep-interview" concept adapted for engineering.

### v9.6 — Elicitation Mode (Coach Panel)

- Add a new Coach mode: **Elicitation** (alongside existing Coach/Analyze)
- When activated, the AI asks structured questions before the user writes anything:
  - "What system-level function does this requirement support?"
  - "What happens if this requirement is not met? (safety impact)"
  - "How will you verify this? (test / analysis / review / demonstration)"
  - "Are there timing or performance constraints?"
- Questions adapt based on selected role (Phase 1)

### v9.7 — Assumption Detector

- After description is entered, AI scans for hidden assumptions:
  - Implicit hardware constraints
  - Undeclared dependencies on other components
  - Missing environmental conditions (temperature, voltage, etc.)
- Shows assumptions as warnings with suggested rewrites

### v9.8 — Conflict Checker (Multi-Requirement)

- Allow pasting or referencing multiple requirements
- AI detects contradictions:
  - Conflicting timing constraints
  - Incompatible interface definitions
  - Redundant requirements from different teams
- Show conflict pairs with explanation

---

## Phase 4 — Traceability (v10.0–v10.2)

**Goal**: Requirements are linked across levels, not isolated tickets.

**Priority**: Medium — important for ASPICE compliance, but depends on Phases 1–3.

### v10.0 — Requirement Hierarchy Model

- Define requirement levels in `types/`:
  - Stakeholder Requirement → System Requirement → SW/HW Requirement → Test Case
- Add parent/child link fields to the form
- Store hierarchy in ticket metadata (JIRA custom fields or labels)

### v10.1 — Traceability Suggestions

- When creating a SW requirement, AI suggests:
  - Likely parent system requirement (from recent tickets or context)
  - Required downstream artifacts (test cases, design specs)
- Show traceability gaps: "This requirement has no parent" / "No verification method linked"

### v10.2 — Impact Analysis

- "What if this requirement changes?" analysis:
  - List dependent requirements, test cases, and design documents
  - Highlight cross-team impact (e.g., HW change affects SW interface)
- Requires JIRA API read access (query linked issues)

---

## Phase 5 — Multi-Agent Review Pipeline (v10.3–v10.5)

**Goal**: Multiple AI perspectives review a requirement before submission.

**Priority**: Medium — high value for cross-team quality, but needs Phases 1–2 first.

### v10.3 — Multi-Perspective Analysis

- Single "Deep Review" button triggers parallel analysis from multiple viewpoints:
  - **Safety**: ISO 26262 compliance, ASIL consistency
  - **Testability**: Can V&V write a test for this?
  - **Implementability**: Is this feasible for SW/HW teams?
  - **Completeness**: Missing fields, undefined terms, TBDs
- Show results in tabbed or accordion view in AIReviewPanel

### v10.4 — Cross-Team Review Workflow

- After AI review, route ticket for human review:
  - Architect creates → Developer reviews feasibility → V&V reviews testability
  - Each reviewer sees role-specific checklist
- Status tracking: Draft → AI Reviewed → Peer Reviewed → Approved → JIRA Created

### v10.5 — Review History & Learning

- Store review feedback per ticket
- AI learns from accepted/rejected patterns to improve future suggestions
- Team-level quality dashboard (acceptance rate, common issues)

---

## Phase 6 — Integration & Export (v10.6–v10.8)

**Goal**: The workstation connects to the broader tool chain.

**Priority**: Lower — valuable but not blocking core intelligence features.

### v10.6 — JIRA Read Integration

- Query existing JIRA tickets for:
  - Duplicate detection before creation
  - Parent requirement lookup (for traceability)
  - Sprint/release context awareness

### v10.7 — Export Formats

- Export requirements in:
  - ReqIF (for DOORS/Polarion interop)
  - Structured Excel (for legacy workflows)
  - Markdown (for documentation)

### v10.8 — Batch Operations

- Create multiple related requirements at once (e.g., system req + derived SW reqs + test cases)
- Bulk quality analysis on pasted requirement sets
- Import from Excel/CSV for migration workflows

---

## Summary — Priority Matrix

| Phase | Versions | Effort | Impact | Depends On |
|-------|----------|--------|--------|------------|
| 0. Skill Auto-Detection | v8.53 | Low | High | Nothing (spec ready) |
| 1. Role Awareness | v9.0–v9.2 | Low | High | Phase 0 |
| 2. Domain Knowledge | v9.3–v9.5 | Medium | High | Phase 1 |
| 3. Guided Elicitation | v9.6–v9.8 | Medium | Very High | Phase 1 + 2 |
| 4. Traceability | v10.0–v10.2 | Medium-High | High | Phase 1–3 |
| 5. Multi-Agent Review | v10.3–v10.5 | High | Very High | Phase 1–2 |
| 6. Integration & Export | v10.6–v10.8 | High | Medium | Phase 4 |

**Start with Phase 0** (skill auto-detection, spec already approved) — then Phase 1 builds role awareness on top of the routing layer.

---

## v9.3 — Domain Vocabulary & Prompt Engineering

**Design rationale**: Without domain knowledge, the AI gives generic software advice. By injecting automotive vocabulary (ASIL, FMEA, CAN, AUTOSAR, etc.) and standard rules (ISO 26262, ASPICE, ISO 21434) into LLM system prompts, the AI uses correct terminology and references applicable standards per role.

**Changes**:
1. Created `src/config/domain/` directory with structured domain data
2. `vocabulary.ts` — 30+ automotive engineering terms with role-based filtering (ECU, ASIL, CAN/LIN, AUTOSAR, HIL/SIL, UDS, EMC, DFM, etc.)
3. `standards.ts` — 7 standard rule sets from ISO 26262, ASPICE, ISO 21448, ISO 21434 with bilingual descriptions
4. `index.ts` — `buildDomainContext()` generates role-specific domain context for LLM system prompts; `checkDomainWarnings()` runs validation rules on description text
5. Domain context injected into both Coach and Analyze LLM system prompts (useLLM.ts)
6. 5 domain validation warning rules: missing ASIL level, missing verification method, missing traceability, missing interface specs, missing thermal/IP rating
7. Warnings displayed below description textarea with animated transitions

| File | Change |
|------|--------|
| `src/config/domain/vocabulary.ts` | New — 30+ domain terms, role-filtered |
| `src/config/domain/standards.ts` | New — ISO/ASPICE standard rules |
| `src/config/domain/index.ts` | New — domain context builder + validation warnings |
| `src/composables/useLLM.ts` | Inject `buildDomainContext()` into coach + analyze system prompts |
| `src/composables/useForm.ts` | Export `domainWarnings` computed |
| `src/components/form/DescriptionEditor.vue` | Display domain warnings below textarea |
| `src/components/form/TaskForm.vue` | Pass domain warnings prop |
| `src/App.vue` | Wire `domainWarnings` through component tree |
| `src/components/layout/AppHeader.vue` | Version bump v9.2 → v9.3 |

---

## v9.4 — ASPICE Process Awareness

**Design rationale**: Engineers working in ASPICE-compliant organizations need to know which work product they're creating and what fields are required. By mapping (role + issue type) → ASPICE process area, the tool auto-suggests required fields and shows an ASPICE process badge (e.g., "SWE.1", "SYS.2") in the quality meter.

**Changes**:
1. `aspice.ts` — ASPICE mapping table: 11 entries covering all 5 roles × 3 issue types (Story/Task/Bug), mapping to process areas (SYS.2, SYS.3, SWE.1, SWE.3, SWE.4, SWE.5, SUP.9, SUP.10)
2. Each mapping includes field suggestions (required/optional) specific to the ASPICE practice area
3. ASPICE process badge displayed in QualityMeter header (blue pill badge)
4. ASPICE field suggestions shown as tag chips below description textarea, with required fields highlighted in orange

| File | Change |
|------|--------|
| `src/config/domain/aspice.ts` | New — ASPICE process mapping + field suggestions |
| `src/config/domain/index.ts` | Export ASPICE types |
| `src/composables/useForm.ts` | Export `aspiceProfile` computed |
| `src/components/form/QualityMeter.vue` | Add optional `aspiceBadge` prop + badge styling |
| `src/components/form/SummaryBuilder.vue` | Pass `aspiceBadge` to QualityMeter |
| `src/components/form/DescriptionEditor.vue` | Display ASPICE field suggestions |
| `src/components/form/TaskForm.vue` | Pass aspice props |
| `src/App.vue` | Wire `aspiceBadge` + `aspiceSuggestions` |
| `src/components/layout/AppHeader.vue` | Version bump v9.3 → v9.4 |

---

## v9.5 — INCOSE Requirement Quality Rules

**Design rationale**: The quality score was purely field-presence-based. INCOSE rules add content-level quality analysis, checking whether the requirement text itself meets engineering quality standards. This makes the quality score more meaningful and gives engineers specific, actionable feedback.

**Changes**:
1. `incose.ts` — 5 INCOSE requirement quality checks:
   - **Atomic**: Detects multiple requirements in one statement (conjunction patterns, multiple shall/must)
   - **Complete**: Finds TBD, TBC, TODO, undefined markers
   - **Unambiguous**: Flags 40+ vague terms in EN/ZH (appropriate, sufficient, some, etc.)
   - **Verifiable**: Checks for measurable criteria (numbers + units, comparison operators)
   - **Traceable**: Looks for requirement IDs or source references
2. INCOSE violations displayed as tagged items below ASPICE suggestions (red tag for errors, orange for warnings)
3. Quality score penalty: -5 per error, -3 per warning, max -15 total
4. All checks work in both Chinese and English text

| File | Change |
|------|--------|
| `src/config/domain/incose.ts` | New — 5 INCOSE quality checks + score penalty |
| `src/config/domain/index.ts` | Export INCOSE types |
| `src/composables/useForm.ts` | Export `incoseViolations`, apply penalty to `qualityScore` |
| `src/components/form/DescriptionEditor.vue` | Display INCOSE violations with severity tags |
| `src/components/form/TaskForm.vue` | Pass incose props |
| `src/App.vue` | Wire `incoseViolations` |
| `src/components/layout/AppHeader.vue` | Version bump v9.4 → v9.5 |

---

## v9.6 — Elicitation Mode (Coach Panel)

**Design rationale**: The AI was only reviewing what users wrote. Elicitation mode flips this — the AI asks structured questions first, helping users think through their requirements before writing. Questions adapt based on the active role, using domain knowledge from Phase 2.

**Changes**:
1. `elicitation.ts` — 4 common questions + 4 role-specific questions per role (8 total per session)
   - Common: system function, safety impact, verification method, timing constraints
   - SYS: subsystem scope, ASIL decomposition, interfaces, environment
   - SWE: I/O specs, error scenarios, acceptance criteria, API contracts
   - HWE: electrical specs, protocols, resources, diagnostic coverage
   - ME: packaging, thermal, IP rating, vibration/shock
   - V&V: verification method, test environment, pass/fail criteria, preconditions
2. `buildElicitationPrompt()` generates a full LLM prompt instructing one-question-at-a-time interview style
3. Purple gradient "Requirement Elicitation" chip in CoachPanel empty state
4. On click: switches to free-chat mode and sends the elicitation prompt, starting an interactive Q&A session
5. i18n keys added for both languages

| File | Change |
|------|--------|
| `src/config/domain/elicitation.ts` | New — role-adaptive elicitation questions + prompt builder |
| `src/config/domain/index.ts` | Export elicitation types |
| `src/components/panels/CoachPanel.vue` | Add elicitation chip + `elicit` emit |
| `src/App.vue` | Handle `@elicit` event, switch to free-chat, trigger coach |
| `src/i18n/en.ts`, `zh.ts` | Add `elicitation.*` keys |
| `src/components/layout/AppHeader.vue` | Version bump v9.5 → v9.6 |

---

## v9.7 — Assumption Detector

**Design rationale**: Engineers often write requirements with implicit assumptions about hardware constraints, timing, dependencies, and environmental conditions. The assumption detector scans descriptions in real-time and surfaces these hidden assumptions with specific rewrite suggestions.

**Changes**:
1. `assumptions.ts` — 8 assumption detection rules:
   - **Resource**: memory structures without memory budget
   - **Timing**: timing behavior without specific constraints
   - **Concurrency**: concurrent execution without thread safety specs
   - **Communication**: data transfer without protocol specification
   - **Power**: power states without voltage/consumption specs
   - **Temperature**: thermal references without temperature range
   - **Dependency**: implicit dependencies without explicit requirement IDs
   - **Configuration**: configurable parameters without default values/ranges
2. Each assumption includes: category tag, detection message, and suggested rewrite
3. Assumptions displayed with purple category tags below INCOSE violations in DescriptionEditor
4. Role-filtered — only relevant assumption types shown per role

| File | Change |
|------|--------|
| `src/config/domain/assumptions.ts` | New — 8 assumption detection rules with suggestions |
| `src/config/domain/index.ts` | Export assumption types |
| `src/composables/useForm.ts` | Export `assumptions` computed |
| `src/components/form/DescriptionEditor.vue` | Display assumptions with category tags + suggestions |
| `src/components/form/TaskForm.vue` | Pass assumptions prop |
| `src/App.vue` | Wire `assumptions` |
| `src/components/layout/AppHeader.vue` | Version bump v9.6 → v9.7 |

---

## v9.8 — Conflict Checker (Multi-Requirement)

**Design rationale**: In multi-team automotive projects, requirements from different disciplines often conflict. The Conflict Checker allows pasting multiple requirements and having the AI detect contradictions — timing conflicts, interface incompatibilities, resource budget overruns, behavioral contradictions, redundancies, and safety-level mismatches.

**Changes**:
1. `conflicts.ts` — builds role-specific conflict-analysis system prompt covering 6 conflict types:
   - Timing conflicts, Interface conflicts, Resource conflicts
   - Behavioral conflicts, Redundant requirements, Safety conflicts
   - Role-specific focus areas (SYS: ASIL consistency; SWE: API contracts; HWE: pin assignments; ME: packaging; V&V: test coverage)
2. Orange-red gradient "Conflict Check" chip in CoachPanel (alongside Elicitation)
3. On click: prepends conflict-analysis instruction to description text, switches to free-chat mode, sends to coach
4. Both chips now in a `guided-chips` flex container for clean 50/50 layout
5. i18n keys for both languages

| File | Change |
|------|--------|
| `src/config/domain/conflicts.ts` | New — role-specific conflict analysis prompt builder |
| `src/config/domain/index.ts` | Export conflict check types |
| `src/components/panels/CoachPanel.vue` | Add conflict-check chip, `guided-chips` layout |
| `src/App.vue` | Handle `@conflict-check` event |
| `src/i18n/en.ts`, `zh.ts` | Add `conflictCheck.*` keys |
| `src/components/layout/AppHeader.vue` | Version bump v9.7 → v9.8 |

---

## Phase 4 — Traceability (v10.0–v10.2)

### v10.0 — Requirement Hierarchy Model

**Design rationale**: ASPICE-compliant projects require a clear requirement hierarchy: Stakeholder → System → SW/HW/ME → Detailed Design → Test Case. Each level maps to an ASPICE process area and has defined parent/child relationships. This model enables traceability gap detection and contextual LLM prompts.

**Changes**:
1. `traceability.ts` — defines `RequirementLevel` type (7 levels + 'none'), `RequirementLevelDef` interface with parent/child relationships, ASPICE mapping, role filtering
2. Gap detection: `checkTraceabilityGaps()` warns on missing parent, missing verification method, orphan test cases
3. LLM context: `buildTraceabilityContext()` injects traceability info into system prompts
4. `TraceabilitySection.vue` — 3-column grid: Requirement Level select, Parent Requirement input, Verification Method select; gap warnings below
5. Form state extended with `requirementLevel`, `parentReqId`, `verificationMethod`; auto-default on role change
6. Quality score now applies INCOSE penalty (max -15 pts)

| File | Change |
|------|--------|
| `src/config/domain/traceability.ts` | New — hierarchy model, gap detection, context builder |
| `src/config/domain/index.ts` | Export traceability types and functions |
| `src/components/form/TraceabilitySection.vue` | New — traceability UI section |
| `src/components/form/TaskForm.vue` | Add TraceabilitySection between SummaryBuilder and DescriptionEditor |
| `src/composables/useForm.ts` | Add traceability form fields, computeds, role watcher |
| `src/composables/useLLM.ts` | Inject traceability context into system prompts |
| `src/types/form.ts` | Extend FormState with traceability fields |
| `src/types/api.ts` | Extend WebhookPayload with traceability data |
| `src/i18n/en.ts`, `zh.ts` | Add `traceability.*` keys |
| `src/App.vue` | Wire traceability props and events |
| `src/components/layout/AppHeader.vue` | Version bump v9.8 → v10.0 |

### v10.1 — Traceability Suggestions

**Design rationale**: Engineers often don't know what parent requirement to link or what downstream artifacts are needed. The AI-powered "Suggest Links" button analyzes the current requirement and suggests parent requirements, downstream work products, and traceability completeness checks.

**Changes**:
1. `trace-suggest.ts` — `buildTraceSuggestPrompt()` generates bilingual prompt with 3 sections: parent requirement suggestion, downstream artifact suggestion, traceability completeness check
2. "Suggest Links" button in TraceabilitySection (visible when level != 'none')
3. On click: builds trace-suggest prompt with current context, switches to free-chat mode, sends to coach

| File | Change |
|------|--------|
| `src/config/domain/trace-suggest.ts` | New — traceability suggestion prompt builder |
| `src/config/domain/index.ts` | Export `buildTraceSuggestPrompt` |
| `src/components/form/TraceabilitySection.vue` | Add "Suggest Links" button |
| `src/App.vue` | Handle `@suggest-links`, import prompt builder |
| `src/i18n/en.ts`, `zh.ts` | Add `suggestBtn`, `suggestHint` keys |
| `src/components/layout/AppHeader.vue` | Version bump v10.0 → v10.1 |

### v10.2 — Impact Analysis

**Design rationale**: When a requirement changes, engineers need to understand the ripple effect: which upstream/downstream requirements, test cases, design documents, and cross-team deliverables are affected. The "Impact Analysis" button triggers an AI analysis covering 6 dimensions: upstream impact, downstream impact, test impact, cross-team impact (role-specific), safety & compliance impact, and a summary table.

**Changes**:
1. `trace-impact.ts` — `buildImpactAnalysisPrompt()` generates bilingual prompt with role-specific cross-team impact sections:
   - SYS: impact on SWE/HWE/ME teams, interface re-negotiation
   - SWE: HW interface (CAN/LIN/SPI), system integration
   - HWE: SW driver layer (BSW/MCAL), PCB/schematic sync
   - ME: PCB mounting space, thermal/IP rating
   - V&V: test equipment, other teams' verification plans
2. Orange "Impact Analysis" button in TraceabilitySection (alongside Suggest Links)
3. On click: prepends impact analysis instruction to description, appends structured prompt, switches to free-chat mode, sends to coach
4. Summary table format requested from LLM: Impact Dimension | Scope | Severity | Recommended Action

| File | Change |
|------|--------|
| `src/config/domain/trace-impact.ts` | New — impact analysis prompt builder with role-specific cross-team sections |
| `src/config/domain/index.ts` | Export `buildImpactAnalysisPrompt` |
| `src/components/form/TraceabilitySection.vue` | Add "Impact Analysis" button, flex layout for actions |
| `src/components/form/TaskForm.vue` | Forward `@impact-analysis` emit |
| `src/App.vue` | Handle `@impact-analysis`, import prompt builder |
| `src/i18n/en.ts`, `zh.ts` | Add `impactBtn`, `impactHint` keys |
| `src/components/layout/AppHeader.vue` | Version bump v10.1 → v10.2 |

---

## Phase 5 Changelog — Multi-Agent Review Pipeline

### v10.3 — Multi-Perspective Analysis (Deep Review)

**Design rationale**: A single "Analyze" button gives one viewpoint. For cross-team quality, engineers need the requirement examined from multiple perspectives simultaneously — Safety (ISO 26262), Testability (can V&V write a test?), Implementability (is this feasible?), and Completeness (are there gaps?). The "Deep Review" button triggers a single LLM call with a structured multi-perspective system prompt. The response is parsed by `## ` headers into tabbed sections in the AIReviewPanel, allowing engineers to focus on one perspective at a time or view all at once.

**Changes**:
1. `review-perspectives.ts` — defines 4 review perspectives with role-specific guidance:
   - Safety: ISO 26262, ASIL consistency, FMEA/FTA, role-specific safety checks
   - Testability: acceptance criteria, test environments (HIL/SIL/MIL), vague terms
   - Implementability: technical feasibility, resource constraints, architectural changes, role-specific (AUTOSAR, PCB, tooling)
   - Completeness: TBD/TBC, undefined terms, interface definitions, traceability chain
   - Summary table with ✅/⚠️/❌ ratings
2. `buildDeepReviewPrompt()` — bilingual prompt forcing LLM to output under exactly 4 `## ` headings
3. Purple "Deep Review" button (shield icon) in TaskForm action bar, between Analyze and Create
4. `useLLM.ts` — `isDeepReview` flag + `requestDeepReview()` that temporarily overrides the analyze system prompt with the multi-perspective prompt, then delegates to the existing analyze stream flow
5. `AIReviewPanel.vue` — perspective tab bar: parses `<h2>` headers from formatted HTML, creates clickable tabs (All | Safety | Testability | Implementability | Completeness), filters displayed content per active tab
6. `_config` exposed from `createStreamFlow` to allow prompt override

| File | Change |
|------|--------|
| `src/config/domain/review-perspectives.ts` | New — 4 review perspectives + bilingual deep review prompt builder |
| `src/config/domain/index.ts` | Export review-perspectives module |
| `src/composables/useLLM.ts` | Add `isDeepReview` flag, `requestDeepReview()`, expose `_config` |
| `src/components/panels/AIReviewPanel.vue` | Add perspective tab bar, section parsing, filtered rendering |
| `src/components/form/TaskForm.vue` | Add "Deep Review" button (purple, shield icon), emit, CSS |
| `src/App.vue` | Wire `@deep-review` handler, pass `isDeepReview` prop |
| `src/types/api.ts` | Add `'deepReview'` to action union type |
| `src/i18n/en.ts`, `zh.ts` | Add `deepReview`, perspective tab keys |
| `src/components/layout/AppHeader.vue` | Version bump v10.2 → v10.3 |

### v10.4 — Cross-Team Review Workflow

**Design rationale**: Quality requirements demand a structured review process before JIRA creation. The review workflow tracks a requirement through 5 stages: Draft → AI Reviewed → Peer Reviewed → Approved → JIRA Created. After AI analysis (Analyze or Deep Review), the workflow auto-advances to "AI Reviewed" and presents a role-specific peer review checklist. Each role has 6 checklist items (3 common + 3 role-specific). When all items are checked, an "Approve" button advances to "Approved" status. JIRA creation auto-advances to final state. Reset clears the workflow.

**Changes**:
1. `review-workflow.ts` — defines `ReviewStatus` type (5 stages), `REVIEW_STEPS` with bilingual labels and colors, `getReviewChecklist(role)` returning role-specific items:
   - Common: no TBD, traceable, unambiguous
   - SYS: decomposed, safety concept, interfaces
   - SWE: feasible, CPU/RAM, test approach
   - HWE: feasible, component availability, EMC/thermal
   - ME: space, material/process, IP rating
   - V&V: verifiable, quantitative criteria, test environment
2. `useReviewWorkflow.ts` — composable with reactive review state, checklist toggle, progress tracking, advance/reset functions
3. `ReviewStatusBar.vue` — visual 5-step pipeline with dot/line indicators, peer review checklist with checkboxes and progress %, approve button (appears when 100%)
4. Auto-advancement: Analyze/Deep Review success → `ai-reviewed`, JIRA creation → `jira-created`, Reset → `draft`
5. Checklist auto-adapts to current role via `useRole`

| File | Change |
|------|--------|
| `src/config/domain/review-workflow.ts` | New — review status types, steps, role-specific checklists |
| `src/config/domain/index.ts` | Export review-workflow types and functions |
| `src/composables/useReviewWorkflow.ts` | New — reactive review workflow state management |
| `src/components/form/ReviewStatusBar.vue` | New — step pipeline + checklist UI |
| `src/components/form/TaskForm.vue` | Add ReviewStatusBar, review workflow props/emits |
| `src/App.vue` | Wire review workflow, auto-advance on analyze/create, reset on form reset |
| `src/components/layout/AppHeader.vue` | Version bump v10.3 → v10.4 |

### v10.5 — Review History & Learning

**Design rationale**: To close the quality feedback loop, the system records review outcomes (checklist pass/fail, quality score, review status) per JIRA ticket. Over time, this data reveals common issues — e.g., "missing traceability" fails 70% of reviews. The system injects these patterns into LLM prompts as "Historical Review Patterns", so the AI pays extra attention to recurring problems. A compact Quality Dashboard shows approval rate, average score, and top failed checklist items.

**Changes**:
1. `useReviewHistory.ts` — composable storing up to 100 `ReviewRecord` entries in localStorage:
   - Each record captures: ticketKey, summary, role, issueType, qualityScore, reviewStatus, checklistPassed/Failed
   - `stats` computed: total, approved count, approval rate, avg quality score, top 5 failed checklist items
   - `buildLearningContext(lang)` — generates bilingual context string for LLM injection (only when ≥3 records exist)
2. `ReviewDashboard.vue` — compact panel with 3-column stats grid (Reviews, Approval %, Avg Score) + horizontal bar chart of common issues
3. Learning context injected into both Analyze and Deep Review system prompts via `buildLearningContext()`
4. Review record auto-created on JIRA creation success (captures current checklist state and quality score)
5. Dashboard placed in right column above TicketHistoryPanel, auto-hidden when no records

| File | Change |
|------|--------|
| `src/composables/useReviewHistory.ts` | New — review history storage, stats, learning context builder |
| `src/components/panels/ReviewDashboard.vue` | New — quality dashboard with stats and common issues |
| `src/composables/useLLM.ts` | Inject `buildLearningContext()` into analyze + deep review system prompts |
| `src/App.vue` | Import review history, record on JIRA creation, render ReviewDashboard |
| `src/components/layout/AppHeader.vue` | Version bump v10.4 → v10.5 |

---

## Phase 6 Changelog — Integration & Export

### v10.6 — JIRA Read Integration

**Design rationale**: Before creating a JIRA ticket, engineers need to know if a duplicate already exists, which parent requirements are available for traceability linking, and what sprint/release context applies. The JIRA Read Integration sends `search` action payloads to the existing n8n webhook, which can query JIRA's REST API and return matching tickets. Results include similarity scoring for duplicate detection, and clicking a result auto-fills it as the parent requirement.

**Changes**:
1. `useJiraSearch.ts` — composable with 3 search modes:
   - `checkDuplicates(projectKey, summary)` — finds tickets with similar summaries, flags >70% similarity
   - `searchParentReqs(projectKey, query)` — finds potential parent requirements
   - `getSprintContext(projectKey)` — retrieves active sprint and release info
2. `JiraSearchPanel.vue` — compact panel with search input, 3 quick-action buttons (Duplicates, Parent Reqs, Sprint), results list with key/status/similarity badges, duplicate warning banner
3. Clicking a search result auto-fills `parentReqId` in the form
4. Auto-triggers duplicate check when opening the JIRA creation confirmation modal
5. `WebhookPayload.data` extended with `search_query`, `search_type`
6. `JiraSearchResult` and `JiraSearchResponse` types added

| File | Change |
|------|--------|
| `src/composables/useJiraSearch.ts` | New — JIRA search via webhook (duplicate, parent, sprint) |
| `src/components/panels/JiraSearchPanel.vue` | New — search UI with results, duplicate warnings |
| `src/types/api.ts` | Add `'search'` action, `JiraSearchResult`, `JiraSearchResponse`, search fields |
| `src/App.vue` | Wire JiraSearchPanel, auto-duplicate check on create, search result → parent req |
| `src/components/layout/AppHeader.vue` | Version bump v10.5 → v10.6 |

### v10.7 — Export Formats

**Design rationale**: Engineers need to share requirements with teams using different tools — DOORS/Polarion (ReqIF), Excel (legacy workflows), and documentation (Markdown). The export module produces all three formats from the current form state, including traceability metadata, quality score, and review status.

**Changes**:
1. `exportFormats.ts` — three export functions + download helper:
   - `exportMarkdown()` — structured doc with tables, traceability section, description
   - `exportReqIF()` — OMG ReqIF XML with datatypes, spec-types, attributes (summary, description, level, parent, verification, quality score)
   - `exportExcelCSV()` — 18-column CSV with all form fields, traceability, and metadata
   - `downloadFile()` — creates Blob, triggers browser download
2. Export dropdown button (download icon) in TaskForm action bar — opens popup menu with 3 format choices
3. Each format triggers download with toast notification

| File | Change |
|------|--------|
| `src/utils/exportFormats.ts` | New — Markdown, ReqIF, Excel CSV export + download helper |
| `src/components/form/TaskForm.vue` | Add export dropdown button/menu, emits, CSS |
| `src/App.vue` | Wire export handlers, `buildExportData()`, download with toast |
| `src/components/layout/AppHeader.vue` | Version bump v10.6 → v10.7 |

### v10.8 — Batch Operations

**Design rationale**: Production teams frequently need to process multiple requirements at once — importing from spreadsheets, decomposing system requirements into sub-levels, and performing bulk quality assessments. The batch operations module provides CSV import/parse, requirement decomposition, and bulk quality scoring with a dedicated panel UI.

**Changes**:
1. `useBatchOps.ts` — composable with batch requirement management:
   - `BatchRequirement` interface (id, summary, description, level, parentReqId, issueType, qualityScore, selected)
   - `addItem()` — auto-computes quality score using INCOSE rules + base scoring
   - `importCSV()` — parses CSV text with quoted field support, maps Summary/Description/Type/Level/Parent columns (bilingual headers)
   - `decompose()` — generates child requirements at target hierarchy levels from a parent
   - localStorage persistence with `batch-requirements` key
2. `BatchPanel.vue` — UI component:
   - Import area: CSV paste textarea + file upload button, collapsible with transition
   - Batch items list: checkboxes, level badges, issue type, quality score (color-coded), summary/description preview
   - Toolbar: select all, selected count, bulk analyze button
   - Individual item removal
3. App.vue wiring:
   - `handleAddCurrentToBatch()` — snapshots current form state into batch list
   - `handleBatchImportCSV()` — imports CSV with count toast
   - `handleBulkAnalyze()` — loads first selected batch item into form and triggers analyze
   - BatchPanel rendered in right column between JiraSearchPanel and ReviewDashboard

| File | Change |
|------|--------|
| `src/composables/useBatchOps.ts` | New — batch requirement CRUD, CSV import, decompose, localStorage |
| `src/components/panels/BatchPanel.vue` | New — batch UI with import, list, toolbar, bulk actions |
| `src/App.vue` | Wire BatchPanel, add batch handlers (add current, import, bulk analyze) |
| `src/components/layout/AppHeader.vue` | Version bump v10.7 → v10.8 |

### v10.9 — Complete Architecture Diagram

**Design rationale**: The interactive architecture diagram (`docs/architecture.html`) was missing 7 Vue components and 1 config module that exist in the codebase. This made the diagram incomplete — the stats bar claimed 32 components but only 25 nodes were rendered. Updated the diagram to show the full picture of all files in the workstation.

**Changes**:
1. Added 7 missing Vue component nodes to the diagram:
   - `AssigneeCombobox` — fuzzy team member search (child of BasicInfoSection)
   - `StoryPointsPicker` — Fibonacci point selector (child of BasicInfoSection)
   - `DownloadModal` — coach history export format picker (child of CoachHistoryTab)
   - `ConfirmDialog` — reusable yes/no confirmation modal (child of CoachHistoryTab)
   - `JsonNode` — recursive JSON tree child (child of JsonViewer)
   - `StatusDot` — state indicator with pulse animation (child of PanelShell)
   - `HotkeyModal` — keyboard shortcuts reference (rendered by App.vue)
2. Added 1 missing config module node:
   - `skills/registry.ts` — built-in skill definitions with metadata and keywords
3. Added 15 new dependency edges connecting the new nodes to their parents, composables, and config modules
4. Updated legend and stats bar to reflect accurate counts (8 Config Modules)

| File | Change |
|------|--------|
| `docs/architecture.html` | Add 8 missing nodes, 15 edges, update counts and version to v10.9 |
| `src/components/layout/AppHeader.vue` | Version bump v10.8 → v10.9 |

### v10.10 — Initial State Hardening & Manual Test Corrections

**Design rationale**: Manual test-walk (2026-03-24) revealed that on first load several inputs auto-selected values, quality score lit up non-zero before the user touched anything, and the Reset button did not fully clear role or requirement level. This created misleading UX — testers and first-time users saw partial state they never set. All inputs must start neutral and Reset must restore a truly blank slate.

**Changes**:

1. **No auto-selection on initial load** — every input now starts empty/unselected:
   - Role selector defaults to `''` (no role active) instead of `'sw-developer'`
   - Task type (`issueType`) defaults to `''` (no button highlighted)
   - Story points (`estimatedPoints`) defaults to `0` (no button highlighted)
   - Requirement level defaults to `'none'`
   - Project select shows "Select a project…" placeholder in muted colour
   - `ROLE_WEIGHTS['']` entry added (all zeros) so quality score stays at 0 until user acts

2. **`UserRole` type widened** — added `''` to the union so TypeScript accepts the empty state throughout the composable and config layers.

3. **Reset button fully clears state** — `resetForm()` now calls `setRole('')` so clicking Reset also clears the role selection and persists the empty role to localStorage.

4. **Select placeholder colour** — `.input-base.select-placeholder { color: var(--text-muted) }` added to `global.css`; `select-placeholder` class bindings added to Project, Vehicle, Product, Layer selects.

5. **Export dropdown click-outside** — clicking outside the export format popup now closes it (added `handleClickOutside` with `onMounted`/`onUnmounted` listeners in `TaskForm.vue`).

6. **Runtime crash fix** — `getReviewChecklist` switch had no `default` branch; when role is `''` the function returned `undefined` and crashed Vue's render. Added `default: return common`.

7. **TypeScript build errors resolved**:
   - `TEAM_MEMBERS['']` invalid index → guarded `teamMembers` computed with `props.form.projectKey ?`
   - `getAspiceProfile` called with `''` issueType → added `form.issueType` guard
   - `ROLE_QUESTIONS` Record missing `''` key → added `'': []` to `elicitation.ts`
   - `currentRoleDefinition` could be `null` in DevTools template → added null-safe guard

8. **Requirement level auto-update guard** — `watch(currentRole)` now only calls `getDefaultLevel` when `newRole` is non-empty, preventing it from overwriting `'none'` on initial load.

9. **`docs/MANUAL_TEST_GUIDE.md` corrections** — extensive updates to align expected outputs with actual source code:
   - §4d: story point buttons corrected (1/2/3/5/8 + custom input; "13" → "8")
   - §5.1–5.5: summary bracket notation corrected (`[...]` not `[—]`)
   - §6.5 & INCOSE quick-reference: trigger words, tag labels, and penalty details verified against `incose.ts`
   - §8a–8d: domain warnings, assumption detection, and traceability gap tables corrected with source file references
   - §11.8–11.11: Skill OFF / free-chat-mode expected behaviours corrected

| File | Change |
|------|--------|
| `src/composables/useRole.ts` | Widen `UserRole` to include `''`; default to `''`; guard `getRoleContext`, `getRolePlaceholder`, `currentRoleDefinition` |
| `src/composables/useForm.ts` | Add `ROLE_WEIGHTS['']`; add `setRole` import; call `setRole('')` in `resetForm()`; guard domain/assumption/ASPICE computeds; restore role-change watch with empty-role guard |
| `src/types/form.ts` | Widen `issueType` and `projectKey` to allow `''` |
| `src/components/form/BasicInfoSection.vue` | Add disabled placeholder `<option>`; `select-placeholder` class binding; guard `teamMembers` computed |
| `src/components/form/SummaryBuilder.vue` | Add `select-placeholder` class bindings to Vehicle/Product/Layer selects |
| `src/styles/global.css` | Add `.input-base.select-placeholder` muted-colour rule |
| `src/i18n/en.ts` | Add `selectProject: 'Select a project...'` |
| `src/i18n/zh.ts` | Add `selectProject: '请选择项目空间...'` |
| `src/components/form/TaskForm.vue` | Add click-outside handler for export dropdown |
| `src/config/domain/traceability.ts` | Add `default: return 'none'` to `getDefaultLevel` switch |
| `src/config/domain/review-workflow.ts` | Add `default: return common` to `getReviewChecklist` switch (crash fix) |
| `src/config/domain/elicitation.ts` | Add `'': []` to `ROLE_QUESTIONS` Record |
| `src/components/dev/DevTools.vue` | Null-safe `currentRoleDefinition` access in template |
| `docs/MANUAL_TEST_GUIDE.md` | Comprehensive corrections to §4d, §5, §6, §8, §11 |
| `src/components/layout/AppHeader.vue` | Version bump v10.9 → v10.10 |


---

## v10.11 — Conflict Check bug fix & manual test guide corrections (§9, §11.5, §11.6)

### Design rationale
During manual test walkthrough, two gaps were found:

1. **Source code bug**: `handleConflictCheck()` in `App.vue` called `buildConflictCheckPrompt()` to build a rich role-aware prompt (conflict types, output format, role-specific focus) but stored the result in a local variable `systemPrompt` that was never used. Only a generic one-line prefix was actually sent to the LLM, discarding all role-specific conflict analysis instructions.

2. **Test guide gaps**: Section 9 (Traceability) was missing tests for `no-verification` and `orphan-test` gaps, role auto-select, and had incorrect expected message text for 9.8. Section 11.5 and 11.6 were missing key side effects (skill auto-disable, description overwrite/prepend behavior) and 11.6 was missing the prerequisite of pasting requirements first.

### Changes

| File | Change |
|------|--------|
| `src/App.vue` | Fix `handleConflictCheck()`: replace dead `prefix + userReqs` with `systemPrompt + '\n\n---\n\n' + userReqs` so the full role-aware conflict analysis prompt is actually sent to the LLM |
| `docs/MANUAL_TEST_GUIDE.md` | §9: fix 9.8 expected message text, add 9.9 (no-verification gap), 9.10 (orphan-test gap), 9.11 (role auto-select); §11.5: document skill auto-disable + description overwrite; §11.6: add prerequisite (paste requirements first) + document skill auto-disable and description structure |
| `src/components/layout/AppHeader.vue` | Version bump v10.10 → v10.11 |


---

## v10.12 — Three-Mode System: Explore · Design · Task

### Design rationale
Replaced the improvised Skill ON/OFF + Task Coach toggles with a first-class three-mode
switcher. Mode state and flag driving live in `useAppMode.ts`. Form/workflow/AI cleanup
on mode switch is handled by a watch(appMode) in App.vue, since those instances are owned
there. Chat history is preserved across switches; all other state resets.

| File | Change |
|------|--------|
| `src/composables/useAppMode.ts` | New — AppMode type, appMode ref, setMode(), applyModeFlags() |
| `src/composables/__tests__/useAppMode.test.ts` | New — 8 unit tests, all passing |
| `src/i18n/en.ts` + `zh.ts` | Add mode label strings (explore/design/task) |
| `src/components/layout/AppHeader.vue` | Mode switcher buttons before language toggle; role selector v-show Design only; v10.12 |
| `src/App.vue` | watch(appMode) cleanup; layout-focus → appMode; gridStyle; col-right; per-panel v-show; canCoachSubmit switch; buildPayload switch; handleCoachRequest restore; DevTools watcher |
| `src/components/panels/CoachPanel.vue` | Remove Skill/TaskSkill toggles; mode-aware chips |
| `src/components/form/TaskForm.vue` | Mode-conditional v-show on all sections and action buttons |


---

## v10.13 — Task Mode verification fixes

### Design rationale
Post-implementation testing of Task mode revealed several gaps corrected here.

| File | Change |
|------|--------|
| `src/components/panels/CoachPanel.vue` | Wrap `<QuickChip v-for>` in `<template v-if>` to fix Vue 3 v-if+v-for collision |
| `src/App.vue` | Guard `applyModeFlags` on early `handleCoachRequest` return so tool-triggered flag overrides are always restored |
| `src/composables/useForm.ts` | Give empty-role (`''`) weight set meaningful values so quality score is live and non-zero in Task mode |
| `src/App.vue` + `src/components/form/TaskForm.vue` | Show Analyze button and AI Review Panel in Task mode to enable the coach → analyze → create JIRA sequence |
| `src/App.vue` | Update `canCoachSubmit` Task case to require all fields: project + assignee + type + points + 5-part summary + description |
| `src/App.vue` | Use `canCoachSubmit` guard in `handleAnalyze` and `handleCreateClick` for Task mode |
| `src/components/form/TaskForm.vue` | Add `!canCoachSubmit` to Analyze and Create JIRA `:disabled` in Task mode so buttons disable immediately when any field is cleared |


---

## v10.13 — Explore mode description label

### Design rationale
The section heading "Task Description" was semantically wrong in Explore mode where there is no task context — only a free-chat input. Switching the label to "Explore Description" aligns the UI language with the mode's purpose.

| File | Change |
|------|--------|
| `src/components/form/DescriptionEditor.vue` | Import `appMode`; label switches to `exploreDescription` when mode is `explore` |
| `src/i18n/en.ts` | Add `form.exploreDescription: 'Explore Description'` |
| `src/i18n/zh.ts` | Add `form.exploreDescription: '探索描述'` |


---

## v10.14 — Mode-specific description labels

### Design rationale
Each mode now has a semantically correct description label. "Task Description" was a catch-all that didn't reflect the purpose of Explore (free chat) or Design (requirement authoring).

| Mode | EN | ZH |
|------|----|----|
| Explore | Explore Description | 探索描述 |
| Design | Requirement Description | 需求描述 |
| Task | Task Description | 任务描述 |

| File | Change |
|------|--------|
| `src/components/form/DescriptionEditor.vue` | Three-way conditional label based on `appMode` |
| `src/i18n/en.ts` | Add `form.requirementDescription` |
| `src/i18n/zh.ts` | Add `form.requirementDescription` |


---

## v10.15 — Mode-specific Coach Panel empty state

### Design rationale
Design mode focuses purely on ASPICE-compliant requirement engineering. Generic task-writing chips and guidance text were noise. Each mode now has purpose-specific empty state copy and a narrowly scoped chip set.

| Mode | Chips | Hint |
|------|-------|------|
| Explore | Elicitation + Conflict Check | Free-form AI chat |
| Design | None | ASPICE / ISO 26262 RE guidance |
| Task | Template chips (role-filtered) | Task description writing |

| File | Change |
|------|--------|
| `src/components/panels/CoachPanel.vue` | Hint text switched per `appMode`; chips restricted to Explore (guided) and Task (template) only — Design shows none |
| `src/i18n/en.ts` | Add `coach.emptyHintDesign`, `coach.emptySubHintDesign`, `coach.emptyHintExplore`, `coach.emptySubHintExplore` |
| `src/i18n/zh.ts` | Same keys in Chinese |


---

## v10.16 — Move Elicitation/Conflict Check chips to Design mode

### Design rationale
Requirement Elicitation and Conflict Check are RE activities — they belong in Design mode alongside ASPICE/ISO 26262 guidance. Explore mode is now chipless (pure free-form chat). Final chip assignment per mode:

| Mode | Chips |
|------|-------|
| Explore | None |
| Design | Elicitation + Conflict Check |
| Task | Template chips (role-filtered) |

| File | Change |
|------|--------|
| `src/components/panels/CoachPanel.vue` | Guided chips condition: `appMode === 'explore'` → `appMode === 'design'` |
| `docs/MANUAL_TEST_GUIDE.md` | Sections 3a, 12 updated to reflect new chip placement |


---

## v10.17 — Restore Elicitation/Conflict Check button behavior in Design mode

### Design rationale
When the chips moved from Explore to Design mode, their handlers (`handleElicitation`, `handleConflictCheck`) still called `handleCoachRequest()` which in Design mode is gated by `canCoachSubmit = canSubmit.value` (requires all form fields filled). This silently blocked the chips from firing if the form was incomplete. Added a `force` parameter to bypass the guard for tool-triggered requests — these handlers inject their own prompt into the description, so the canSubmit guard is irrelevant.

| File | Change |
|------|--------|
| `src/App.vue` | `handleCoachRequest(force = false)` — guard becomes `!force && !canCoachSubmit.value`; `handleElicitation` and `handleConflictCheck` call with `true` |


---

## v10.18 — Elicitation/Conflict Check chips no longer overwrite description field

### Design rationale
Clicking either chip in Design mode previously injected the prompt template into `form.description`, disrupting any requirement the user had already written. Now the prompt is routed through a `pendingPromptOverride` ref — it goes directly into the coach payload without touching the description field.

| File | Change |
|------|--------|
| `src/App.vue` | Add `pendingPromptOverride` ref; `buildPayload('coach')` uses it when set; `handleCoachRequest` clears it after payload is built; `handleElicitation` and `handleConflictCheck` set override instead of writing to `form.description` |


---

## v10.19 — Mode-specific Coach panel title

### Design rationale
The coach panel title now reflects the active mode's purpose.

| Mode | EN | ZH |
|------|----|----|
| Explore | AI Chat | AI 对话 |
| Design | Design Coach | 设计教练 |
| Task | Task Coach | 任务教练 |

| File | Change |
|------|--------|
| `src/components/panels/CoachPanel.vue` | Title uses three-way conditional on `appMode` |
| `src/i18n/en.ts` | Add `coach.titleTask`, `coach.titleExplore` |
| `src/i18n/zh.ts` | Same keys in Chinese |


---

## v10.20 — Explore mode text fixes

### Design rationale
Two lingering "Design/Task" labels were still visible in Explore mode.

| Issue | Fix |
|-------|-----|
| `emptySubHintExplore` referenced "Writing Guidance" (the Design/Task button name) | Changed to "the Send button" |
| Send button tooltip showed "Writing Guidance" in all modes | Now shows "Explore" / "探索" in Explore mode |

| File | Change |
|------|--------|
| `src/i18n/en.ts` | Update `coach.emptySubHintExplore`; add `coach.requestBtnExplore: 'Explore'` |
| `src/i18n/zh.ts` | Same — `'探索'` |
| `src/components/form/TaskForm.vue` | Button `:title` switches on `appMode === 'explore'` |


---

## v10.21 — Fix Explore mode sub-hint button name

### Design rationale
"click the Send button" was corrected to "click the Explore button" to match the actual tooltip label on the button.

| File | Change |
|------|--------|
| `src/i18n/en.ts` | `coach.emptySubHintExplore`: "Send button" → "Explore button" |
| `src/i18n/zh.ts` | "发送按钮" → "探索按钮" |


---

## v10.22 — Explore mode visual identity tweaks

### Design rationale
Coordinating the "EXPLORE DESCRIPTION" label color with the "AI CHAT" panel title gives Explore mode a consistent visual identity distinct from Design/Task.

| Change | Detail |
|--------|--------|
| "AI Chat" → "AI CHAT" | Uppercase to match the all-caps style of panel titles |
| "EXPLORE DESCRIPTION" color | `var(--text-muted)` → `var(--text-primary)` in Explore mode via `.section-title--explore` |

| File | Change |
|------|--------|
| `src/i18n/en.ts` | `coach.titleExplore`: 'AI Chat' → 'AI CHAT' |
| `src/components/form/DescriptionEditor.vue` | Add `.section-title--explore { color: var(--text-primary) }` applied when `appMode === 'explore'` |


---

## v10.23 — Preserve user input across mode switches

### Design rationale
Switching between Explore / Design / Task was resetting the entire form, workflow status, and AI analysis — a jarring experience when the user just wants a different view of the same work. All state is now preserved on mode switch; only the visible UI sections change.

| File | Change |
|------|--------|
| `src/App.vue` | Remove `watch(appMode)` block that called `resetForm()`, `resetWorkflow()`, `clearAnalyzeResponse()` |
| `docs/MANUAL_TEST_GUIDE.md` | Section 3d rewritten: "State Reset" → "State Preservation" |


---

## v10.24 — Mode-scoped Reset and per-mode description isolation

### Design rationale
Each mode now owns its own description. Resetting in one mode leaves the other modes' data untouched.

**Description isolation:**
- `modeDescriptions` reactive object holds `{ explore, design, task }` separately
- `watch(appMode)` saves outgoing description and restores incoming on every mode switch
- `form.description` always reflects the active mode's description

**Reset scope:**
| Mode | What reset clears |
|------|-------------------|
| Explore | `form.description` + `modeDescriptions.explore` + coach chat |
| Design | All form fields + `modeDescriptions.design` + workflow + AI analysis + coach chat + search |
| Task | All form fields + `modeDescriptions.task` + workflow + AI analysis + JIRA response + coach chat + search |

| File | Change |
|------|--------|
| `src/App.vue` | Add `modeDescriptions` reactive; add `watch(appMode)` for description swap; add `reactive` import; `handleReset` split into Explore vs Design/Task branches |


---

## v10.25 — Design mode RE-specific form labels

### Design rationale
Design mode is for Requirement Engineering, not task creation. Labels now reflect RE terminology to match the ASPICE/ISO 26262 context.

| Field | Task mode (default) | Design mode |
|-------|--------------------|-------------|
| Project Name | Project Name / 项目空间 | Library Name / 需求库 |
| Assignee | Assignee / 经办人 | Author / 作者 |
| Task Type | Task Type / 任务类型 | Item Type / 条目类型 |
| Task Summary | Task Summary / 任务摘要 | Requirement Summary / 需求摘要 |
| Vehicle | Vehicle / 车型 | Product / 产品 |
| Product | Product / 产品 | Classification / 分类 |
| Task Detail | Task Detail / 任务概括 | Requirement Title / 需求标题 |

| File | Change |
|------|--------|
| `src/i18n/en.ts` | Add `*Design` keys for all 7 labels |
| `src/i18n/zh.ts` | Same in Chinese |
| `src/components/form/BasicInfoSection.vue` | Import `appMode`; 3 labels switch on `appMode === 'design'` |
| `src/components/form/SummaryBuilder.vue` | Import `appMode`; 4 labels switch on `appMode === 'design'` |

---

## v10.26 — Mode-Specific Configuration Split

### Design rationale
Design mode and Task mode had fundamentally different purposes (requirement engineering vs task ticket creation) but shared the same domain config files (INCOSE rules, ASPICE traceability, elicitation questions, review checklists). This coupling meant Task mode inherited automotive RE logic that was irrelevant to its workflow.

Split shared domain configs into independent `.design.ts` / `.task.ts` variants with a mode-aware resolver (`mode-config.ts`) that dispatches based on `appMode`. Each mode now has its own:
- Quality checks (INCOSE rules for Design, actionable/scoped/estimated checks for Task)
- Elicitation questions (requirement elicitation for Design, task-scoping for Task)
- Review checklists (ASPICE-oriented for Design, task-oriented for Task)
- Traceability model (ASPICE hierarchy for Design, epic/story/task hierarchy for Task)
- Coach skills (requirement coaching for Design, task writing coaching for Task)

### Changes
1. Renamed 4 domain config files with `.design` suffix (`elicitation`, `incose`, `review-workflow`, `traceability`)
2. Created shared `types.ts` with unified interfaces (`QualityViolation`, `ElicitationSet`, `ReviewStep`, etc.)
3. Created 4 new `.task` config files with task-focused logic
4. Created `mode-config.ts` resolver with 8 mode-aware functions
5. Created task coach skills (`coach-skill-task-en.md`, `coach-skill-task-zh.md`) with separate localStorage override
6. Updated all consumer composables and components to use resolver
7. Made `checkDomainWarnings` mode-aware (returns empty for Task mode)
8. Added task coach skill editing in DevTools

| File | Change |
|------|--------|
| `src/config/domain/types.ts` | NEW: shared interfaces for both mode variants |
| `src/config/domain/elicitation.design.ts` | Renamed from `elicitation.ts`, uses shared types |
| `src/config/domain/incose.design.ts` | Renamed from `incose.ts`, `IncoseViolation` aliases `QualityViolation` |
| `src/config/domain/review-workflow.design.ts` | Renamed from `review-workflow.ts`, uses shared types |
| `src/config/domain/traceability.design.ts` | Renamed from `traceability.ts`, uses shared types |
| `src/config/domain/elicitation.task.ts` | NEW: task-scoping questions per role |
| `src/config/domain/quality.task.ts` | NEW: task quality checks (actionable, scoped, complete, estimated, acceptance) |
| `src/config/domain/review-workflow.task.ts` | NEW: task-oriented review checklists |
| `src/config/domain/traceability.task.ts` | NEW: epic/story/task/subtask/bug hierarchy |
| `src/config/domain/mode-config.ts` | NEW: mode-aware resolver functions |
| `src/config/domain/index.ts` | Updated re-exports, mode-aware `checkDomainWarnings` |
| `src/config/skills/coach-skill-task-en.md` | NEW: task coach skill (English) |
| `src/config/skills/coach-skill-task-zh.md` | NEW: task coach skill (Chinese) |
| `src/config/skills/index.ts` | `getCoachSkill(mode, lang)`, task skill localStorage functions |
| `src/composables/useLLM.ts` | Pass `appMode.value` to skill/resolver functions |
| `src/composables/useForm.ts` | Use mode-aware quality checks and domain warnings |
| `src/composables/useBatchOps.ts` | Use mode-aware quality checks |
| `src/composables/useReviewWorkflow.ts` | Use mode-aware review steps/checklists |
| `src/composables/useReviewHistory.ts` | Updated type import path |
| `src/components/form/ReviewStatusBar.vue` | Use mode-aware review steps |
| `src/components/form/TaskForm.vue` | Updated type import path |
| `src/utils/exportFormats.ts` | Updated type import path |
| `src/App.vue` | Use mode-aware elicitation prompt |
| `src/components/dev/DevTools.vue` | Task coach skill editing section |

---

## v10.27 — Task Mode: Button Sequence & Guidance Label

### Design rationale
In Task mode, the Analyze button was active before the user completed Task Guidance (coach response). The correct sequence is: fill form → get Task Guidance → wait for AI response → then Analyze becomes available. Also renamed "Writing Guidance" to "Task Guidance" in Task mode since the coaching focus is task scoping, not requirement writing.

### Changes
1. Analyze button in Task mode now requires a completed coach response (`hasCoachResponse`) before activation
2. "Writing Guidance" button tooltip renamed to "Task Guidance" / "任务指导" in Task mode
3. Added `hasCoachResponse` prop to TaskForm (true when `coachMessages.length > 0 && !isCoachLoading`)

| File | Change |
|------|--------|
| `src/i18n/en.ts` | Add `coach.requestBtnTask: 'Task Guidance'` |
| `src/i18n/zh.ts` | Add `coach.requestBtnTask: '任务指导'` |
| `src/components/form/TaskForm.vue` | Mode-aware button label; Analyze gated by `hasCoachResponse` in task mode |
| `src/App.vue` | Pass `has-coach-response` prop |

---

## v10.28 — Isolate Review Workflow State Per Mode

### Design rationale
The 5-step review workflow (`draft → ai-reviewed → peer-reviewed → approved → jira-created`) used a single global `reviewStatus` ref shared across all modes. Running Task Guidance, Analyze, or Create JIRA in Task mode would advance the review status visible in Design mode's ReviewStatusBar. Each mode should track its own review workflow independently — actions in Task mode must not affect Design mode's review pipeline, and vice versa.

### Changes
1. Added per-mode state stores (`modeReviewStatus`, `modeCheckedItems`) as reactive records keyed by `AppMode`
2. `watch(appMode)` saves outgoing mode state and restores incoming mode state on switch (same pattern as `modeDescriptions` in App.vue)
3. `advanceTo()`, `toggleCheck()`, and `resetWorkflow()` now sync both the active ref and the per-mode store

| File | Change |
|------|--------|
| `src/composables/useReviewWorkflow.ts` | Per-mode review state isolation with save/restore on mode switch |
| `src/components/layout/AppHeader.vue` | Version bump v10.27 → v10.28 |

---

## v10.29 — i18n: Task Coach Skill labels in DevTools

### Design rationale
The "Task Coach Skill" label in DevTools was hardcoded in English in two places (Agent State status row and the editable textarea accordion). Added proper i18n key `dev.taskCoachSkill` so the label displays correctly in both English and Chinese.

### Changes
1. Added `dev.taskCoachSkill` i18n key — EN: "Task Coach Skill", ZH: "任务 Coach 提示词"
2. Replaced two hardcoded English strings in DevTools with `t('dev.taskCoachSkill')`

| File | Change |
|------|--------|
| `src/i18n/en.ts` | Add `dev.taskCoachSkill: 'Task Coach Skill'` |
| `src/i18n/zh.ts` | Add `dev.taskCoachSkill: '任务 Coach 提示词'` |
| `src/components/dev/DevTools.vue` | Replace hardcoded labels with i18n calls |
| `src/components/layout/AppHeader.vue` | Version bump v10.28 → v10.29 |

---

## v10.30 — Mode-adapted labels: Design Guidance & Requirement Decomposition

### Design rationale
In Design mode, the guidance button tooltip said "Writing Guidance" (generic) and the AI review panel title said "Task Analysis" (task-oriented). Both should reflect Design mode's focus on ASPICE/INCOSE requirement engineering: the button now says "Design Guidance" and the panel title shows "Requirement Decomposition" in Design mode while keeping "Task Analysis" in Task mode.

### Changes
1. Renamed `coach.requestBtn` from "Writing Guidance" → "Design Guidance" / "设计指导"
2. Added `panel.aiAgentResponseDesign` — "Requirement Decomposition" / "需求分解"
3. AIReviewPanel title is now mode-aware: shows design label in Design mode, task label otherwise

| File | Change |
|------|--------|
| `src/i18n/en.ts` | `requestBtn` → "Design Guidance"; add `aiAgentResponseDesign` |
| `src/i18n/zh.ts` | `requestBtn` → "设计指导"; add `aiAgentResponseDesign: '需求分解'` |
| `src/components/panels/AIReviewPanel.vue` | Mode-aware panel title using `appMode` |
| `src/components/layout/AppHeader.vue` | Version bump v10.29 → v10.30 |

---

## v10.31 — Four Mode-Specific Skill Settings with Decomposition Skill

### Design rationale
The LLM Settings previously had only two skill editors ("Coach Skill" and "Analyze Skill") that were not mode-specific. Now the settings page clearly separates skills by mode with section dividers:

- **Design Mode**: Design Guidance Skill (coach) + Decomposition Skill (analyze — requirement decomposition per INCOSE/ASPICE)
- **Task Mode**: Task Coach Skill (coach) + Task Analyze Skill (analyze — story points & subtasks)

Each skill has its own localStorage key, import/export, and reset-to-default. The `getAnalyzeSkill()` function is now mode-aware: Design mode uses the decomposition skill, Task mode uses the task analyze skill.

### Changes
1. Created `decompose-skill-en.md` and `decompose-skill-zh.md` — INCOSE/ASPICE requirement decomposition prompts
2. Added `decompose-skill` localStorage key with get/set/reset/modified functions
3. Made `getAnalyzeSkill(mode, lang)` mode-aware: design→decompose, task→analyze
4. LLM Settings now shows 4 skill editors with "Design Mode" / "Task Mode" section dividers
5. All 4 skills have import/export .md and reset-to-default support
6. DevTools Agent State panel shows all 4 skill modification statuses
7. Renamed i18n keys: `coachSkill` → "Design Guidance Skill", `analyzeSkill` → "Task Analyze Skill"

| File | Change |
|------|--------|
| `src/config/skills/decompose-skill-en.md` | New — INCOSE/ASPICE decomposition prompt (EN) |
| `src/config/skills/decompose-skill-zh.md` | New — INCOSE/ASPICE decomposition prompt (ZH) |
| `src/config/skills/index.ts` | Add decompose skill functions; make `getAnalyzeSkill` mode-aware |
| `src/composables/useLLM.ts` | Pass `appMode.value` to `getAnalyzeSkill()` |
| `src/components/settings/LLMSettings.vue` | 4 skill editors with mode section dividers |
| `src/components/dev/DevTools.vue` | Show decompose skill status in Agent State |
| `src/i18n/en.ts` | Add `decomposeSkill`, `taskCoachSkill`; rename `coachSkill`/`analyzeSkill` |
| `src/i18n/zh.ts` | Add `decomposeSkill`, `taskCoachSkill`; rename `coachSkill`/`analyzeSkill` |
| `src/components/layout/AppHeader.vue` | Version bump v10.30 → v10.31 |

---

## v10.32 — Design Mode: Relabel Buttons & Create Req Workflow

### Design rationale
Design mode now has its own button labels and creation workflow distinct from Task mode. The three action buttons under the description form are:
- **Design** (coach guidance) — tooltip "Design Guidance" / "设计指导"
- **Decompose** (analyze) — tooltip "Decompose" / "分解" (was "Analyze Task")
- **Create Req** — sends form data to n8n webhook to create a requirement JIRA item (replaces the old "Deep Review" button)

The "Create Req" button reuses the same `create` action/webhook pipeline as Task mode's "Create JIRA", so JIRA Response panel, Ticket History panel, and the confirm modal are now visible in Design mode too. The confirm modal title/hint adapts per mode ("Confirm Requirement Creation" vs "Confirm JIRA Creation").

### Changes
1. Relabeled Design mode buttons: coach → "Design Guidance", analyze → "Decompose", deep-review → "Create Req"
2. Replaced Deep Review button with Create Req button — fires `create` emit (same webhook flow as Create JIRA)
3. Removed `deepReview` emit from TaskForm (button removed)
4. Removed `@deep-review` handler binding in App.vue
5. JiraResponsePanel and TicketHistoryPanel now visible in Design mode (`v-show="appMode !== 'explore'"`)
6. Confirm modal title/hint is mode-aware: "Confirm Requirement Creation" in Design mode
7. `handleCreateClick` now allows Design mode (with `canSubmit` guard)

| File | Change |
|------|--------|
| `src/components/form/TaskForm.vue` | Relabel buttons; replace Deep Review with Create Req; remove `deepReview` emit |
| `src/App.vue` | Remove `@deep-review` binding; allow create in Design mode; show JiraResponsePanel/TicketHistoryPanel in Design mode; mode-aware confirm modal |
| `src/i18n/en.ts` | Add `aiAnalyzeDesign`, `createReq`, `confirmTitleDesign`, `confirmHintDesign` |
| `src/i18n/zh.ts` | Add `aiAnalyzeDesign`, `createReq`, `confirmTitleDesign`, `confirmHintDesign` |
| `src/components/layout/AppHeader.vue` | Version bump v10.31 → v10.32 |

---

## v10.33 — Design Mode: Sequential Button Activation

### Design rationale
Design mode buttons now follow a strict sequential activation order matching the workflow: Design (coach) → Decompose (analyze) → Create Req. Each step only activates after the previous step's AI response completes.

### Changes
1. **Decompose** button: disabled until coach response is done (`hasCoachResponse`) — same gating now applies to both Design and Task modes
2. **Create Req** button: only appears (`v-if`) after decomposition (analyze) response is done (`hasAiResponse`) — unified with Task mode's Create JIRA visibility logic

| File | Change |
|------|--------|
| `src/components/form/TaskForm.vue` | Gate Decompose on `hasCoachResponse` in Design mode; Create Req appears only after `hasAiResponse` |
| `src/components/layout/AppHeader.vue` | Version bump v10.32 → v10.33 |

---

## v10.34 — Design Mode: Shorten Button Tooltips & Rename DevTools Label

### Changes
1. Design Guidance button tooltip: "Design Guidance" → "Design" / "设计"
2. Create Req button tooltip: "Create Req" → "Create" / "创建"
3. DevTools editable skill accordion: "Task Coach Skill" → "Design System Prompt" / "设计系统提示词"

| File | Change |
|------|--------|
| `src/i18n/en.ts` | `requestBtn` → "Design"; `createReq` → "Create"; add `designSystemPrompt` |
| `src/i18n/zh.ts` | `requestBtn` → "设计"; `createReq` → "创建"; add `designSystemPrompt` |
| `src/components/dev/DevTools.vue` | Accordion label uses `dev.designSystemPrompt` |
| `src/components/layout/AppHeader.vue` | Version bump v10.33 → v10.34 |

---

## v10.35 — LLM Settings: Rename Skill Labels

### Changes
1. "Design Guidance Skill" → **"Design Skill"** / "设计提示词"
2. "Task Coach Skill" → **"Task Skill"** / "任务提示词"
3. "Task Analyze Skill" → **"Analyze Skill"** / "分析提示词"

Labels updated in both `dev` and `settings` i18n sections (4 occurrences each).

| File | Change |
|------|--------|
| `src/i18n/en.ts` | Rename `coachSkill`, `taskCoachSkill`, `analyzeSkill` labels |
| `src/i18n/zh.ts` | Rename `coachSkill`, `taskCoachSkill`, `analyzeSkill` labels |
| `src/components/layout/AppHeader.vue` | Version bump v10.34 → v10.35 |

---

## v10.36 — DevTools: Separate Design & Task System Prompt Panels

### Design rationale
The DevTools previously had one editable skill panel ("Design System Prompt") that incorrectly edited the task coach skill (`coach-skill-task`). Now there are two independent panels:
- **Design System Prompt** — edits `coach-skill` localStorage (design mode coach)
- **Task System Prompt** — edits `coach-skill-task` localStorage (task mode coach)

Each panel has its own modified badge, reset button, and textarea, so Design and Task mode system prompts can be configured independently from the DevTools sidebar.

### Changes
1. Split single DevTools skill panel into two: Design System Prompt + Task System Prompt
2. Design panel now correctly reads/writes `coach-skill` (was incorrectly using `coach-skill-task`)
3. Added `dev.taskSystemPrompt` i18n key

| File | Change |
|------|--------|
| `src/components/dev/DevTools.vue` | Two skill panels; import design coach skill functions; separate edit/reset handlers |
| `src/i18n/en.ts` | Add `dev.taskSystemPrompt: 'Task System Prompt'` |
| `src/i18n/zh.ts` | Add `dev.taskSystemPrompt: '任务系统提示词'` |
| `src/components/layout/AppHeader.vue` | Version bump v10.35 → v10.36 |

---

## v10.37 — DevTools: Mode-scoped System Prompt Panels

### Changes
- Design System Prompt panel: only visible in Design mode (`v-show="appMode === 'design'"`)
- Task System Prompt panel: only visible in Task mode (`v-show="appMode === 'task'"`)

| File | Change |
|------|--------|
| `src/components/dev/DevTools.vue` | Add `v-show` mode gating; import `appMode` |
| `src/components/layout/AppHeader.vue` | Version bump v10.36 → v10.37 |

## v10.38 — Fix Explore mode domain contamination

### Design rationale
Explore mode is a constraint-free brainstorming mode. Domain knowledge (INCOSE rules, ASPICE mapping, domain warnings, traceability checks, vocabulary/standards injection) was leaking into Explore mode because `resolveMode()` mapped `'explore'` → `'design'`. This caused the LLM to receive automotive domain constraints and the form to show quality penalties, assumptions, and traceability warnings — defeating the purpose of a free brainstorm.

### Changes
- `resolveMode()` now returns `null` for explore mode; all `getModeXxx()` functions return empty/neutral values
- `buildDomainContext()` skipped in Explore mode for Coach, Analyze, and Deep Review LLM prompts
- `getModeTraceContext()` returns `''` in Explore mode (via resolveMode null guard)
- `checkDomainWarnings()` returns `[]` for explore (previously only guarded task)
- `detectAssumptions()` skipped in Explore mode
- `getAspiceProfile()` returns `null` in Explore mode
- Quality penalties (`getModeQualityCheck/Penalty`), review steps/checklists, trace gaps all return empty in Explore

| File | Change |
|------|--------|
| `src/config/domain/mode-config.ts` | `resolveMode()` returns `null` for explore; all 8 `getModeXxx()` functions guard on null |
| `src/config/domain/index.ts` | `checkDomainWarnings()` early-returns `[]` for explore mode |
| `src/composables/useLLM.ts` | Guard `buildDomainContext()` with `appMode !== 'explore'` in Coach, Analyze, Deep Review |
| `src/composables/useForm.ts` | Guard `detectAssumptions()` and `getAspiceProfile()` with `appMode !== 'explore'` |
| `src/components/layout/AppHeader.vue` | Version bump v10.37 → v10.38 |

## v10.39 — Fix role placeholder contamination in Explore & Task modes

### Design rationale
Each role defines domain-specific placeholder text in the description textarea (e.g. "Include: ASIL, traceability to parent requirement..." for System Architect). These design-oriented hints were shown in all three modes, contaminating Explore (constraint-free brainstorm) and Task (agile work items) with design-mode guidance. Now only Design mode shows role-specific placeholders; Explore and Task fall back to the generic `descriptionPlaceholder`.

### Configuration location
Role placeholder texts are defined in `src/composables/useRole.ts:19-75` — each `RoleDefinition` has `placeholderEn` / `placeholderZh` fields.

### Changes
- DescriptionEditor textarea `:placeholder` now checks `appMode === 'design'` before showing role-specific text
- Explore & Task modes show the generic i18n `form.descriptionPlaceholder` instead

| File | Change |
|------|--------|
| `src/components/form/DescriptionEditor.vue` | Guard `:placeholder` with `appMode === 'design'` conditional |
| `src/components/layout/AppHeader.vue` | Version bump v10.38 → v10.39 |

## v10.40 — Mode-specific description placeholders

### Design rationale
The generic `descriptionPlaceholder` ("Enter background info, design thoughts, acceptance criteria...") was shared between Task and Explore modes, contaminating Explore with task/design concepts. Each mode now gets its own distinct placeholder:
- **Design mode**: role-specific placeholder (ASIL, traceability, interface specs — unchanged)
- **Task mode**: task-oriented ("Describe the task scope, deliverables, and acceptance criteria...")
- **Explore mode**: constraint-free ("Freely describe your idea, question, or topic — no format required. Brainstorm features, explore trade-offs...")

### Configuration location
- `src/i18n/en.ts:51-52` — `taskDescriptionPlaceholder` and `exploreDescriptionPlaceholder`
- `src/i18n/zh.ts:51-52` — Chinese equivalents

### Changes
- Added `taskDescriptionPlaceholder` and `exploreDescriptionPlaceholder` to both i18n files
- DescriptionEditor now uses a 3-way mode switch for placeholder text

| File | Change |
|------|--------|
| `src/i18n/en.ts` | Add `taskDescriptionPlaceholder`, `exploreDescriptionPlaceholder` |
| `src/i18n/zh.ts` | Add Chinese equivalents |
| `src/components/form/DescriptionEditor.vue` | 3-way mode conditional for `:placeholder` |
| `src/components/layout/AppHeader.vue` | Version bump v10.39 → v10.40 |

## v10.41 — Restrict ASPICE suggestions to Design mode only

### Design rationale
ASPICE process mapping (required fields like ASIL level, parent requirement ID, verification method) is an automotive design concern. The guard only excluded Explore mode (`!== 'explore'`), allowing ASPICE suggestions to contaminate Task mode. Changed to `=== 'design'` so ASPICE is strictly Design-mode only.

### Changes
- `aspiceProfile` computed now returns `null` unless `appMode === 'design'`

| File | Change |
|------|--------|
| `src/composables/useForm.ts` | ASPICE guard: `!== 'explore'` → `=== 'design'` |
| `src/components/layout/AppHeader.vue` | Version bump v10.40 → v10.41 |

## v10.42 — Explore mode empty-state colors match AI chat

### Design rationale
The initial guide text and icon in Explore mode (before user sends a message) used `var(--text-muted)` which looked faded and disconnected from the AI chat bubbles. Updated to match the AI chat palette: icon uses `var(--accent-blue)` (same as the assistant role label), hint text uses `var(--text-primary)` (same as chat body text), sub-hint keeps `var(--text-primary)` at 0.7 opacity for hierarchy.

### Changes
- Added `empty-state--explore` class to the empty-state container when in Explore mode
- Icon: `var(--text-muted)` → `var(--accent-blue)`
- Hint text: `var(--text-muted)` → `var(--text-primary)`
- Sub-hint: `var(--text-muted)` → `var(--text-primary)` at 0.7 opacity

| File | Change |
|------|--------|
| `src/components/panels/CoachPanel.vue` | Add `empty-state--explore` class + CSS overrides for icon/hint/sub colors |
| `src/components/layout/AppHeader.vue` | Version bump v10.41 → v10.42 |

## v10.43 — Unify empty-state guide colors across all modes

### Design rationale
The v10.42 fix only updated Explore mode's empty-state colors. The user wants Design and Task mode guides to also match their respective panel titles ("Design Coach" / "Task Coach"). Since the panel title color is `var(--text-primary)` across all modes, the fix is simpler: update the base `.empty-icon`, `.empty-hint`, `.empty-sub` styles directly — no mode-specific overrides needed.

### Changes
- `.empty-icon`: `var(--text-muted)` → `var(--accent-blue)` (matches assistant role label)
- `.empty-hint`: `var(--text-muted)` → `var(--text-primary)` (matches panel title / chat body)
- `.empty-sub`: `var(--text-muted)` → `var(--text-primary)` at 0.7 opacity
- Removed the `empty-state--explore` class and its CSS overrides (no longer needed)

| File | Change |
|------|--------|
| `src/components/panels/CoachPanel.vue` | Update base empty-state colors; remove explore-specific overrides |
| `src/components/layout/AppHeader.vue` | Version bump v10.42 → v10.43 |

## v10.44 — Explore mode: send Response Format in system prompt

### Design rationale
Explore mode previously sent an empty system prompt (`''`), meaning the LLM had no formatting guidance and could return inconsistent markdown/math syntax. The Response Format instructions (configured in LLM Settings) should apply to all modes so responses render correctly. Now Explore mode sends only the Response Format as the system prompt — no coach skill, no domain context, no role context, no traceability.

### Final content sent per mode

| Mode | System Prompt | User Message |
|------|--------------|--------------|
| **Design** | Role Context + Domain Context + Trace Context + Coach Skill + Response Format | Structured payload (project, type, summary, description, etc.) |
| **Task** | Role Context + Domain Context + Task Trace Context + Task Coach Skill + Response Format | Structured payload |
| **Explore** | Response Format only | Raw description text |

### Changes
- Import `getResponseFormat` in useLLM.ts
- When `coachSkillEnabled` is false (Explore mode), return `getResponseFormat()` instead of `''`

| File | Change |
|------|--------|
| `src/composables/useLLM.ts` | Import `getResponseFormat`; return it in explore early-exit path |
| `src/components/layout/AppHeader.vue` | Version bump v10.43 → v10.44 |

## v10.45 — Remove Role Context & Domain Context from Task mode system prompts

### Design rationale
Task mode coaching is role-agnostic — it focuses on actionability, scope, acceptance criteria, and effort estimation. The Role Context ("The user is a System Architect, focus on ASIL...") and Domain Context (automotive vocabulary, ISO 26262/ASPICE standards) are design-mode concerns that add noise to task coaching without improving output quality. Task Trace Context (epic→story→task hierarchy) remains because it directly helps the AI understand task scoping.

### Final system prompt composition per mode

| Mode | System Prompt Parts | Config File(s) |
|------|-------------------|----------------|
| **Design** | Role Context + Domain Context + Trace Context + Coach Skill + Response Format | `useRole.ts` (role context), `domain/vocabulary.ts` + `domain/standards.ts` (domain), `domain/traceability.design.ts` (trace), `skills/coach-skill-en.md` (skill), `skills/response-format.md` (format) |
| **Task** | Task Trace Context + Task Coach Skill + Response Format | `domain/traceability.task.ts` (trace), `skills/coach-skill-task-en.md` (skill), `skills/response-format.md` (format) |
| **Explore** | Response Format only | `skills/response-format.md` (format) |

### Changes
- Coach, Analyze, Deep Review: Role Context and Domain Context now gated on `isDesign` instead of `!== 'explore'`
- All three flows follow the same pattern: Design gets full context, Task gets trace only, Explore gets nothing

| File | Change |
|------|--------|
| `src/composables/useLLM.ts` | Gate `roleContext` and `domainContext` with `isDesign` in Coach, Analyze, Deep Review |
| `src/components/layout/AppHeader.vue` | Version bump v10.44 → v10.45 |

## v10.46 — Rename design coach skill files for clarity

### Design rationale
The design coach skill files (`coach-skill-en.md`, `coach-skill-zh.md`, `coach-skill.md`) had no "design" prefix, making them hard to distinguish from the task variants (`coach-skill-task-en.md`, `coach-skill-task-zh.md`). Renamed to `coach-skill-design-*` for consistency.

### File renames
| Before | After |
|--------|-------|
| `coach-skill.md` | `coach-skill-design.md` |
| `coach-skill-en.md` | `coach-skill-design-en.md` |
| `coach-skill-zh.md` | `coach-skill-design-zh.md` |

| File | Change |
|------|--------|
| `src/config/skills/index.ts` | Update 3 import paths |
| `src/components/settings/LLMSettings.vue` | Update download filename |
| `src/components/layout/AppHeader.vue` | Version bump v10.45 → v10.46 |

## v10.47 — Delete unused legacy skill template files

### Changes
- Deleted `coach-skill-design.md` (old `{lang}` template, replaced by `coach-skill-design-en.md` / `coach-skill-design-zh.md`)
- Deleted `analyze-skill.md` (old `{lang}` template, replaced by `analyze-skill-en.md` / `analyze-skill-zh.md`)
- Removed dead imports (`coachSkillDefault`, `analyzeSkillDefault`) and legacy export from `index.ts`

| File | Change |
|------|--------|
| `src/config/skills/coach-skill-design.md` | Deleted |
| `src/config/skills/analyze-skill.md` | Deleted |
| `src/config/skills/index.ts` | Remove 2 dead imports + legacy export line |
| `src/components/layout/AppHeader.vue` | Version bump v10.46 → v10.47 |

## v10.48 — Conversation Replay (session-grouped coach history)

### Design Rationale
Coach history records were stored as a flat list with no conversation grouping. The existing "Replay" button re-sent a single user message as a standalone request. Users could not restore a full conversation and continue it — every coach interaction was stateless. Since `useLLM.ts` already sends all entries in `messages.value` to the LLM, pre-populating `messages.value` with historical records is sufficient to give the LLM full multi-turn context.

### Changes
- Added `sessionId` field to `CoachHistoryRecord` — optional for backward compat with legacy records
- Session tracking: `currentSessionId` ref, `startNewSession()`, auto-generated on first `addRecord()` call
- Session grouping: `getSessionGroups()` groups records by sessionId; `getSessionRecords()` retrieves a session in chronological order
- Message restoration: `restoreCoachMessages()` in `useLLM` clears chat, populates `messages.value` from history records, and resumes the session ID
- "Continue" button per session in history tab — restores full conversation context without auto-sending
- History tab now shows records grouped by session as collapsible `<details>` elements
- Search/filter mode falls back to flat list (results may span sessions)
- Legacy records (no sessionId) appear under "Earlier Messages" section
- Single-message Replay and all existing selection/delete/export still work unchanged
- New i18n keys: `historyContinue`, `historySessionLabel`, `historyUngrouped` (EN + ZH)

| File | Change |
|------|--------|
| `src/types/api.ts` | Add `sessionId?` to `CoachHistoryRecord` |
| `src/composables/useCoachHistory.ts` | Session ID tracking, grouping utilities |
| `src/composables/useLLM.ts` | Add `restoreCoachMessages`, import `currentSessionId` |
| `src/App.vue` | `handleContinueSession`, wire event, `startNewSession` on reset |
| `src/components/panels/CoachPanel.vue` | Bubble `continueSession` event |
| `src/components/coach/CoachHistoryTab.vue` | Session-grouped UI with Continue button |
| `src/i18n/en.ts` | New labels |
| `src/i18n/zh.ts` | New labels |
| `src/components/layout/AppHeader.vue` | Version bump v10.47 → v10.48 |

## v10.49 — Design mode: separate Classification from Product in Requirement Summary

### Design Rationale
Design mode is dedicated to system, software, hardware, mechanics, safety, and V&V requirements. The "Classification" field was incorrectly using `PRODUCT_OPTIONS` (EPS, IBC, etc.) — which are product names, not requirement categories. Requirements need a proper classification taxonomy including Functional, Non-Functional, Safety ASIL levels (QM through ASIL-D per ISO 26262), Constraint, Interface, Performance, Legal/Regulatory, and Cybersecurity.

### Changes
- Added `CLASSIFICATION_OPTIONS` to `constants.ts` with complete requirement classification taxonomy
- Design mode field 1 ("Product") now uses `PRODUCT_OPTIONS` — shows actual products (EPS, IBC, etc.)
- Design mode field 2 ("Classification") now uses `CLASSIFICATION_OPTIONS` — categorizes requirement type
- Task mode unchanged — field 1 still uses `VEHICLE_OPTIONS`, field 2 still uses `PRODUCT_OPTIONS`

| File | Change |
|------|--------|
| `src/config/constants.ts` | Add `CLASSIFICATION_OPTIONS` array |
| `src/components/form/SummaryBuilder.vue` | Mode-aware option lists for fields 1 & 2 |
| `src/components/layout/AppHeader.vue` | Version bump v10.48 → v10.49 |

## v10.50 — Rename "Project Name" / "Library Name" to "Agile Team"

### Design Rationale
Both Design and Task mode panels used labels "Library Name" and "Project Name" for the project selector, which didn't reflect the agile team–centric workflow. Renaming to "Agile Team" aligns with how teams actually organize their work. The dropdown now shows `TeamName (JiraProject)` instead of `JiraProject (TeamName)` to emphasize the team identity.

### Changes
- i18n: `projectName` → "Agile Team" / "敏捷团队", `projectNameDesign` → "Agile Team" / "敏捷团队"
- `BasicInfoSection.vue`: Dropdown display order flipped to `teamName (name)`

| File | Change |
|------|--------|
| `src/i18n/en.ts` | `projectName` / `projectNameDesign` → "Agile Team" |
| `src/i18n/zh.ts` | `projectName` / `projectNameDesign` → "敏捷团队" |
| `src/components/form/BasicInfoSection.vue` | Dropdown: `teamName (name)` order |
| `src/components/layout/AppHeader.vue` | Version bump v10.49 → v10.50 |

## v10.51 — Layer→Role auto-routing (skill router)

### Design Rationale
The Layer selection in the Requirement Summary directly signals the user's engineering discipline — SYS engineers pick "SYS", SW developers pick "SW"/"APP"/"SWF", etc. Previously, users had to manually select their role in the header. By auto-routing Layer→Role, the correct skill, LLM context, quality weights, requirement level, and ASPICE profile activate instantly without any extra clicks. This is a high-efficiency skill router that leverages an input the user already fills.

### Layer → Role mapping
| Layer | Auto-set Role |
|-------|--------------|
| `SYS` | System Architect |
| `SW`, `APP`, `SWF` | SW Developer |
| `HW` | HW Designer |
| `ME` | Mechanics Designer |
| `TEST` | V&V Engineer |

### Changes
- Added `LAYER_ROLE_MAP` and a `watch(summary.layer)` watcher in `useForm.ts`
- When Layer changes, the role auto-updates (which cascades to requirement level, quality weights, domain context, and ASPICE profile)
- Manual role selection in the header still works and takes precedence until the next Layer change

| File | Change |
|------|--------|
| `src/composables/useForm.ts` | `LAYER_ROLE_MAP` + `watch(summary.layer)` auto-routing |
| `src/components/layout/AppHeader.vue` | Version bump v10.50 → v10.51 |

## v10.52 — Layer-specific task coach skills (skill router)

### Design Rationale
Task mode previously used a single coach skill for all layers. Since each engineering discipline (SYS, SW, APP, HW, ME, TEST, SWF) has fundamentally different review criteria — from AUTOSAR architecture checks for BSW to EMC compliance for HW to pass/fail criteria for V&V — a single generic skill cannot provide expert-level coaching. By mapping each Layer selection to a dedicated skill file, the LLM receives domain-specific review checklists, terminology, and output formats tailored to the user's engineering discipline.

### Layer → Skill mapping
| Layer | Skill Focus | Files |
|-------|------------|-------|
| SYS | System architecture, requirement decomposition, ASIL allocation | `coach-skill-task-sys-{en,zh}.md` |
| SW | BSW/MCAL, AUTOSAR layers, resource impact (existing) | `coach-skill-task-sw-{en,zh}.md` |
| APP | Application SW, control algorithms, calibration, state machines | `coach-skill-task-app-{en,zh}.md` |
| HW | Schematic, pin assignment, EMC, power budget, HW/SW interface | `coach-skill-task-hw-{en,zh}.md` |
| ME | Housing, thermal, connector, vibration, IP rating, DFM | `coach-skill-task-me-{en,zh}.md` |
| TEST | Test case, verification method, pass/fail, HIL/SIL, coverage | `coach-skill-task-test-{en,zh}.md` |
| SWF | Functional safety, FMEA, safety mechanisms, ASIL decomposition | `coach-skill-task-swf-{en,zh}.md` |

### Changes
- Created 12 new skill files (6 layers x 2 languages), each with domain-specific review checklists
- Refactored `index.ts`: `TASK_SKILL_MAP` maps layers to bundled skills, `activeTaskLayer` ref drives selection
- `getCoachSkillTaskDefault(lang, layer?)` now picks the layer-specific skill (falls back to SW)
- `activeTaskSkillName` computed shows human-readable name (e.g. "Task Coach (HW)")
- `useForm.ts` sets `activeTaskLayer` when Layer changes
- DevTools shows active task skill name + modified badge
- localStorage override still works as power-user escape hatch (overrides any layer)
- Fixed broken imports (old `coach-skill-task-en/zh.md` files no longer exist)

| File | Change |
|------|--------|
| `src/config/skills/coach-skill-task-sys-{en,zh}.md` | New: System architecture skill |
| `src/config/skills/coach-skill-task-app-{en,zh}.md` | New: Application SW skill |
| `src/config/skills/coach-skill-task-hw-{en,zh}.md` | New: Hardware design skill |
| `src/config/skills/coach-skill-task-me-{en,zh}.md` | New: Mechanical design skill |
| `src/config/skills/coach-skill-task-test-{en,zh}.md` | New: V&V/Test skill |
| `src/config/skills/coach-skill-task-swf-{en,zh}.md` | New: SW Functional Safety skill |
| `src/config/skills/index.ts` | Layer-specific imports, TASK_SKILL_MAP, activeTaskLayer, activeTaskSkillName |
| `src/composables/useForm.ts` | Set activeTaskLayer in layer watcher |
| `src/components/dev/DevTools.vue` | Show active task skill name + modified badge |
| `src/components/layout/AppHeader.vue` | Version bump v10.51 → v10.52 |

## v10.53 — LLM Settings: reactive task skill on layer change

**Problem:** The LLM Settings modal loaded the task coach skill once when opened but didn't react to `activeTaskLayer` changes. If the layer changed while settings was open, the textarea still showed the previous layer's skill.

**Fix:** Added a watcher on `activeTaskLayer` inside LLMSettings.vue. When the layer changes and the modal is open, it reloads the task skill content — but only if the user hasn't customized it via localStorage (custom edits take priority over layer defaults).

| File | Change |
|------|--------|
| `src/components/settings/LLMSettings.vue` | Added `activeTaskLayer` watcher to reload task skill on layer change |
| `src/components/layout/AppHeader.vue` | Version bump v10.52 → v10.53 |

## v10.54 — DevTools: show full task skill file name, reactive to language toggle

**Problem:** DevTools showed abbreviated task skill names like "Task Coach (SYS)" instead of the actual file name. When the user toggled language (EN→ZH), the displayed name didn't change to reflect the new language-specific file being loaded.

**Fix:**
- Added `activeTaskSkillFile` computed in `skills/index.ts` — derives the full file name (e.g. `coach-skill-task-sys-en.md`) from `activeTaskLayer` + `currentLang`, both reactive
- Exported `currentLang` from `src/i18n/index.ts` so the skills config module can react to language changes
- DevTools and LLM Settings now display the full file name instead of the abbreviation
- Toggling language automatically updates the displayed file name (e.g. `coach-skill-task-sys-en.md` → `coach-skill-task-sys-zh.md`)

| File | Change |
|------|--------|
| `src/i18n/index.ts` | Export `currentLang` ref directly for use outside components |
| `src/config/skills/index.ts` | Import `currentLang`, add `activeTaskSkillFile` computed (layer + lang → file name) |
| `src/components/dev/DevTools.vue` | Import `activeTaskSkillFile`, display full file name instead of abbreviation |
| `src/components/settings/LLMSettings.vue` | Use `activeTaskSkillFile` in layer badge |
| `src/components/layout/AppHeader.vue` | Version bump v10.53 → v10.54 |

## v10.55 — Remove skill editing textareas from DevTools

**Rationale:** The "Design System Prompt" and "Task System Prompt" inline editing sections in DevTools were redundant — skill editing already lives in LLM Settings. Removing them simplifies the DevTools panel.

**Changes:**
- Removed the two `<details>` sections with skill textareas (design coach + task coach)
- Removed associated script logic (`localDesignCoachSkill`, `localTaskCoachSkill`, input handlers, reset handlers)
- Cleaned up unused imports (`getCoachSkillRaw`, `setCoachSkill`, `resetCoachSkill`, `getCoachSkillDefault`, `getCoachSkillTaskRaw`, `setCoachSkillTask`, `resetCoachSkillTask`, `getCoachSkillTaskDefault`, `appMode`)
- Removed unused CSS classes (`skill-header`, `skill-textarea`, `skill-footer`, `skill-counter`, `btn-reset`, etc.)
- Removed i18n keys: `dev.designSystemPrompt`, `dev.taskSystemPrompt` (en + zh)

| File | Change |
|------|--------|
| `src/components/dev/DevTools.vue` | Removed skill editing sections, cleaned up imports and CSS |
| `src/i18n/en.ts` | Removed `designSystemPrompt`, `taskSystemPrompt` keys |
| `src/i18n/zh.ts` | Removed `designSystemPrompt`, `taskSystemPrompt` keys |
| `src/components/layout/AppHeader.vue` | Version bump v10.54 → v10.55 |

## v10.56

**Rationale:** The Elicitation and Conflict Check guided chips were only shown in Design mode's coach empty state, but they are more useful in Explore mode where the user has free-form chat without a structured coach skill. Moving them to Explore gives users quick access to these tools in the right context.

**Changes:**
- Moved the two guided chips (Elicitation + Conflict Check) from Design mode to Explore mode in the CoachPanel empty state

| File | Change |
|------|--------|
| `src/components/panels/CoachPanel.vue` | Changed guided chips `v-if` from `appMode === 'design'` to `appMode === 'explore'` |
| `src/components/layout/AppHeader.vue` | Version bump v10.55 → v10.56 |

## v10.57

**Rationale:** The "Requirement Elicitation" badge in Explore mode's AI-CHAT panel was sending an empty prompt because `getModeElicitationPrompt()` returned `''` for Explore mode (the resolver treated Explore as "no domain logic"). Design and Task modes each had dedicated elicitation files, but Explore had none. Added a general-purpose elicitation prompt that guides users step-by-step through 8 core questions (plus role-specific follow-ups) to produce a well-formed requirement from scratch.

**Changes:**
- Created `elicitation.explore.ts` with general-purpose requirement elicitation questions (EN + ZH) and role-specific additions
- Wired Explore mode into `getModeElicitationPrompt()` and `getModeElicitationSet()` so the badge now sends a complete coaching prompt

| File | Change |
|------|--------|
| `src/config/domain/elicitation.explore.ts` | **New** — Explore-mode elicitation questions + prompt builder |
| `src/config/domain/mode-config.ts` | Added explore import and early-return for explore mode in elicitation resolvers |
| `src/components/layout/AppHeader.vue` | Version bump v10.56 → v10.57 |

## v10.58

**Rationale:** Explore mode's AI-CHAT acts as a free-form chat, but users often have requirements, specs, or context in markdown files they want to discuss with the AI. Added a markdown file attachment button (`.md` / `.markdown` / `.txt`) to the description input area in Explore mode. The file content is prepended to the user's message, so the AI receives the full document as context alongside the user's question.

**Changes:**
- Created `useAttachment.ts` composable — shared reactive state for attached file (name + content) with `attach()` / `detach()` methods
- Added paperclip button + file chip UI in `DescriptionEditor.vue` (explore mode only) with hidden file input, animated chip, and remove button
- Updated `App.vue` to prepend attachment content to explore-mode payload and clear attachment after sending
- Updated `canCoachSubmit` to allow submitting with just an attachment (no typed text required)
- Added i18n keys for attach/remove labels (EN + ZH)

| File | Change |
|------|--------|
| `src/composables/useAttachment.ts` | **New** — shared attachment state composable |
| `src/components/form/DescriptionEditor.vue` | Added file upload button, attachment chip, and CSS (explore mode only) |
| `src/App.vue` | Import `useAttachment`, prepend file content in explore payload, clear on send, update canCoachSubmit |
| `src/i18n/en.ts` | Added `attachFile`, `removeAttachment` keys |
| `src/i18n/zh.ts` | Added `attachFile`, `removeAttachment` keys |
| `src/components/layout/AppHeader.vue` | Version bump v10.57 → v10.58 |

## v10.59

**Rationale:** The 5-step review workflow (Draft → AI Reviewed → Peer Reviewed → Approved → JIRA Created) was only visible in Design mode, but the full infrastructure already supported Task mode — `review-workflow.task.ts` defines task-specific steps and checklists, `mode-config.ts` resolves them for task mode, and `useReviewWorkflow` manages per-mode state. The only missing piece was the `v-show` condition in TaskForm.vue.

**Changes:**
- Extended the `ReviewStatusBar` visibility condition from `appMode === 'design'` to `appMode === 'design' || appMode === 'task'`

### Task Mode Workflow Progression

The 5-step review workflow is driven by the button chain **Task Guidance → Analyze Task → Create JIRA** with the following progression logic:

```
Draft ──[Task Guidance]──▶ (no step change)
       ──[Analyze Task]──▶ AI Reviewed
       ──[Peer Review Checklist]──▶ Peer Reviewed (manual, via checklist toggle)
       ──[Approve button]──▶ Approved (manual, after all checklist items checked)
       ──[Create JIRA]──▶ JIRA Created
```

**Button gating (sequential enforcement):**

| Button | Enabled condition | Workflow trigger on success |
|--------|-------------------|-----------------------------|
| Task Guidance (coach) | `canCoachSubmit` — all task fields filled (project + assignee + type + points + summary + description) | None |
| Analyze Task | `canCoachSubmit` AND `hasCoachResponse` — coach must complete first | `advanceTo('ai-reviewed')` if status is `draft` |
| Create JIRA | `hasAiResponse` — analyze must complete first, AND `canCoachSubmit` | `advanceTo('jira-created')` |

**Manual steps between Analyze and Create:**
- After AI review, the ReviewStatusBar shows a role-specific peer review checklist (defined in `review-workflow.task.ts`)
- Task-mode checklist items: acceptance criteria defined, effort estimated, no TBD/TBC items, plus role-specific items (e.g., modules/files identified for sw-developer, test scope for vv-engineer)
- User toggles checklist items → progress bar fills → "Approve" button becomes available when all items checked
- Approve advances status to `approved`, unblocking Create JIRA

**Key files:**

| File | Role |
|------|------|
| `src/components/form/TaskForm.vue:116` | Analyze button `:disabled` gating — requires `hasCoachResponse` in task/design modes |
| `src/components/form/TaskForm.vue:131` | Create button `v-if` — requires `hasAiResponse` |
| `src/App.vue:592` | `advanceTo('ai-reviewed')` after successful analyze |
| `src/App.vue:707` | `advanceTo('jira-created')` after successful create |
| `src/config/domain/review-workflow.task.ts` | Task-mode 5-step definitions and role-specific checklists |
| `src/composables/useReviewWorkflow.ts` | Per-mode state management, step resolution, checklist toggle |

| File | Change |
|------|--------|
| `src/components/form/TaskForm.vue` | Changed `v-show` on ReviewStatusBar to include task mode |
| `src/components/layout/AppHeader.vue` | Version bump v10.58 → v10.59 |

## v10.60

**Rationale:** Task mode only had three issue types (Story, Task, Bug). Added a "Feature" button to better represent feature-level work items. The new type is wired through the entire data flow: type definitions, UI rendering, payload building, ASPICE profile lookup, batch operations, and CSV import.

**Changes:**
- Added `'Feature'` to the `FormState.issueType` and `TaskTypeConfig.value` union types
- Added Feature button to `TASK_TYPES` constant (purple: `#d2a8ff`)
- Updated all downstream type casts: `aspice.ts` IssueType, `useBatchOps.ts` BatchRequirement, `useForm.ts` ASPICE profile call, `App.vue` batch item cast

| File | Change |
|------|--------|
| `src/types/form.ts` | Added `'Feature'` to `FormState.issueType` and `TaskTypeConfig.value` unions |
| `src/config/constants.ts` | Added Feature entry to `TASK_TYPES` array |
| `src/config/domain/aspice.ts` | Added `'Feature'` to `IssueType` alias |
| `src/composables/useBatchOps.ts` | Updated `BatchRequirement.issueType` type and CSV import cast |
| `src/composables/useForm.ts` | Updated ASPICE profile cast |
| `src/App.vue` | Updated batch item cast |
| `src/components/layout/AppHeader.vue` | Version bump v10.59 → v10.60 |

## v10.61

**Rationale:** Design mode was an ASPICE/INCOSE-focused requirement writing workflow with domain context injection, role-based coaching, traceability decomposition, and design-specific skills. The app now simplifies to two modes: **Explore** (free-form AI chat) and **Task** (structured task workflow). This reduces cognitive overhead, eliminates dead-code paths, and streamlines the settings UI. `CLASSIFICATION_OPTIONS` in `constants.ts` is preserved for potential future use.

**Changes:**
- Removed `'design'` from `AppMode` union type — app now only supports `'explore' | 'task'`
- Removed Design mode button from header mode switcher and all role selector UI
- Stripped all `appMode === 'design'` ternaries from form components (SummaryBuilder, BasicInfoSection, DescriptionEditor, TaskForm, CoachPanel, AIReviewPanel)
- Removed Design Mode skills section from LLMSettings (coach + decompose skill editors)
- Removed design coach skill, decompose skill imports/functions from `config/skills/index.ts`
- Updated `config/skills/registry.ts` — "Design Coach" → "Task Coach", uses `getCoachSkillTaskRaw`
- Removed `domainWarnings`, `aspiceProfile`, `aspiceSuggestions` from App.vue and child component props
- Removed ASPICE suggestion bar and domain warning list from DescriptionEditor template
- Removed design branches from `config/domain/mode-config.ts` and `config/domain/index.ts`
- Removed `buildDomainContext` and `getRoleContext` unused imports from `useLLM.ts`
- Removed design state slot from `useReviewWorkflow.ts` per-mode maps
- Added `'none'` to `TaskLevel` union for form default compatibility
- Added `PMVSS`, `PMVBS`, `PMVSU` to `ProjectKey` type (pre-existing type gap)
- Widened `getLevelDef()` parameter to `string` for cross-type compatibility
- Updated `useBatchOps.ts` to use `TaskLevel` instead of `RequirementLevel`
- Cleaned design-specific i18n keys from both `en.ts` and `zh.ts` (~20 keys each)
- Updated `useAppMode.test.ts` — removed design mode test cases
- Deleted design-only files: `TraceabilitySection.vue`, `elicitation.design.ts`, `incose.design.ts`, `review-workflow.design.ts`, `coach-skill-design-en.md`, `coach-skill-design-zh.md`, `decompose-skill-en.md`, `decompose-skill-zh.md`
- Kept `traceability.design.ts` (still imported by trace-suggest, trace-impact, useBatchOps)

| File | Change |
|------|--------|
| `src/composables/useAppMode.ts` | `AppMode = 'explore' \| 'task'`, default `'task'` |
| `src/components/layout/AppHeader.vue` | Removed design button, role selector, version → v10.61 |
| `src/components/form/SummaryBuilder.vue` | Removed design ternaries |
| `src/components/form/BasicInfoSection.vue` | Removed design label ternaries |
| `src/components/form/DescriptionEditor.vue` | Removed design conditionals, ASPICE bar, domain warnings |
| `src/components/form/TaskForm.vue` | Removed TraceabilitySection, design props |
| `src/components/form/TraceabilitySection.vue` | **Deleted** |
| `src/components/panels/CoachPanel.vue` | Removed design branches |
| `src/components/panels/AIReviewPanel.vue` | Removed design title branch |
| `src/components/settings/LLMSettings.vue` | Removed Design Mode skills section |
| `src/components/dev/DevTools.vue` | Removed design skill status rows |
| `src/App.vue` | Removed all design branches, props, computed |
| `src/composables/useLLM.ts` | Removed unused design imports |
| `src/composables/useForm.ts` | Removed domainWarnings, aspiceProfile |
| `src/composables/useReviewWorkflow.ts` | Removed design state slot |
| `src/composables/useBatchOps.ts` | Switched to TaskLevel |
| `src/config/domain/mode-config.ts` | Removed design resolver |
| `src/config/domain/index.ts` | Removed design re-exports, added RequirementLevel re-export |
| `src/config/domain/traceability.task.ts` | Added `'none'` to TaskLevel |
| `src/config/domain/traceability.design.ts` | Widened getLevelDef parameter |
| `src/config/domain/trace-suggest.ts` | Accept TaskLevel parameter |
| `src/config/domain/trace-impact.ts` | Accept TaskLevel parameter |
| `src/config/skills/index.ts` | Removed design skills |
| `src/config/skills/registry.ts` | Updated to Task Coach |
| `src/types/form.ts` | `requirementLevel: TaskLevel` |
| `src/types/team.ts` | Added PMVSS, PMVBS, PMVSU to ProjectKey |
| `src/i18n/en.ts` | Removed ~20 design-specific keys |
| `src/i18n/zh.ts` | Removed ~20 design-specific keys |
| `src/composables/__tests__/useAppMode.test.ts` | Removed design test cases |
| `src/config/domain/elicitation.design.ts` | **Deleted** |
| `src/config/domain/incose.design.ts` | **Deleted** |
| `src/config/domain/review-workflow.design.ts` | **Deleted** |
| `src/config/skills/coach-skill-design-en.md` | **Deleted** |
| `src/config/skills/coach-skill-design-zh.md` | **Deleted** |
| `src/config/skills/decompose-skill-en.md` | **Deleted** |
| `src/config/skills/decompose-skill-zh.md` | **Deleted** |

---

## v10.62 — Fix: Confirm JIRA modal shows correct `action: "create"` in payload

**Problem:** When clicking "Create JIRA" in Task mode, the confirmation modal displayed the payload with `action: "preview"` instead of `action: "create"`. This was misleading because the actual POST to n8n correctly used `action: "create"`, but the user-facing preview did not match.

**Root cause:** The `jsonPayload` ref was populated by a debounced watcher that always called `buildPayload('preview')`. When the confirmation modal opened, it displayed this stale preview payload rather than the actual create payload.

**Fix:** In `handleCreateClick()`, explicitly set `jsonPayload` to `buildPayload('create')` before opening the modal. This ensures the user sees exactly what will be sent to n8n — with `action: "create"`.

| File | Change |
|------|--------|
| `src/App.vue` | `handleCreateClick()` now sets `jsonPayload` with `buildPayload('create')` |
| `src/components/layout/AppHeader.vue` | Version bump to v10.62 |

---

## v10.63 — Fix: Remove auto-duplicate-check from Create JIRA flow

**Problem:** Clicking "Create JIRA" in Task mode sent an unwanted `action: "search"` request to n8n (auto-duplicate-check). The n8n workflow interpreted this as a create action and created a JIRA ticket prematurely — before the user even clicked "Create Ticket" in the confirmation modal.

**Root cause:** `handleCreateClick()` called `checkDuplicates()` which POSTed a search payload to the same n8n webhook. The n8n workflow did not distinguish between `action: "search"` and `action: "create"`, so it processed the search request as a ticket creation.

**Fix:** Removed `checkDuplicates()` from `handleCreateClick()`. Now clicking "Create JIRA" only opens the confirmation modal — no request is sent to n8n until the user clicks "Create Ticket".

| File | Change |
|------|--------|
| `src/App.vue` | Removed `checkDuplicates()` call from `handleCreateClick()` |
| `src/components/layout/AppHeader.vue` | Version bump to v10.63 |

---

## v10.64 — Style: Show full JIRA title in Ticket History

**Change:** Ticket History entries now display the full summary text instead of truncating at 40 characters with ellipsis. The summary wraps naturally with `word-break: break-word`.

| File | Change |
|------|--------|
| `src/components/panels/TicketHistoryPanel.vue` | Removed `truncate()` function, removed CSS ellipsis truncation, added word-break wrap |
| `src/components/layout/AppHeader.vue` | Version bump to v10.64 |

---

## v10.65 — UI: Merge ProcessingSummary into JiraResponsePanel, move Ticket History up

**Changes:**
1. **Merged ProcessingSummary into JiraResponsePanel** — AI corrected points, subtask count, and JIRA ticket link now display as a summary section inside the JIRA Response panel (above the JSON response). The panel shows the summary as soon as AI analysis completes, and appends the JSON response after JIRA creation. Removed standalone `ProcessingSummary` component from App.vue layout.
2. **Moved TicketHistoryPanel** from the bottom of the right sidebar to directly below JiraResponsePanel.

**Right sidebar order (Task mode):** AIReviewPanel → JiraResponsePanel (with summary) → TicketHistory → DevTools → JiraSearch → Batch → ReviewDashboard

| File | Change |
|------|--------|
| `src/components/panels/JiraResponsePanel.vue` | Added `aiResponse`/`estimatedPoints` props; merged summary rows + JSON into unified layout |
| `src/App.vue` | Removed `ProcessingSummary`, moved `TicketHistoryPanel` below `JiraResponsePanel`, passed new props |
| `src/components/layout/AppHeader.vue` | Version bump to v10.65 |

---

## v10.66 — UI: Move "Created" indicator from JIRA Response to Ticket History

**Change:** The green "Created" success indicator was on the JIRA Response panel header — but it makes more sense on Ticket History, which is where the created ticket actually appears. Now:

- **JIRA Response panel** only shows loading/pending status during creation, then returns to idle
- **Ticket History panel** shows a green "Created" badge in the header when a ticket is just created, the panel auto-opens, and the new entry is highlighted with a green border

| File | Change |
|------|--------|
| `src/components/panels/JiraResponsePanel.vue` | Removed `'created'` success status — only shows loading/pending/idle |
| `src/components/panels/TicketHistoryPanel.vue` | Added `lastCreatedKey` prop, green "Created" badge, auto-open on create, green highlight on new entry |
| `src/App.vue` | Added `lastCreatedKey` ref, set on successful creation, passed to TicketHistoryPanel |
| `src/components/layout/AppHeader.vue` | Version bump to v10.66 |

---

## v10.67 — UI: Collapsible JIRA Response panel

**Change:** Replaced `PanelShell` wrapper with a `<details>` expand/collapse pattern matching Ticket History's style. The panel:
- **Auto-opens** when content arrives (AI response, JIRA response, or creating state)
- **Collapses** on click to save sidebar space
- Shows an orange "Pending" badge in the collapsed header during creation
- Removed `PanelShell` dependency — lighter, consistent with Ticket History

| File | Change |
|------|--------|
| `src/components/panels/JiraResponsePanel.vue` | Replaced PanelShell with `<details>`-based collapsible layout |
| `src/components/layout/AppHeader.vue` | Version bump to v10.67 |

---

## v10.68 — UI: Collapsible Task Analysis panel

**Change:** Replaced `PanelShell` wrapper in AIReviewPanel with the same `<details>` expand/collapse pattern used by Ticket History and JIRA Response. The panel:
- **Auto-opens** when analyzing or when a response arrives
- **Collapses** on click to save sidebar space
- Header shows: title, model badge, status badge (Loading/Success/Error), diff toggle, copy button
- Header action buttons (diff, copy) use `@click.stop` so they don't trigger collapse
- All existing features preserved: streaming, cancel, retry, perspective tabs, diff view

| File | Change |
|------|--------|
| `src/components/panels/AIReviewPanel.vue` | Replaced PanelShell with `<details>`-based collapsible layout; status badges in header |
| `src/components/layout/AppHeader.vue` | Version bump to v10.68 |

---

## v10.69 — Style: Task Analysis header — match Coach panel font size + add emoji

**Change:** Task Analysis panel header title was `12px / text-secondary` — too small compared to the Coach panel on the left. Updated to `var(--font-lg) / text-primary` to match PanelShell's title styling. Added `🔍` emoji to the `reviewPanel` icon.

| File | Change |
|------|--------|
| `src/components/panels/AIReviewPanel.vue` | Header font: `var(--font-lg)`, color: `var(--text-primary)` |
| `src/config/icons.ts` | `reviewPanel: '🔍'` |
| `src/components/layout/AppHeader.vue` | Version bump to v10.69 |

---

## v10.70 — UI: Move AI result badges to Task Analysis header, clean up JIRA Response

**Changes:**
1. **Task Analysis header** now shows compact result badges (visible even when collapsed):
   - **Points badge** (green): `3 → 5` — AI corrected story points vs original estimate
   - **Subtasks badge** (orange): `2 items` — when subtasks were created
2. **JIRA Response panel** cleaned up — removed the summary section (AI Corrected Points, Subtasks, JIRA ticket ID link). Now only shows raw JSON response. The JIRA ticket ID is already visible in Ticket History.
3. **App.vue** — moved `estimatedPoints` prop from JiraResponsePanel to AIReviewPanel

| File | Change |
|------|--------|
| `src/components/panels/AIReviewPanel.vue` | Added `estimatedPoints` prop, `aiPoints`/`subtaskCount` computed, result badges in header |
| `src/components/panels/JiraResponsePanel.vue` | Removed summary section, `aiResponse`/`estimatedPoints` props |
| `src/App.vue` | Moved `:estimated-points` to AIReviewPanel, removed `:ai-response` from JiraResponsePanel |
| `src/components/layout/AppHeader.vue` | Version bump to v10.70 |

---

## v10.71 — Fix: Parse AI result badges from LLM JSON response

**Problem:** The result badges (points, subtasks) looked for `ai_points`/`subtasks_created` directly on the response object `{ markdown_msg, message }`. These fields don't exist there — the LLM returns raw JSON as a string inside `response.message`.

**Fix:** Parse `response.message` as JSON to extract the actual analysis data:
- `final_points` → points badge (green `3 → 5`)
- `split_number` → subtasks badge (orange `4 Subtasks`)

Also changed badge label from "items" to "Subtasks".

| File | Change |
|------|--------|
| `src/components/panels/AIReviewPanel.vue` | Parse `response.message` as JSON; read `final_points`/`split_number`; badge label "Subtasks" |
| `src/components/layout/AppHeader.vue` | Version bump to v10.71 |

---

## v10.72 — UI: Move JIRA response JSON to Agent State, simplify JIRA Response panel

**Changes:**
1. **JIRA Response panel** — no longer shows raw JSON. After successful creation, shows a clean success state: green checkmark icon + clickable ticket key link + "JIRA ticket created successfully" hint. The header also shows the ticket key as a green badge. Fallback to JsonViewer for unexpected responses without a `key` field.
2. **Agent State (DevTools)** — new JIRA section appears after creation, showing: ticket key (clickable link), AI points, and view URL. This is where developers can inspect the full n8n response data.

| File | Change |
|------|--------|
| `src/components/panels/JiraResponsePanel.vue` | Replaced JSON display with success state (icon + key link + hint); green key badge in header |
| `src/components/dev/DevTools.vue` | Added `jiraResponse` prop; JIRA section in Agent State showing key, AI points, view URL |
| `src/App.vue` | Pass `:jira-response="jiraResponse"` to DevTools |
| `src/components/layout/AppHeader.vue` | Version bump to v10.72 |

## v10.73 — Move "Creating" indicator to Ticket History, remove JIRA Response panel

**Rationale:** The JIRA Response panel's only remaining purpose was showing a spinner during creation and a success state after. Ticket History already displays the "Created" badge and the created ticket entry. By adding a "Creating" indicator directly to Ticket History, the JIRA Response panel becomes fully redundant and can be removed, simplifying the right-column layout.

### Changes

1. **TicketHistoryPanel** — added `isCreating` prop; yellow "Creating" badge with mini spinner shown in header when creating is in progress; panel auto-opens when creation starts
2. **App.vue** — removed `<JiraResponsePanel>` from template and its import; passed `:is-creating` prop to `<TicketHistoryPanel>`
3. **Version bump** to v10.73

| File | Change |
|------|--------|
| `src/components/panels/TicketHistoryPanel.vue` | Added `isCreating` prop, yellow "Creating" badge with spinner, auto-open on create |
| `src/App.vue` | Removed JiraResponsePanel usage; pass `is-creating` to TicketHistoryPanel |
| `src/components/layout/AppHeader.vue` | Version bump to v10.73 |

## v10.73 — Skill Router Design Doc

Added bilingual (EN/ZH) design document `docs/SKILL-ROUTER-DESIGN.md` covering:
- Full routing flow diagrams for Coach and Analyze paths
- Layer-based skill selection with layer→role mapping
- Keyword matching algorithm details (threshold=2, substring scan)
- Context layer assembly (trace + skill + response format)
- User customization guide (edit, reset, import/export, toggles)
- Known limitations (single localStorage key, no semantic matching)
- Future enhancement roadmap (per-layer keys, semantic matching, skill versioning, custom registry)

| File | Change |
|------|--------|
| `docs/SKILL-ROUTER-DESIGN.md` | New — Skill Router design doc (bilingual EN/ZH) |

## v10.74 — Fix "Creating" badge not showing on second JIRA creation

**Rationale:** After the first successful JIRA creation, `lastCreatedKey` was set to the ticket key but never reset before the next creation. The TicketHistoryPanel's creating badge condition (`isCreating && !lastCreatedKey`) evaluated to `false` on subsequent creates because `lastCreatedKey` still held the previous ticket's key.

### Changes

1. **App.vue** — reset `lastCreatedKey` to `''` at the start of `confirmCreate()`, before the webhook call, so the creating badge condition works on every creation attempt

| File | Change |
|------|--------|
| `src/App.vue` | Reset `lastCreatedKey` before `createJiraTicket()` call |
| `src/components/layout/AppHeader.vue` | Version bump to v10.74 |

## v10.75 — Reset workflow when re-clicking "Task Guidance"; clear lastCreatedKey on Reset

**Rationale:** The five-step workflow (Draft → AI Reviewed → Peer Reviewed → Approved → JIRA Created) should restart when the user clicks "Task Guidance" again, since that signals a new coaching iteration. Previously the workflow step stayed at its old value (e.g. "Approved" or "JIRA Created") even after re-coaching. Additionally, the Reset button did not clear `lastCreatedKey`, leaving a stale green "Created" badge in the Ticket History panel after reset.

### Changes

1. **App.vue / `handleCoachRequest()`** — when in Task mode and workflow has advanced past "Draft", reset the workflow back to "Draft" and clear `lastCreatedKey` before requesting new coaching
2. **App.vue / `handleReset()`** — clear `lastCreatedKey` alongside `resetWorkflow()` so the Ticket History badge fully resets

| File | Change |
|------|--------|
| `src/App.vue` | Reset workflow + `lastCreatedKey` on re-coach in task mode; clear `lastCreatedKey` on reset |
| `src/components/layout/AppHeader.vue` | Version bump to v10.75 |

## v10.76 — Docker deployment fixes

**Rationale:** The existing Dockerfile and docker-compose.yml were functional but had minor issues: no health check for container monitoring, no container name for easier management, and `.dockerignore` was missing entries that bloated the build context.

### Changes

1. **Dockerfile** — add `--ignore-scripts` to `npm ci` for safer installs; add `HEALTHCHECK` instruction for container health monitoring
2. **docker-compose.yml** — add `container_name: smart-agent` for easier container management
3. **.dockerignore** — exclude `.claude/`, `docs/`, `*.md`, `*.stackdump`, `*.xmind` to reduce build context size

| File | Change |
|------|--------|
| `Dockerfile` | Add `--ignore-scripts`, add `HEALTHCHECK` |
| `docker-compose.yml` | Add `container_name` |
| `.dockerignore` | Exclude docs, markdown, and dev artifacts |
| `src/components/layout/AppHeader.vue` | Version bump to v10.76 |

## v10.77

**Rationale:** The AI Chat panel's empty state in Explore Mode felt static and lifeless. Adding a rotating ASCII globe animation (inspired by aemkei's "World in 1024 bytes" demo) as a rising backdrop gives Explore Mode a distinct, techy visual identity. The globe rises from the bottom with a gradient mask creating a "horizon" effect, and gracefully fades + slides down when the user focuses the description editor.

### Changes

1. **AsciiGlobe.vue** — new self-contained component rendering a rotating ASCII Earth using requestAnimationFrame, with continent bitmap, sphere projection, Y-axis rotation, and diffuse lighting
2. **CoachPanel.vue** — integrated globe as a positioned backdrop in Explore Mode empty state; added `descriptionFocused` prop for fade-on-focus behavior
3. **DescriptionEditor.vue** — added focus/blur event emitters on the textarea
4. **TaskForm.vue** — bubbles descFocus/descBlur events from DescriptionEditor to parent
5. **App.vue** — wires descFocused reactive ref between TaskForm and CoachPanel

| File | Change |
|------|--------|
| `src/components/effects/AsciiGlobe.vue` | **NEW** — ASCII globe animation component |
| `src/components/panels/CoachPanel.vue` | Add globe backdrop, `descriptionFocused` prop, z-index layering |
| `src/components/form/DescriptionEditor.vue` | Add focus/blur emits on textarea |
| `src/components/form/TaskForm.vue` | Bubble descFocus/descBlur events |
| `src/App.vue` | Wire descFocused ref, pass as prop |
| `src/components/layout/AppHeader.vue` | Version bump to v10.77 |

---

## v10.78 — Runtime-configurable Task Mode (no rebuild required)

**Design rationale:** The team (~250 members across 12 projects) frequently onboards new staff. Previously, updating the team member list, vehicle options, or other Task Mode dropdowns required recompiling the entire app. This change externalizes Basic Information and Task Summary config into JSON files served as static assets. Ops can now update `deploy/config/*.json` and refresh — no Docker rebuild needed.

**Approach:** Vite copies `public/config/` verbatim into `dist/config/`. A new `useRuntimeConfig` composable fetches the 3 JSON files at app startup via `fetch()`, falling back to hardcoded defaults if the fetch fails (offline/missing files).

### Changes

1. **3 external JSON config files** in `public/config/`:
   - `projects.json` — project list (name, key, teamName)
   - `team-members.json` — team members grouped by project key
   - `summary-options.json` — vehicles, products, layers, components
2. **`useRuntimeConfig.ts`** — composable that loads JSON at startup with fallback to hardcoded defaults
3. **`BasicInfoSection.vue`** — swapped `PROJECT_CONFIG`/`TEAM_MEMBERS` imports to `runtimeProjects`/`runtimeTeamMembers`
4. **`SummaryBuilder.vue`** — swapped `VEHICLE_OPTIONS`/`PRODUCT_OPTIONS`/`LAYER_OPTIONS` to `runtimeSummaryOptions`
5. **`useForm.ts`** — swapped `PROJECT_CONFIG` and `DEFAULT_COMPONENT_HISTORY` to runtime refs
6. **`App.vue`** — calls `loadRuntimeConfig()` in `onMounted`
7. **`docker-compose.yml`** — added `volumes: ./deploy/config:/app/dist/config` for hot-swap
8. **`types/team.ts`** — relaxed `ProjectKey` to `string` for dynamic JSON keys
9. **`deploy/config/`** — seed JSON files for Docker volume mount

### How to update config in Docker (no rebuild)

```bash
# Edit the JSON file on the host
vi deploy/config/team-members.json

# The volume mount makes it immediately available in the container
# Users just refresh their browser — done
```

| File | Change |
|------|--------|
| `public/config/projects.json` | **NEW** — externalized project list |
| `public/config/team-members.json` | **NEW** — externalized team members |
| `public/config/summary-options.json` | **NEW** — externalized vehicle/product/layer/component options |
| `src/composables/useRuntimeConfig.ts` | **NEW** — runtime JSON loader with fallback |
| `src/types/team.ts` | Relaxed `ProjectKey` to `string` |
| `src/components/form/BasicInfoSection.vue` | Use runtime config refs |
| `src/components/form/SummaryBuilder.vue` | Use runtime config refs |
| `src/composables/useForm.ts` | Use runtime config refs |
| `src/App.vue` | Load runtime config at startup |
| `docker-compose.yml` | Added config volume mount |
| `deploy/config/*.json` | **NEW** — seed files for Docker volume |
| `src/components/layout/AppHeader.vue` | Version bump to v10.78 |

---

## v10.79 — Per-team components + hardened runtime config

**Design rationale:** v10.78 made projects/team/summary/components externally configurable, but (a) the `components` list was a single flat array shared across all Agile Teams, so HW engineers saw MCAL/BSW entries and SW engineers saw gate-driver chips; (b) the runtime loader silently fell back on malformed or missing JSON, giving operators no signal; (c) browsers aggressively cached `/config/*.json`, so edits + container restart didn't reliably reach users until a hard refresh. This revision fixes all three and commits the deployment infrastructure that had been sitting as untracked scaffolding.

**Approach — per-team component scoping.** Components are now keyed by project key in their own file (`components.json`), mirroring the shape of `team-members.json`. When a user selects a project in Basic Info, `useForm.componentHistory` becomes a `computed` that reads `runtimeComponentsByProject.value[projectKey]`. Session-added components (user-typed entries confirmed by coach/analyze/create) now accumulate in a per-project session map rather than a single flat list, so teams don't pollute each other's suggestions. Legacy drafts still display whatever value is saved — only the suggestion datalist is filtered.

**Approach — hardening.** `useRuntimeConfig.ts` now: appends `?v=${Date.now()}` cache-buster to each fetch URL so container restart + next load always reaches the new JSON; runs a lightweight shape validator per file before replacing fallbacks; exposes `runtimeConfigStatus` with per-file `runtime|fallback|invalid|pending` state so operators can see exactly which files loaded; and emits structured `[runtime-config]` warnings naming the file, HTTP status, and validation reason. No new dependencies.

### Changes

1. **`src/config/constants.ts`** — replaced flat `DEFAULT_COMPONENT_HISTORY: string[]` with `DEFAULT_COMPONENTS_BY_PROJECT: Record<string, string[]>` bucketed by obvious team ownership (HW → IC drivers, DKKF → MCAL/BSW/HAbs/boot, SWCD → Dcm/Nm/Xcp, etc.). Added safety-fallback header comment.
2. **`src/composables/useRuntimeConfig.ts`** — added 4th fetch for `components.json`; removed `components` from `SummaryOptions` interface; added `runtimeComponentsByProject` export; added `?v=timestamp` cache-busting; added per-file shape validators; added `runtimeConfigStatus` ref with `'pending'|'runtime'|'fallback'|'invalid'`; added structured console logging naming file + reason.
3. **`src/composables/useForm.ts`** — `componentHistory` is now a `computed` keyed by `form.projectKey`; `addComponentToHistory` accumulates into a per-project session map so different teams don't share each other's suggestions.
4. **`public/config/components.json` + `deploy/config/components.json`** — NEW per-team component maps (mirror of fallback in constants.ts).
5. **`public/config/summary-options.json` + `deploy/config/summary-options.json`** — removed the `components` key (moved to `components.json`).
6. **`deploy/config/README.md`** — NEW operator doc: per-file purpose + schemas, edit workflow, key-match invariant, validation failure console messages.
7. **`docs/MANUAL_TEST_GUIDE.md`** — NEW section 36 "Runtime Config Hot-Swap (Docker)" covering per-team filter, hot-swap round trip, and validation failure paths.

### How to update config in Docker (unchanged from v10.78, more reliable now)

```bash
# 1. Edit the JSON on the host
vi deploy/config/components.json

# 2. Restart the container so it serves the new file
docker compose restart smart-agent

# 3. Users reload — cache-bust query ensures they get the fresh JSON
#    (hard refresh no longer required)
```

### File matrix

| File | Change |
|------|--------|
| `src/config/constants.ts` | `DEFAULT_COMPONENT_HISTORY` → `DEFAULT_COMPONENTS_BY_PROJECT` |
| `src/composables/useRuntimeConfig.ts` | Add components fetch, cache-bust, validation, per-file status, structured logging |
| `src/composables/useForm.ts` | `componentHistory` computed per project; session additions scoped per project |
| `public/config/components.json` | **NEW** — per-team component map |
| `public/config/summary-options.json` | Remove `components` key |
| `deploy/config/components.json` | **NEW** — per-team component map (runtime mount) |
| `deploy/config/summary-options.json` | Remove `components` key |
| `deploy/config/README.md` | **NEW** — operator edit workflow + schemas |
| `docs/MANUAL_TEST_GUIDE.md` | **NEW** section 36 hot-swap tests |
| `src/components/layout/AppHeader.vue` | Version bump to v10.79 |

---

## v10.80 — Breathing glow on header border while AI is responding

**Design rationale:** The 1px line between `header.app-header` and `main.app-main` is a deliberate hierarchy cue we want to keep, but while the user is waiting for an LLM stream, the app currently gives no passive, full-window indication that "something is happening." Spinners live inside their own panels and are easy to miss at a glance. Animating the existing header border with a soft breathing glow gives the entire app a calm, peripheral "AI is thinking" signal that doesn't block interaction and doesn't add new chrome. The glow fades in the instant either "Task Guidance" or "Analyze Task" kicks off a stream, and fades out the moment the stream ends (including on error, because the loading flags are cleared in `useLLM.ts`'s `finally` block).

**Approach.** A single boolean `isAiBusy = isCoachLoading || isAnalyzeLoading` is computed in `App.vue` and passed as a prop to `AppHeader.vue`. The header renders a pseudo-element (`::after`) aligned to the existing border (`bottom: -1px`, `height: 1px`) whose `box-shadow` animates via a new `@keyframes headerBreathe` (2.4s ease-in-out, infinite) using `--accent-blue`. The 1px border itself is unchanged; only the pseudo-element's glow animates. `prefers-reduced-motion: reduce` replaces the animation with a static faint shadow so the cue still reads without motion.

### Changes

1. **`src/App.vue`** — added `const isAiBusy = computed(() => isCoachLoading.value || isAnalyzeLoading.value)` and passed `:is-ai-busy="isAiBusy"` to `<AppHeader>`. No new imports needed (`isCoachLoading` / `isAnalyzeLoading` are already destructured from `useLLM()`).
2. **`src/components/layout/AppHeader.vue`** — added `defineProps<{ isAiBusy?: boolean }>()`; bound `:class="{ 'is-ai-busy': isAiBusy }"` on the `<header>`; added `position: relative` to `.app-header`, `::after` pseudo-element scoped to the bottom edge, `@keyframes headerBreathe`, and a `prefers-reduced-motion` fallback. Existing `border-bottom: 1px solid var(--border-color)` left untouched.
3. **Version bump** — `v10.79` → `v10.80`.

### File matrix

| File | Change |
|------|--------|
| `src/App.vue` | Added `isAiBusy` computed and passed to `<AppHeader>` |
| `src/components/layout/AppHeader.vue` | `isAiBusy` prop, class binding, `::after` pseudo-element, `headerBreathe` keyframe, reduced-motion fallback, version bump to v10.80 |

---

## v10.81 — Sticky header stays visible when scrolling

**Design rationale:** The header contains the mode switcher, language toggle, TEST/PROD indicator, theme toggle, help, and settings — all controls users reach for in the middle of a session. When long AI-chat transcripts, long analysis output, or a long task description overflow the viewport, the whole page scrolls and the header disappears, forcing users to scroll back up to change mode or reach settings. Pinning the header to the top keeps those controls (and the new breathing-glow AI-busy indicator) continuously visible. The app already scrolls at the document level (`.app` is `min-height: 100vh` with no internal scroll container), so `position: sticky; top: 0` was enough — no layout rework required.

**Approach.** Changed `.app-header`'s `position: relative` to `position: sticky; top: 0; z-index: 100`. The existing `position: relative` was only there to anchor the breathing-glow `::after` pseudo-element, and `position: sticky` is also a containing block for absolutely-positioned descendants, so the glow continues to sit on the border exactly as before. `z-index: 100` is comfortably above the drag-handle (`z-index: 10`) and well below the confirmation modal (`z-index: 5000`).

### Changes

1. **`src/components/layout/AppHeader.vue`** — `.app-header` now `position: sticky; top: 0; z-index: 100` (replacing `position: relative`). All other styles unchanged. Version bump to v10.81.

### File matrix

| File | Change |
|------|--------|
| `src/components/layout/AppHeader.vue` | `position: relative` → `position: sticky; top: 0; z-index: 100`; version bump to v10.81 |

---

## v10.82 — Maximize column width, minimize outer gutter

**Design rationale:** The three-column grid (AI Coach / Task Form / Tools) was sitting inside an `.app-main` with `padding: var(--space-6)` (≈18–32px) on all sides and `max-width: 95vw`, leaving a visible empty gutter of 40–60px on each side even on widescreen monitors. That wasted horizontal real estate — the left column (AI Coach) and the right column (Tools) were the most squeezed, especially in bilingual contexts where Chinese labels need more room. This change reclaims that horizontal space so the columns can breathe while keeping top/bottom rhythm intact for the sticky header and form sections.

**Approach.** Split `.app-main` padding into vertical and horizontal halves: vertical stays at `var(--space-6)` (preserves the comfortable gap under the sticky header and above the fold), horizontal drops to `var(--space-1)` (≈3–6px — essentially a hairline gutter so the columns don't touch the viewport edge). Bumped `max-width` from `clamp(1200px, 95vw, 3600px)` to `clamp(1200px, 100vw, 3600px)` so mid-range screens (1280–3600px) get the full viewport width rather than the 95vw cap, gaining ~2.5vw per side. The 3600px upper clamp is preserved so ultra-wide monitors (4K/5K) still get a sensible max.

The change is symmetric — both the left column (`.col-left`) and the right column (`.col-right`) gain width by the same amount, addressing the user's ask that the right column also benefit.

### Changes

1. **`src/App.vue`** — `.app-main` padding `var(--space-6)` → `var(--space-6) var(--space-1)`; `max-width` `clamp(1200px, 95vw, 3600px)` → `clamp(1200px, 100vw, 3600px)`.
2. **Version bump** — `v10.81` → `v10.82`.

### File matrix

| File | Change |
|------|--------|
| `src/App.vue` | `.app-main` horizontal padding cut from `--space-6` to `--space-1`; `max-width` middle clamp 95vw → 100vw |
| `src/components/layout/AppHeader.vue` | Version bump to v10.82 |
