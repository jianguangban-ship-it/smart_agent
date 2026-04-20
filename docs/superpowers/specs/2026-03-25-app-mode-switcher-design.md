# App Mode Switcher — Design Spec
**Date:** 2026-03-25
**Status:** Approved

---

## Overview

Replace the current improvised Skill ON/OFF + Task Coach ON/OFF toggles with a first-class three-mode system. Users activate their desired workflow via a dedicated mode switcher in the header. Each mode configures the entire app — visible panels, form fields, AI behavior — from a single source of truth.

---

## Modes

### Explore
Free-chat with AI. No system prompt, no form required. For brainstorming, conflict checking, open-ended Q&A.

- `coachSkillEnabled = false`
- `taskCoachEnabled = false`
- Only the description field and Coach panel are active
- Description is cleared after each submit (acts as a chat input box — same as current Skill-OFF behavior)

### Design
Requirement Engineering workflow. Full ASPICE V-cycle support with role selection (SYS, SWE, HWE, ME, V&V).

- `coachSkillEnabled = true`
- `taskCoachEnabled = true`
- All RE fields visible: traceability, quality meter, domain warnings, ASPICE/INCOSE validation
- Analyze + Deep Review buttons active
- Role selector visible

### Task
JIRA task coaching and ticket creation. Focused on implementation, bug fixing, and delivery work.

- `coachSkillEnabled = true`
- `taskCoachEnabled = true`
- Basic Info + Summary Builder + Description visible
- Create JIRA button visible
- RE-specific fields (traceability, quality meter, role selector) hidden

---

## Architecture

### New file: `src/composables/useAppMode.ts`

```ts
type AppMode = 'explore' | 'design' | 'task'

export const appMode = ref<AppMode>(stored ?? 'design')

export function setMode(mode: AppMode): void {
  appMode.value = mode
  localStorage.setItem(LS_KEY_MODE, mode)
  resetForm()              // clears all form fields including role (see Role Handling below)
  resetWorkflow()          // reset Review Status Bar + checklist state
  clearAnalyzeResponse()   // clear AI review panel output (analyze + deep review)
  // clearCoachResponse() is NOT called — chat history is preserved across mode switches
  applyModeFlags(mode)     // set coachSkillEnabled + taskCoachEnabled
}
```

`coachSkillEnabled` and `taskCoachEnabled` become internally driven by `useAppMode`. They are no longer toggled from the Coach header UI. The Skill ON/OFF and Task Skill buttons are removed from `CoachPanel.vue`.

### Mode flag matrix

| Mode    | `coachSkillEnabled` | `taskCoachEnabled` |
|---------|---------------------|--------------------|
| explore | `false`             | `false`            |
| design  | `true`              | `true`             |
| task    | `true`              | `true`             |

---

## UI Changes

### Header — Mode Switcher
Three buttons placed **left of the language toggle**, styled identically to the role-selection buttons. Active mode gets the same highlighted state as an active role.

```
[ Explore ]  [ Design ]  [ Task ]  |  [ EN/中 ]
```

### Left column — field visibility per mode

| Section                        | Explore | Design  | Task    |
|-------------------------------|---------|---------|---------|
| Role selector                 | hidden  | visible | hidden  |
| Basic Info (project/type/etc) | hidden  | visible | visible |
| Summary Builder               | hidden  | visible | visible |
| Traceability Section          | hidden  | visible | hidden  |
| Quality Meter                 | hidden  | visible | hidden  |
| Description Editor            | visible | visible | visible |
| Domain warnings / ASPICE      | hidden  | visible | hidden  |
| Analyze + Deep Review buttons | hidden  | visible | hidden  |
| Create JIRA button            | hidden  | hidden  | visible |

### Right column — panel visibility per mode

| Panel                          | Explore | Design  | Task    |
|-------------------------------|---------|---------|---------|
| AI Review Panel               | hidden  | visible | hidden  |
| JIRA Response / Processing    | hidden  | hidden  | visible |
| Review Status Bar             | hidden  | visible | hidden  |

### `layout-focus` CSS class

The current `:class="{ 'layout-focus': !coachSkillEnabled }"` collapses the right column (AI Review + JIRA panel) to 0fr. This binding is replaced with:

```ts
:class="{ 'layout-focus': appMode === 'explore' }"
```

- **Explore:** `layout-focus` applies — right column collapses. Form shows description-only; Coach panel remains.
- **Design:** no `layout-focus` — all three columns visible.
- **Task:** no `layout-focus` — right column remains open, showing JIRA Response panel (AI Review panel hidden via `v-show`).

### Coach Panel
Visible in all three modes. Empty-state chips adapt per mode:
- **Explore:** Elicitation + Conflict Check chips
- **Design:** Role-filtered template chips
- **Task:** Task-coaching chips

### Removed from CoachPanel header
- Skill ON/OFF toggle button
- Task Skill ON/OFF toggle button
- Model badge remains

---

## Mode Switching Sequence

```
User clicks mode button
  → setMode(newMode)
      ├── appMode.value = newMode        (persisted to localStorage)
      ├── resetForm()                    (all form fields cleared, including role)
      ├── resetWorkflow()                (Review Status Bar + checklist reset)
      ├── clearAnalyzeResponse()         (AI review output cleared)
      │   └── clearCoachResponse() NOT called — chat history preserved
      └── applyModeFlags(newMode)        (set coachSkillEnabled + taskCoachEnabled)
```

### Role Handling on Mode Switch

`resetForm()` calls `setRole('')` unconditionally. This is intentional:
- Switching to **Explore** or **Task**: role is irrelevant — reset is correct.
- Switching back to **Design**: user re-selects their role. Clean slate per session.

Role is **advisory** in Design mode — it is not required for `canCoachSubmit`. The AI uses role context from the system prompt if available, but a user may chat without selecting a role.

---

## `canCoachSubmit` Guard — Per-Mode Logic

Replace the current `!coachSkillEnabled || !taskCoachEnabled` flag-based guard with an `appMode`-driven switch:

```ts
const canCoachSubmit = computed(() => {
  switch (appMode.value) {
    case 'explore':
      // Only description required — acts as a chat input box
      return !!form.description.trim()
    case 'task':
      // Project + issue type + description required; summary fields are optional
      return !!form.projectKey && !!form.issueType && !!form.description.trim()
    case 'design':
      // Full form validation (existing canSubmit logic); role is advisory, not required
      return canSubmit.value
  }
})
```

Summary Builder fields are visible in Task mode but **not required** for coach submission — they are used if filled, allowing lightweight task coaching without full form completion.

---

## `buildPayload` — Per-Mode Payload

Replace the current `!skillOn || !taskCoachOn` branch with mode-aware logic:

```ts
// coach / preview
switch (appMode.value) {
  case 'explore':
    // No task context — description only
    return { meta, data: { description: form.description } }

  case 'task':
    // Task fields only — omit RE-specific fields to avoid empty noise
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
    // Full payload including RE fields (existing logic unchanged)
    return { meta, data: { ...allFields } }
}
```

---

## Tool-Triggered Requests Within Design Mode

Several handlers in Design mode (`handleElicitation`, `handleConflictCheck`, `handleSuggestLinks`, `handleImpactAnalysis`, `handleReplay`) call `setCoachSkillEnabled(false)` to temporarily bypass the `canSubmit` guard for tool-generated prompts.

**These calls are preserved.** After `handleCoachRequest()` completes, `applyModeFlags(appMode.value)` is called to restore the mode's canonical flag values — re-asserting `coachSkillEnabled = true` for Design/Task mode.

```ts
async function handleCoachRequest() {
  // ... existing logic ...
  const err = await requestCoach(payload)
  applyModeFlags(appMode.value)  // re-assert mode flags after any tool-triggered flag override
  // ...
}
```

This pattern is safe in all modes:
- **Design:** restores `coachSkillEnabled = true` after tool overrides it to `false`
- **Task:** same — restores `true` if a chip fires
- **Explore:** `coachSkillEnabled` already `false`; `applyModeFlags` is a no-op

---

## localStorage Behavior

`applyModeFlags()` calls `setCoachSkillEnabled(val)` which writes to the `coach-skill-enabled` localStorage key. This intentionally overrides any prior manual toggle value. The mode switcher is the authoritative source for skill flags. The prior manual Skill ON/OFF toggle is removed from the UI.

---

## DevTools Payload Watcher

The `jsonPayload` watcher (App.vue lines 447–458) currently watches `[coachSkillEnabled, taskCoachEnabled]`. After this change, add `appMode` to the watcher dependencies so the preview payload re-renders immediately on mode switch:

```ts
watch(
  [...existingDeps, appMode],
  () => { /* debounced buildPayload('preview') */ }
)
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/composables/useAppMode.ts` | **New** — `AppMode` type, `appMode` ref, `setMode()`, `applyModeFlags()` |
| `src/components/layout/AppHeader.vue` | Add Explore/Design/Task mode buttons left of language toggle; version bump |
| `src/App.vue` | Drive `layout-focus` from `appMode === 'explore'`; update `canCoachSubmit` to mode switch; update `buildPayload` coach/preview branch; add `applyModeFlags` restore in `handleCoachRequest`; drive panel/field `v-show` via `appMode`; add `appMode` to DevTools payload watcher |
| `src/components/panels/CoachPanel.vue` | Remove Skill ON/OFF + Task Skill toggle buttons; adapt empty-state chips per mode |
| `src/components/form/TaskForm.vue` | Conditional field rendering driven by `appMode` |
| `src/i18n/en.ts` + `zh.ts` | Add mode label strings (`explore`, `design`, `task`) |
| `PLAN.md` | Append changelog entry |
