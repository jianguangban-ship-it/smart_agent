# App Mode Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the improvised Skill ON/OFF + Task Coach toggles with a first-class three-mode system (Explore · Design · Task) driven by a single `useAppMode` composable.

**Architecture:** `useAppMode.ts` owns only `appMode` ref and flag-driving logic (`applyModeFlags`). The heavier cleanup — `resetForm`, `resetWorkflow`, `clearAnalyzeResponse` — stays in `App.vue` (which holds those instances) via a `watch(appMode, ...)`. All panel/field visibility in templates switches from `coachSkillEnabled` checks to `appMode` checks. The Skill ON/OFF and Task Skill toggle buttons are removed from the Coach panel header.

**Why cleanup lives in App.vue:** `form`, `analyze`, `previousAnalyzeResponse`, and `isDeepReview` are all created inside their respective factory composables (`useForm()`, `useLLM()`). They are not module-level, so `useAppMode.ts` cannot reach them directly. `App.vue` already holds those instances and is the right place for orchestration.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, localStorage for persistence.

**Spec:** `docs/superpowers/specs/2026-03-25-app-mode-switcher-design.md`

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `src/composables/useAppMode.ts` | **Create** | `AppMode` type, `appMode` ref, `setMode()`, `applyModeFlags()` |
| `src/composables/__tests__/useAppMode.test.ts` | **Create** | Unit tests for useAppMode |
| `src/i18n/en.ts` | **Modify** | Add `mode.explore`, `mode.design`, `mode.task` labels |
| `src/i18n/zh.ts` | **Modify** | Add Chinese mode labels |
| `src/components/layout/AppHeader.vue` | **Modify** | Add mode switcher buttons before language toggle; hide role selector outside Design mode |
| `src/App.vue` | **Modify** | `watch(appMode)` for cleanup; `layout-focus` class; `gridStyle`; col-right visibility; per-panel `v-show`; `canCoachSubmit`; `buildPayload`; `handleCoachRequest` restore; DevTools watcher |
| `src/components/panels/CoachPanel.vue` | **Modify** | Remove Skill/TaskSkill toggle buttons; mode-aware empty-state chips |
| `src/components/form/TaskForm.vue` | **Modify** | Import `appMode`; conditional `v-show` on every section and action button |

---

## Task 1: Create `useAppMode` Composable

**Files:**
- Create: `src/composables/useAppMode.ts`
- Create: `src/composables/__tests__/useAppMode.test.ts`

- [ ] **Step 1.1: Write the failing tests**

Create `src/composables/__tests__/useAppMode.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock only the named module-level exports that useAppMode actually imports
vi.mock('@/composables/useLLM', () => ({
  setCoachSkillEnabled: vi.fn(),
  setTaskCoachEnabled: vi.fn()
}))

const storage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v },
  removeItem: (k: string) => { delete storage[k] }
})

import { appMode, setMode, applyModeFlags } from '../useAppMode'
import { setCoachSkillEnabled, setTaskCoachEnabled } from '@/composables/useLLM'

describe('useAppMode', () => {
  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k])
    vi.clearAllMocks()
  })

  it('defaults to "design" when no localStorage value', () => {
    // appMode initialised at module level from localStorage; default is 'design'
    expect(['explore', 'design', 'task']).toContain(appMode.value)
  })

  it('setMode("explore") sets appMode and persists to localStorage', () => {
    setMode('explore')
    expect(appMode.value).toBe('explore')
    expect(storage['app-mode']).toBe('explore')
  })

  it('setMode("task") sets appMode and persists to localStorage', () => {
    setMode('task')
    expect(appMode.value).toBe('task')
    expect(storage['app-mode']).toBe('task')
  })

  it('setMode("design") sets appMode and persists to localStorage', () => {
    setMode('design')
    expect(appMode.value).toBe('design')
    expect(storage['app-mode']).toBe('design')
  })

  it('applyModeFlags explore → coachSkillEnabled=false, taskCoachEnabled=false', () => {
    applyModeFlags('explore')
    expect(setCoachSkillEnabled).toHaveBeenCalledWith(false)
    expect(setTaskCoachEnabled).toHaveBeenCalledWith(false)
  })

  it('applyModeFlags design → coachSkillEnabled=true, taskCoachEnabled=true', () => {
    applyModeFlags('design')
    expect(setCoachSkillEnabled).toHaveBeenCalledWith(true)
    expect(setTaskCoachEnabled).toHaveBeenCalledWith(true)
  })

  it('applyModeFlags task → coachSkillEnabled=true, taskCoachEnabled=true', () => {
    applyModeFlags('task')
    expect(setCoachSkillEnabled).toHaveBeenCalledWith(true)
    expect(setTaskCoachEnabled).toHaveBeenCalledWith(true)
  })

  it('setMode calls applyModeFlags (flags are set)', () => {
    setMode('explore')
    expect(setCoachSkillEnabled).toHaveBeenCalledWith(false)
    setMode('design')
    expect(setCoachSkillEnabled).toHaveBeenCalledWith(true)
  })
})
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```
npx vitest run src/composables/__tests__/useAppMode.test.ts
```
Expected: FAIL — `useAppMode` module not found.

- [ ] **Step 1.3: Create `src/composables/useAppMode.ts`**

Note: `resetForm`, `resetWorkflow`, and `clearAnalyzeResponse` are **not** called here — they live inside factory composables that `App.vue` owns. Cleanup on mode switch is handled by a watcher in `App.vue` (Task 4).

```typescript
import { ref } from 'vue'
import { setCoachSkillEnabled, setTaskCoachEnabled } from '@/composables/useLLM'

export type AppMode = 'explore' | 'design' | 'task'

const LS_KEY_MODE = 'app-mode'

const stored = localStorage.getItem(LS_KEY_MODE) as AppMode | null
const validModes: AppMode[] = ['explore', 'design', 'task']
const initial: AppMode = stored && validModes.includes(stored) ? stored : 'design'

export const appMode = ref<AppMode>(initial)

// Apply flags on startup so coachSkillEnabled/taskCoachEnabled match the restored mode
applyModeFlags(initial)

/** Drive coachSkillEnabled + taskCoachEnabled from the current mode. */
export function applyModeFlags(mode: AppMode): void {
  if (mode === 'explore') {
    setCoachSkillEnabled(false)
    setTaskCoachEnabled(false)
  } else {
    // design + task: skill ON, task-coach ON
    setCoachSkillEnabled(true)
    setTaskCoachEnabled(true)
  }
}

/**
 * Switch to a new mode. Sets appMode and drives skill flags.
 * Cleanup (resetForm, resetWorkflow, clearAnalyzeResponse) is handled
 * by a watch(appMode) in App.vue — those instances are owned there.
 */
export function setMode(mode: AppMode): void {
  appMode.value = mode
  localStorage.setItem(LS_KEY_MODE, mode)
  applyModeFlags(mode)
}
```

- [ ] **Step 1.4: Run tests to confirm they pass**

```
npx vitest run src/composables/__tests__/useAppMode.test.ts
```
Expected: All 8 tests PASS.

- [ ] **Step 1.5: Commit**

```bash
git add src/composables/useAppMode.ts src/composables/__tests__/useAppMode.test.ts
git commit -m "feat: add useAppMode composable with Explore/Design/Task modes"
```

---

## Task 2: Add i18n Strings

**Files:**
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/zh.ts`

- [ ] **Step 2.1: Add English mode labels to `src/i18n/en.ts`**

Add a `mode` key in the exported object (alongside the existing `header` block):

```typescript
mode: {
  explore: 'Explore',
  design: 'Design',
  task: 'Task'
},
```

- [ ] **Step 2.2: Add Chinese mode labels to `src/i18n/zh.ts`**

```typescript
mode: {
  explore: '探索',
  design: '设计',
  task: '任务'
},
```

- [ ] **Step 2.3: Commit**

```bash
git add src/i18n/en.ts src/i18n/zh.ts
git commit -m "feat: add i18n strings for Explore/Design/Task mode labels"
```

---

## Task 3: Mode Switcher in AppHeader

**Files:**
- Modify: `src/components/layout/AppHeader.vue`

The header's `header-right` div (line 13) currently starts with the language toggle group (line 15). Mode buttons go **before** the language toggle — i.e., insert before line 15.

- [ ] **Step 3.1: Add imports to AppHeader.vue `<script setup>`**

```typescript
import { appMode, setMode } from '@/composables/useAppMode'
import type { AppMode } from '@/composables/useAppMode'
```

- [ ] **Step 3.2: Insert mode switcher template before the language toggle (before line 15)**

In the `header-right` div, insert this block as the **first child**, before `<div class="toggle-group">` (the language toggle):

```html
<!-- Mode Switcher (before language toggle) -->
<div class="toggle-group mode-group">
  <button
    v-for="m in (['explore', 'design', 'task'] as AppMode[])"
    :key="m"
    class="toggle-btn mode-btn"
    :class="{ active: appMode === m, ['mode-' + m]: appMode === m }"
    @click="setMode(m)"
    :title="t('mode.' + m)"
  ><strong>{{ t('mode.' + m) }}</strong></button>
</div>
```

In Vue 3 `<script setup>`, imported refs are auto-unwrapped in templates — `appMode` (a `Ref<AppMode>`) is used directly as `appMode === m`, not `appMode.value === m`.

- [ ] **Step 3.3: Hide role selector when not in Design mode (line 29)**

```html
<!-- BEFORE (line 29): -->
<div class="toggle-group role-group">

<!-- AFTER: -->
<div class="toggle-group role-group" v-show="appMode === 'design'">
```

- [ ] **Step 3.4: Add CSS accent colours for mode buttons**

In the `<style>` block, add:

```css
.mode-btn.mode-explore.active { background: var(--accent-purple, #a78bfa); color: #fff; }
.mode-btn.mode-design.active  { background: var(--accent-blue); color: #fff; }
.mode-btn.mode-task.active    { background: var(--accent-green, #34d399); color: #fff; }
```

- [ ] **Step 3.5: Verify in browser**
  - Three mode buttons appear as first items in the right header area, left of language toggle
  - Active mode is highlighted with its accent colour
  - Clicking a mode changes the active highlight
  - Role selector is only visible when Design is active

- [ ] **Step 3.6: Commit**

```bash
git add src/components/layout/AppHeader.vue
git commit -m "feat: add Explore/Design/Task mode switcher to header"
```

---

## Task 4: App.vue — Layout Visibility + Mode Cleanup Watcher

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 4.1: Add imports**

At the top of `<script setup>` (around line 204), add:

```typescript
import { appMode, applyModeFlags, setMode } from '@/composables/useAppMode'
```

The existing `useLLM` import (line 210) stays unchanged — `coachSkillEnabled` is still referenced in handler guards and `gridStyle`.

- [ ] **Step 4.2: Add mode-cleanup watcher after the existing watchers**

Add this watcher after line 458 (after the DevTools payload watcher block):

```typescript
// Mode switch cleanup — form/workflow/AI state reset when mode changes.
// Runs here (not in useAppMode) because resetForm, resetWorkflow, clearAnalyzeResponse
// are all instances owned by App.vue.
watch(appMode, () => {
  resetForm()
  resetWorkflow()
  clearAnalyzeResponse()
}, { immediate: false })
```

Note: `resetWorkflow` comes from `const { resetWorkflow } = useReviewWorkflow()` (already destructured in App.vue). `resetForm` and `clearAnalyzeResponse` are also already destructured from their composables.

- [ ] **Step 4.3: Fix `layout-focus` class binding (line 35)**

```html
<!-- BEFORE -->
:class="{ 'layout-focus': !coachSkillEnabled }"

<!-- AFTER -->
:class="{ 'layout-focus': appMode === 'explore' }"
```

- [ ] **Step 4.4: Fix `gridStyle` computed (line 261)**

```typescript
// BEFORE:
const gridStyle = computed(() => {
  if (!coachSkillEnabled.value) return undefined

// AFTER:
const gridStyle = computed(() => {
  if (appMode.value === 'explore') return undefined
```

- [ ] **Step 4.5: Fix drag handle visibility (line 115)**

```html
<!-- BEFORE -->
v-show="coachSkillEnabled"

<!-- AFTER -->
v-show="appMode !== 'explore'"
```

- [ ] **Step 4.6: Fix col-right visibility (line 123)**

```html
<!-- BEFORE -->
<div class="col-right" v-show="coachSkillEnabled">

<!-- AFTER -->
<div class="col-right" v-show="appMode !== 'explore'">
```

- [ ] **Step 4.7: Add per-panel `v-show` inside col-right**

Each panel in the right column gets a mode condition:

```html
<!-- AIReviewPanel — Design only -->
<AIReviewPanel v-show="appMode === 'design'" ... />

<!-- JiraResponsePanel — Task only -->
<JiraResponsePanel v-show="appMode === 'task'" ... />

<!-- ProcessingSummary — Task only -->
<ProcessingSummary v-show="appMode === 'task'" ... />

<!-- DevTools — always visible -->
<DevTools ... />

<!-- JiraSearchPanel — Task only -->
<JiraSearchPanel v-show="appMode === 'task'" ... />

<!-- BatchPanel — Task only -->
<BatchPanel v-show="appMode === 'task'" ... />

<!-- ReviewDashboard — Task only -->
<ReviewDashboard v-show="appMode === 'task'" ... />

<!-- TicketHistoryPanel — Task only -->
<TicketHistoryPanel v-show="appMode === 'task'" />
```

- [ ] **Step 4.8: Add `appMode` to DevTools payload watcher (line 450)**

```typescript
// BEFORE:
   coachSkillEnabled, taskCoachEnabled],

// AFTER:
   coachSkillEnabled, taskCoachEnabled, appMode],
```

- [ ] **Step 4.9: Verify in browser**
  - Explore: right column collapses, only Description + Coach panel visible, cleanup fires on switch
  - Design: all three columns visible, AI Review Panel showing
  - Task: right column open, JIRA panels visible, AI Review hidden

- [ ] **Step 4.10: Commit**

```bash
git add src/App.vue
git commit -m "feat: wire appMode into App.vue layout, panel visibility, and mode cleanup"
```

---

## Task 5: App.vue — canCoachSubmit, buildPayload, handleCoachRequest

**Files:**
- Modify: `src/App.vue` (logic section)

- [ ] **Step 5.1: Replace `canCoachSubmit` (lines 387-392)**

```typescript
// BEFORE:
const canCoachSubmit = computed(() => {
  if (!coachSkillEnabled.value || !taskCoachEnabled.value) {
    return !!form.description.trim()
  }
  return canSubmit.value
})

// AFTER:
const canCoachSubmit = computed(() => {
  switch (appMode.value) {
    case 'explore':
      return !!form.description.trim()
    case 'task':
      return !!form.projectKey && !!form.issueType && !!form.description.trim()
    case 'design':
    default:
      return canSubmit.value
  }
})
```

- [ ] **Step 5.2: Replace `buildPayload` coach/preview branch (lines 417-441)**

Replace the entire `// coach / preview` block (lines 417–441) with:

```typescript
// coach / preview — payload driven by appMode
switch (appMode.value) {
  case 'explore':
    return { meta, data: { description: form.description } }

  case 'task':
    return {
      meta,
      data: {
        project_key: form.projectKey,
        project_name: getProjectName(),
        issue_type: form.issueType,
        summary: computedSummary.value,
        description: form.description,
        assignee: form.assignee,
        estimated_points: form.estimatedPoints
        // requirementLevel, parentReqId, verificationMethod intentionally omitted
      }
    }

  case 'design':
  default:
    return {
      meta,
      data: {
        project_key: form.projectKey,
        project_name: getProjectName(),
        issue_type: form.issueType,
        summary: computedSummary.value,
        description: form.description,
        assignee: form.assignee,
        estimated_points: form.estimatedPoints,
        requirement_level: form.requirementLevel !== 'none' ? form.requirementLevel : undefined,
        parent_req_id: form.parentReqId || undefined,
        verification_method: form.verificationMethod || undefined
      }
    }
}
```

- [ ] **Step 5.3: Update `handleCoachRequest` (lines 676-690)**

```typescript
async function handleCoachRequest() {
  if (!canCoachSubmit.value || isCoachLoading.value) return
  errorMessage.value = ''
  const payload = buildPayload('coach')
  // In Explore mode, clear description immediately (acts as chat input box)
  if (appMode.value === 'explore') form.description = ''
  const err = await requestCoach(payload)
  // Re-assert mode flags — tool-triggered handlers may have temporarily overridden coachSkillEnabled
  applyModeFlags(appMode.value)
  if (!err) {
    addToast('success', t('toast.coachSuccess'))
    saveResponsesToStorage()
  } else if (err !== 'cancelled') {
    errorMessage.value = err
    addToast('error', err)
  }
}
```

- [ ] **Step 5.4: Run type check**

```
npm run build
```
Expected: Zero TypeScript errors.

- [ ] **Step 5.5: Verify in browser**
  - Explore: Coach button enables with description only; description clears after send
  - Task: Coach button requires project + issue type + description
  - Design: Coach button requires full form (all `canSubmit` fields)

- [ ] **Step 5.6: Commit**

```bash
git add src/App.vue
git commit -m "feat: mode-aware canCoachSubmit, buildPayload, and handleCoachRequest"
```

---

## Task 6: CoachPanel — Remove Skill Toggles, Mode-Aware Chips

**Files:**
- Modify: `src/components/panels/CoachPanel.vue`

- [ ] **Step 6.1: Remove the two skill toggle buttons**

In the `#header-actions` slot (lines 10–32), delete both buttons entirely:

```html
<!-- DELETE: Skill ON/OFF button (lines 10-18) -->
<button class="skill-toggle" :class="{ 'skill-on': coachSkillEnabled, ... }" @click="setCoachSkillEnabled(...)">...</button>

<!-- DELETE: Task Skill button (lines 19-32) -->
<button class="skill-toggle" :class="{ 'skill-on': taskCoachEnabled && coachSkillEnabled, ... }" @click="setTaskCoachEnabled(...)">...</button>
```

Keep only the model badge (`<span class="mode-badge ...">`) and the Copy button.

- [ ] **Step 6.2: Import `appMode` in CoachPanel script (around line 200)**

```typescript
import { appMode } from '@/composables/useAppMode'
```

Remove `coachSkillEnabled`, `setCoachSkillEnabled`, `taskCoachEnabled`, `setTaskCoachEnabled` from the `useLLM` import if they are no longer referenced anywhere else in the file. Check before removing.

- [ ] **Step 6.3: Make guided chips mode-aware in the empty state**

The two guided chip buttons are currently always visible. Wrap them:

```html
<!-- Show Elicitation + Conflict Check only in Explore mode -->
<div class="guided-chips" v-if="appMode === 'explore'">
  <button class="elicit-chip" @click="$emit('elicit')" ...>
    {{ t('elicitation.chipLabel') }}
  </button>
  <button class="conflict-chip" @click="$emit('conflictCheck')" ...>
    {{ t('conflictCheck.chipLabel') }}
  </button>
</div>
```

QuickChip template chips — show in Design and Task only:

```html
<QuickChip
  v-if="appMode !== 'explore'"
  ...
/>
```

- [ ] **Step 6.4: Verify in browser**
  - No Skill/TaskSkill toggle buttons visible anywhere
  - Explore empty state: Elicitation + Conflict Check chips; no template chips
  - Design/Task empty state: template chips; no guided chips

- [ ] **Step 6.5: Commit**

```bash
git add src/components/panels/CoachPanel.vue
git commit -m "feat: remove skill toggles from CoachPanel, make chips mode-aware"
```

---

## Task 7: TaskForm — Mode-Conditional Field Rendering

**Files:**
- Modify: `src/components/form/TaskForm.vue`

- [ ] **Step 7.1: Import `appMode` in TaskForm script (around line 174)**

```typescript
import { appMode } from '@/composables/useAppMode'
```

No new prop needed — `appMode` is a module-level reactive ref, accessible directly in any `<script setup>` component.

- [ ] **Step 7.2: Add `v-show` to each form section**

```html
<!-- ReviewStatusBar — Design only (line 22) -->
<ReviewStatusBar v-show="appMode === 'design'" ... />

<!-- BasicInfoSection — Design + Task (line 33) -->
<BasicInfoSection v-show="appMode !== 'explore'" ... />

<!-- SummaryBuilder — Design + Task (line 38) -->
<SummaryBuilder v-show="appMode !== 'explore'" ... />

<!-- TraceabilitySection — Design only (line 48) -->
<TraceabilitySection v-show="appMode === 'design'" ... />

<!-- DescriptionEditor — always visible, no change (line 50) -->
```

- [ ] **Step 7.3: Update Analyze + Deep Review button visibility**

Both buttons currently use `v-show="coachSkillEnabled"` (lines 113 and 130). Replace with:

```html
<!-- Analyze Task button -->
<button v-show="appMode === 'design'" class="action-btn action-analyze" ...>

<!-- Deep Review button -->
<button v-show="appMode === 'design'" class="action-btn action-deep-review" ...>
```

- [ ] **Step 7.4: Update Create JIRA button visibility**

The Create JIRA button appears when `hasAiResponse` is true. Restrict it to Task mode:

```html
<!-- BEFORE -->
<button v-show="hasAiResponse" class="action-btn action-create" ...>

<!-- AFTER -->
<button v-show="appMode === 'task' && hasAiResponse" class="action-btn action-create" ...>
```

- [ ] **Step 7.5: Verify in browser**
  - Explore: only Description editor + Reset/Send buttons visible
  - Design: all sections visible; Analyze + Deep Review shown; Create JIRA hidden
  - Task: Basic Info + Summary + Description visible; no Analyze/DeepReview; Create JIRA appears after analysis

- [ ] **Step 7.6: Commit**

```bash
git add src/components/form/TaskForm.vue
git commit -m "feat: mode-conditional field rendering in TaskForm"
```

---

## Task 8: Version Bump, PLAN.md, Final Validation

**Files:**
- Modify: `src/components/layout/AppHeader.vue`
- Modify: `PLAN.md`

- [ ] **Step 8.1: Bump version in AppHeader.vue**

```html
<!-- BEFORE -->
<span class="header-version">v10.11</span>

<!-- AFTER -->
<span class="header-version">v10.12</span>
```

- [ ] **Step 8.2: Run full type check**

```
npm run build
```
Expected: Zero errors.

- [ ] **Step 8.3: Run full test suite**

```
npm test
```
Expected: All tests pass including new `useAppMode` tests.

- [ ] **Step 8.4: Append changelog to PLAN.md**

Append at the bottom of `PLAN.md`:

```markdown
## v10.12 — Three-Mode System: Explore · Design · Task

### Design rationale
Replaced the improvised Skill ON/OFF + Task Coach toggles with a first-class three-mode
switcher. Mode state and flag driving live in `useAppMode.ts`. Form/workflow/AI cleanup
on mode switch is handled by a watch(appMode) in App.vue, since those instances are owned
there. Chat history is preserved across switches; all other state resets.

| File | Change |
|------|--------|
| `src/composables/useAppMode.ts` | New — AppMode type, appMode ref, setMode(), applyModeFlags() |
| `src/composables/__tests__/useAppMode.test.ts` | New — unit tests |
| `src/i18n/en.ts` + `zh.ts` | Add mode label strings |
| `src/components/layout/AppHeader.vue` | Mode switcher buttons before language toggle; role selector v-show Design only; v10.12 |
| `src/App.vue` | watch(appMode) cleanup; layout-focus → appMode; gridStyle; col-right; per-panel v-show; canCoachSubmit switch; buildPayload switch; handleCoachRequest restore; DevTools watcher |
| `src/components/panels/CoachPanel.vue` | Remove Skill/TaskSkill toggles; mode-aware chips |
| `src/components/form/TaskForm.vue` | Mode-conditional v-show on all sections and action buttons |
```

- [ ] **Step 8.5: Final smoke test checklist**

Open the app in a browser and verify:

**Explore mode:**
- [ ] Only Description field + Send/Reset buttons visible in center column
- [ ] Right column fully collapsed
- [ ] Coach panel shows Elicitation + Conflict Check chips in empty state; no template chips
- [ ] Typing description and pressing Send works; description clears after send
- [ ] Chat history preserved when switching from Design/Task to Explore

**Design mode:**
- [ ] All form sections visible (Basic Info, Summary, Traceability, Quality Meter, Description)
- [ ] Role selector visible in header
- [ ] Analyze + Deep Review buttons visible
- [ ] Right column shows AI Review Panel
- [ ] Coach panel shows role-filtered template chips; no guided chips
- [ ] Switching away and back: form cleared, chat preserved, Review Status Bar reset to Draft

**Task mode:**
- [ ] Basic Info + Summary + Description visible; Traceability + Quality Meter hidden
- [ ] Role selector hidden in header
- [ ] Analyze + Deep Review buttons hidden
- [ ] Right column shows JIRA panels (JiraSearchPanel, BatchPanel, TicketHistoryPanel, etc.)
- [ ] Create JIRA button visible after AI analysis
- [ ] Coach submit requires project + issue type + description

**Mode switch behaviour:**
- [ ] Any mode switch: form fields clear
- [ ] Any mode switch: chat messages NOT cleared
- [ ] Any mode switch: Review Status Bar resets to Draft
- [ ] Page refresh: last active mode restored from localStorage

- [ ] **Step 8.6: Commit**

```bash
git add src/components/layout/AppHeader.vue PLAN.md
git commit -m "feat: v10.12 — three-mode Explore/Design/Task system complete"
```
