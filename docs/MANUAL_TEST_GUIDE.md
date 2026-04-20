# AGec v10.73 — Manual Verification Test Guide

> **Format**: Each test case follows **Input → Action → Expected Output**.
> **Prerequisites**: Run `npm run dev` and open the app in a browser.
> Mark each case PASS PASS or FAIL FAIL as you go.

---

## TABLE OF CONTENTS
0.  [Test Guide Overview](#0-manual-test-guide-overview)
1.  [App Launch & Layout](#1-app-launch--layout)
2.  [Header Controls](#2-header-controls)
3.  [App Modes — Explore / Design / Task](#3-app-modes--explore--design--task)
4.  [Column Resizing](#4-column-resizing)
5.  [Basic Info Section](#5-basic-info-section)
6.  [Summary Builder (5-Part)](#6-summary-builder-5-part)
7.  [Quality Meter](#7-quality-meter)
8.  [Description Editor](#8-description-editor)
9.  [Domain Warnings & Validation](#9-domain-warnings--validation)
10. [Traceability Section](#10-traceability-section)
11. [Review Status Bar (5-Stage Pipeline)](#11-review-status-bar-5-stage-pipeline)
12. [Coach Panel — Empty State & Chips](#12-coach-panel--empty-state--chips)
13. [Coach Panel — Chat Flow](#13-coach-panel--chat-flow)
14. [Coach Panel — Streaming & Rate Limit](#14-coach-panel--streaming--rate-limit)
15. [Coach History Tab](#15-coach-history-tab)
16. [AI Review Panel — Analyze](#16-ai-review-panel--analyze)
17. [AI Review Panel — Deep Review](#17-ai-review-panel--deep-review)
18. [Diff View](#18-diff-view)
19. [JIRA Creation Flow](#19-jira-creation-flow)
20. [~~JIRA Response Panel~~ (Removed)](#20-jira-response-panel-removed-in-v1073)
21. [Processing Summary](#21-processing-summary)
22. [Ticket History Panel](#22-ticket-history-panel)
23. [JIRA Search Panel](#23-jira-search-panel)
24. [Batch Panel](#24-batch-panel)
25. [Review Dashboard](#25-review-dashboard)
26. [Export Functions](#26-export-functions)
27. [DevTools Panel](#27-devtools-panel)
28. [LLM Settings Modal](#28-llm-settings-modal)
29. [Hotkey Modal & Keyboard Shortcuts](#29-hotkey-modal--keyboard-shortcuts)
30. [Theme Toggle (Dark / Light)](#30-theme-toggle-dark--light)
31. [i18n — Bilingual (EN / ZH)](#31-i18n--bilingual-en--zh)
32. [Draft Persistence (localStorage)](#32-draft-persistence-localstorage)
33. [Form Reset](#33-form-reset)
34. [Skill Auto-Detection](#34-skill-auto-detection)
35. [Accessibility & Keyboard Nav](#35-accessibility--keyboard-nav)

---

## 0. Manual Test Guide Overview

35 test sections, 220+ individual test cases across (section 20 deprecated in v10.73):
| # | Section | Focus |
|---|---------|-------|
| 1–2 | App Launch, Header Controls | Layout, mode/language/role/URL toggles |
| 3 | App Modes | Explore / Design / Task — behavior, state reset, chat preservation |
| 4 | Column Resizing | Resize persistence |
| 5–10 | Basic Info, Summary Builder, Quality Meter, Description Editor, Validation, Traceability | Core form behavior (Design mode) |
| 11 | Review Status Bar | 5-stage pipeline (Draft → AI Reviewed → Peer Reviewed → Approved → Created) |
| 12–15 | Coach Panel | Empty state/chips, chat flow, streaming/rate-limit, history tab |
| 16–18 | AI Review Panel | Analyze, Deep Review, Diff view |
| 19–25 | JIRA Flow | Creation modal, ticket history (with creating/created badges), processing summary, search, batch, dashboard |
| 26–27 | Export, DevTools | Markdown/ReqIF/CSV export, debug state |
| 28–29 | LLM Settings Modal, Hotkey Modal | API config, skill editors, keyboard shortcuts |
| 30–35 | Theme, i18n, Draft Persistence, Reset, Skill Auto-Detection, Accessibility | Cross-cutting concerns |

> **Sections 5–11 and 16–18 apply to Design mode.** Sections 3b, 3c detail Explore and Task mode specifics. Where a section applies to all modes, it is noted inline.

---

## 1. App Launch & Layout

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 1.1 | Browser URL | Open `http://localhost:5173` | App loads. Header shows "AGec" logo + "v10.12". No console errors. |
| 1.2 | Initial page load (Design mode) | Inspect the header | Three colored dots left. Version badge. Mode switcher [Explore \| Design \| Task], Language, URL mode, status pulse, theme, help, settings on the right. |
| 1.3 | Initial page load (Design mode) | Check center column | TaskForm visible: ReviewStatusBar at top, BasicInfoSection, SummaryBuilder, DescriptionEditor, action buttons at bottom. |
| 1.4 | Initial page load (Design mode) | Check left column | CoachPanel visible with empty state: help icon, guidance text, and quick template chips (role-filtered). |
| 1.5 | Initial page load (Design mode) | Check right column | AIReviewPanel visible with empty state: "Waiting for AI Agent response…". Below it: DevTools. Other panels (TicketHistoryPanel, ProcessingSummary, JiraSearchPanel, BatchPanel, ReviewDashboard) are visible only in Task mode. |
| 1.6 | Switch to Explore mode | Check layout | Right column and its drag handle disappear. Layout becomes 2-column (coach + form). BasicInfoSection and SummaryBuilder hidden. |
| 1.7 | Switch to Task mode | Check layout | Right column reappears. TicketHistoryPanel, ProcessingSummary, JiraSearchPanel, BatchPanel, ReviewDashboard become visible. ReviewStatusBar and TraceabilitySection hidden. |

---

## 2. Header Controls

### 2a. Mode Switcher

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 2a.1 | Any state | Observe mode switcher | Three buttons: **Explore** (purple when active), **Design** (blue when active), **Task** (green when active). One is always highlighted. |
| 2a.2 | Mode = Design | Click "Explore" | Button highlights purple. Right column hides. Role selector disappears. Layout shifts to 2-column. |
| 2a.3 | Mode = Explore | Click "Design" | Button highlights blue. Right column reappears. Role selector reappears. Full 3-column layout restores. |
| 2a.4 | Mode = Design | Click "Task" | Button highlights green. Right column shows with JIRA-specific panels visible. ReviewStatusBar hides. |
| 2a.5 | Any mode | Refresh the page | Same mode restored (localStorage `app-mode`). |

### 2b. Language Toggle

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 2b.1 | Language = EN | Click "中文" button | All UI labels switch to Chinese. Form placeholders, section titles, button labels all in Chinese. |
| 2b.2 | Language = ZH | Click "EN" button | All UI labels switch back to English. |

### 2c. Role Selector

> **Only visible in Design mode.** Hidden in Explore and Task modes.

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 2c.1 | Mode = Design | Click "SYS" role button | SYS button highlights teal. Description placeholder changes to system-level hint. Coach template chips may update. |
| 2c.2 | Role = SYS | Click "SWE" button | SWE highlights green. Quality score recalculates with SW weights. ASPICE badge may change. |
| 2c.3 | Repeat | Click "HWE", "ME", "V&V" one by one | Each button highlights with its own color (orange, gray, purple). Placeholder, chips, ASPICE context update per role. |
| 2c.4 | Mode = Task | Observe header | Role selector is **not** visible. |

### 2d. URL Mode Toggle

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 2d.1 | Mode = TEST | Observe header | "TEST" button active. Orange pulsing status dot. |
| 2d.2 | Mode = TEST | Click "PROD" button | "PROD" becomes active with green pulsing dot. DevTools shows production URL. |
| 2d.3 | Mode = PROD | Click "TEST" button | Reverts to test mode. DevTools shows test URL. |

### 2e. Help Button

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 2e.1 | Any state | Click the help button (? icon) | New browser tab opens to the wiki page. |

### 2f. Settings Gear

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 2f.1 | Any state | Click the gear icon (⚙) | LLM Settings modal opens as full-screen overlay. See [Section 28](#28-llm-settings-modal). |

---

## 3. App Modes — Explore / Design / Task

### 3a. Explore Mode

> **Purpose:** Free-form AI chat. No form fields required. Description is the chat input box.

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 3a.1 | Switch to Explore | Observe center column | BasicInfoSection and SummaryBuilder hidden. DescriptionEditor visible. Quality Meter still visible. Analyze button hidden. Deep Review hidden. Create JIRA never appears. |
| 3a.2 | Explore mode | Observe Coach panel empty state | No chips shown. Guidance text only ("Free-form AI chat — ask anything"). |
| 3a.3 | Explore mode, description empty | Observe Writing Guidance button | Button is disabled — description must be non-empty to send. |
| 3a.4 | Explore mode | Type "What is INCOSE?" in description field, click Writing Guidance | Coach request fires. Description **clears** immediately after send (acts as chat input box). Coach response streams in. |
| 3a.5 | Explore mode, type another message | Click Writing Guidance again | Previous chat messages preserved. Description clears. New reply appended. |
| 3a.6 | Explore mode | Type description with INCOSE trigger words (e.g., "TBD" or "approximately") | INCOSE violation tags appear below the description field. |
| 3a.7 | Explore mode | Observe right column | Right column (AI Review panel, JIRA panels) is **not** visible. Only Coach + Form visible. |

### 3b. Design Mode — Regression Test

> **Design mode = the original RE workflow.** All sections 5–17 apply here. This checklist confirms nothing regressed.

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 3b.1 | Switch to Design | Observe center column | ReviewStatusBar, BasicInfoSection, SummaryBuilder, DescriptionEditor, TraceabilitySection all visible. |
| 3b.2 | Design mode | Observe header | Role selector visible. |
| 3b.3 | Design mode | Observe action buttons | Writing Guidance (orange ⚡), Analyze (blue 💡), Deep Review (purple 🛡) all present. |
| 3b.4 | Design mode | Fill all fields, run Analyze | AI Review Panel streams response. Review Status Bar advances Draft → AI Reviewed. |
| 3b.5 | Design mode | Complete peer review checklist, click Approve | Status advances to Approved. |
| 3b.6 | Design mode | Click Create JIRA (appears after Analyze) | JIRA creation modal opens. Full webhook payload shown. |

### 3c. Task Mode

> **Purpose:** Structured task creation with full-field validation gate. Coach → Analyze → Create JIRA sequence.

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 3c.1 | Switch to Task | Observe center column | BasicInfoSection, SummaryBuilder, DescriptionEditor visible. ReviewStatusBar and TraceabilitySection **hidden**. Deep Review button hidden. |
| 3c.2 | Task mode | Observe right column | TicketHistoryPanel, ProcessingSummary, JiraSearchPanel, BatchPanel, ReviewDashboard all visible. |
| 3c.3 | Task mode, form empty | Click Writing Guidance | Button disabled. All required fields (project, assignee, type, points, 5-part summary, description) must be filled. |
| 3c.4 | Task mode | Fill only description, leave others empty | Writing Guidance still disabled — task mode requires the full field set. |
| 3c.5 | Task mode | Fill all required fields (project, assignee, type, points, complete summary, description) | Writing Guidance button enables. |
| 3c.6 | Task mode, all fields filled | Click Writing Guidance | Coach request fires. Response streams. Description is **not** cleared (unlike Explore). |
| 3c.7 | Task mode, coach response received | Observe Analyze button | Analyze button is enabled (uses same full-field guard). |
| 3c.8 | Task mode | Click Analyze | AI Review Panel streams analysis. |
| 3c.9 | Task mode, analysis complete | Observe TaskForm | **Create JIRA** button appears (green fade-in). Analyze button dims. |
| 3c.10 | Task mode, analysis complete | Observe right column | Ticket History panel shows empty state or previous tickets. Create JIRA button in form is the trigger. |
| 3c.11 | Task mode | Click Create JIRA | Confirmation modal opens with full webhook payload. "Create Ticket" button sends request. |
| 3c.12 | Task mode, quality score with no role | Observe Quality Meter | Score calculated but may be lower than Design mode (no role-specific weights). No crash. Label shows appropriate tier. |

### 3d. Mode Switch — State Preservation

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 3d.1 | Design mode, form filled | Switch to Task | All form fields (project, assignee, type, points, summary, description) are **preserved**. |
| 3d.2 | Design mode, Analyze done | Switch to Task and back | AI Review panel response is **preserved**. Review Status Bar state is **preserved**. |
| 3d.3 | Any mode, active coach chat | Switch to any other mode | Coach conversation history is **preserved**. |
| 3d.4 | Explore mode with messages | Switch to Design and back | Chat history and description field both intact after round-trip. |

---

## 4. Column Resizing

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 4.1 | 3-column layout (Design or Task mode) | Click and drag the left vertical divider rightward | Coach panel widens, Form panel narrows. Resize is smooth and real-time. |
| 4.2 | After dragging left handle | Release mouse | Columns stay at new size. Refresh the page → columns restore to saved proportions (localStorage). |
| 4.3 | 3-column layout | Click and drag the right vertical divider leftward | Form panel widens, Review panel narrows. |
| 4.4 | Resize to extremes | Drag left handle far right | Columns have sensible minimum widths; content does not overflow or collapse. |
| 4.5 | Explore mode | Observe drag handles | Right drag handle is hidden. Only left drag handle (Coach | Form) is visible. |

---

## 5. Basic Info Section

> Visible in **Design** and **Task** modes. Hidden in Explore.

### 5a. Project Selector

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 5a.1 | Empty form | Click the Project dropdown | Dropdown opens showing all projects in "Name (Team)" format. |
| 5a.2 | Dropdown open | Select a project | Dropdown closes. Selected project displayed. Assignee list filters to team members. |
| 5a.3 | Project selected | Change to a different project | Assignee resets or filters to new team. |

### 5b. Assignee Combobox

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 5b.1 | Project selected | Click the Assignee input field | Dropdown opens with avatar circles (initials), names, IDs. |
| 5b.2 | Dropdown open | Type partial name (e.g., "zh") | List filters fuzzy-matching entries. |
| 5b.3 | Filtered list shown | Press ↓ twice, then Enter | Highlight moves; highlighted member selected. Dropdown closes. |
| 5b.4 | Dropdown open | Click outside | Dropdown closes without changing selection. |
| 5b.5 | Assignee selected | Clear and type new name | Previous selection clears. New fuzzy results shown. |

### 5c. Task Type

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 5c.1 | Any state | Observe type buttons | Story, Task, Bug, Epic, Subtask — each with a colored dot. |
| 5c.2 | Default | Click "Bug" | "Bug" gets active background. Previous type de-highlights. |
| 5c.3 | Type = Bug | Click "Story" | "Story" highlights, "Bug" de-highlights. |

### 5d. Story Points Picker

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 5d.1 | Any state | Observe Fibonacci buttons | Buttons: 1, 2, 3, 5, 8 plus custom input. |
| 5d.2 | No points selected | Click "5" | "5" highlights. Points = 5. "AI will verify" hint visible. |
| 5d.3 | Points = 5 | Click "8" | "8" highlights, "5" de-highlights. |
| 5d.4 | Any state | Type "42" in custom input | Custom value "42" accepted. Fibonacci buttons de-highlight. |
| 5d.5 | Custom input | Use arrow keys across Fibonacci buttons | Focus moves sequentially (roving tabindex). |

---

## 6. Summary Builder (5-Part)

> Visible in **Design** and **Task** modes. Hidden in Explore.

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 6.1 | All empty | Observe live preview | Placeholder "Please fill in the fields above…". Quality score = 0% / "Empty". |
| 6.2 | Empty | Select Vehicle → e.g., "L6006" | First bracket fills: `[L6006][...][...][...][...]`. Score increases. |
| 6.3 | Vehicle set | Select Product → e.g., "ADAS" | Preview: `[L6006][ADAS][...][...][...]`. Score increases. |
| 6.4 | Vehicle + Product | Select Layer → e.g., "Application" | Preview updates to 3 of 5 filled. |
| 6.5 | 3 fields set | Type Component → "CameraModule" | Preview: `[L6006][ADAS][Application][CameraModule][...]`. Counter "12 / 50". |
| 6.6 | Component field | Type 50 chars | Counter turns red at "50 / 50". Cannot type beyond 50. |
| 6.7 | 4 fields set | Type Detail → "Add object detection for pedestrians" | All 5 brackets filled. Quality score rises. |
| 6.8 | Detail field | Type 100 chars | Counter turns red at "100 / 100". |
| 6.9 | Full preview | Click Copy button next to preview | Summary string copied to clipboard. Paste to verify `[V][P][L][C][Detail]` format. |

---

## 7. Quality Meter

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 7.1 | Empty form | Observe meter | Score: "0%". Label: "Empty". Gray bar. |
| 7.2 | Fill all 5 summary fields | Observe | Score increases (40–60%). Label "Incomplete" or "Good". Orange bar. |
| 7.3 | Fill description (50+ words) | Observe | Score increases. Description adds bonus. |
| 7.4 | Fill all fields (project, assignee, type, points, summary, description) | Observe | Score 80–100%. Label "Good" or "Excellent". Green bar. |
| 7.5 | Description present | Type "approximately" or "TBD" | Score drops: warning −3 pts, error −5 pts, max penalty −15 pts. |
| 7.6 | Design mode, role set | Switch role SYS → SWE | Score recalculates with different role weights. |
| 7.7 | Task mode, no role set | Fill all fields | Score calculated with default/empty-role weights. No crash. Correct label shown. |

### INCOSE Violation Quick Reference

> **Source file:** `src/config/domain/incose.ts`

| Violation | Severity | Penalty | Trigger | Bilingual? |
|-----------|----------|---------|---------|------------|
| **Unambiguous** | Warning | −3 pts | Vague words: `approximately`, `sufficient`, `flexible`, `etc.`; ZH: `适当`, `大约`, `等等` | PASS |
| **Complete** | Error | −5 pts | Placeholder: `TBD`, `TBC`, `TODO`, `FIXME`; ZH: `待定`, `待确认`, `未定义` | PASS |
| **Atomic** | Warning | −3 pts | `and shall` / `or shall`, or `shall/must/should` ≥ 3× | FAIL EN only |
| **Verifiable** | Warning | −3 pts | Description ≥ 80 chars with no number+unit or threshold operator | FAIL EN only |
| **Traceable** | Warning | −3 pts | Description ≥ 100 chars with no requirement ID or source reference | FAIL EN only |

Penalty capped at −15 pts. Thresholds: ≥ 80% "Excellent" (green), ≥ 50% "Good" (orange), > 0% "Incomplete" (red), 0% "Empty" (gray).

---

## 8. Description Editor

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 8.1 | Empty description | Observe text area | Placeholder text (role-specific in Design; generic in Explore/Task). Counter: "0 words · 0 sentences". |
| 8.2 | Empty | Type "The system shall process sensor data within 10ms." | Counter: "8 words · 1 sentence". Auto-grows if needed. |
| 8.3 | Short text | Type 5 more sentences | Counter updates in real-time. |
| 8.4 | Filled | Select all and delete | Empty state. Counter: "0 words · 0 sentences". Placeholder reappears. |
| 8.5 | Design mode, switch role | Change SYS → HW | Placeholder updates to HW-specific hint. |
| 8.6 | Switch language | Toggle EN → ZH | Placeholder updates to Chinese. Counter labels switch to Chinese. |

---

## 9. Domain Warnings & Validation

> All four validation systems run reactively on every keystroke. Applies to all modes (DescriptionEditor always visible). Domain warnings and ASPICE suggestions are role-aware (Design mode with role set provides richest feedback).

### 9a. INCOSE Violations

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 9a.1 | Empty description | Observe | No violations shown. |
| 9a.2 | Type: "The system shall handle errors in an appropriate and flexible manner." | Observe | **Unambiguous** violation: orange tag, lists matched vague terms. |
| 9a.3 | Append "TBD" | Observe | Second violation: red **Complete** tag with slide-in animation. |
| 9a.4 | Remove "TBD" and vague words | Observe | Violations disappear one by one with slide-out animation. |

### 9b. ASPICE Suggestions

> Only active in **Design mode** when role + task type match a known entry.

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 9b.1 | Design, role = SWE, type = Story | Observe below description | Blue "ASPICE" badge with field chips. Required fields: orange border + `*`. Optional: gray. |
| 9b.2 | Role = SWE, type = Story | Switch role to SYS | Suggestions update to SYS.2 fields immediately. |

### 9c. Assumption Detection

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 9c.1 | Any role | Type: "After initialization is complete, the system shall process data." | Purple **Dependency** badge + suggestion to add specific component or requirement ID. |
| 9c.2 | Assumption visible | Remove "After" or add explicit component name | Assumption disappears. |

### 9d. Domain Warnings

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 9d.1 | Design, role = SYS or HW | Type description with "safety" or "fault" but no ASIL level | Warning: "Safety-related content detected but no ASIL level specified". |
| 9d.2 | Design, role = V&V | Type description > 20 chars with no verification method keyword | Warning: "No verification method specified". |

### Section 9 — Validation Engine Quick Reference

#### 9a. INCOSE — `src/config/domain/incose.ts`

| Rule | Severity | Trigger | Min length |
|------|----------|---------|------------|
| Atomic | Warning | `and shall` / `or shall`, OR `shall/must/should` ≥ 3× | none |
| Complete | **Error** | `TBD`, `TBC`, `TODO`, `FIXME`, `待定`, `未定义` etc. | none |
| Unambiguous | Warning | Vague EN/ZH words | none |
| Verifiable | Warning | No number+unit or threshold operator | ≥ 80 chars |
| Traceable | Warning | No requirement ID or source reference | ≥ 100 chars |

#### 9b. ASPICE — `src/config/domain/aspice.ts`

| Role | Type | Process | Required fields (orange `*`) |
|------|------|---------|------------------------------|
| SYS | Story | SYS.2 | Parent req ID, ASIL level, Verification method, Acceptance criteria |
| SWE | Story | SWE.1 | Parent system req ID, Acceptance criteria, Input/output spec |
| SWE | Task | SWE.3 | Linked software req ID, Design element ref, Unit test ref |
| SWE | Bug | SWE.6 | Defect ID / trace ref, Root cause, Regression test ref |

#### 9c. Assumption Detection — `src/config/domain/assumptions.ts`

> Minimum description: **30 chars**. Edit `ASSUMPTION_RULES` to add/remove rules.

| Rule ID | Category | Roles | Fires when… | Suppressed when… |
|---------|----------|-------|-------------|-----------------|
| `implicit-memory` | Resource | SWE, HW | `buffer`, `cache`, `queue` etc. | memory size (e.g. `512KB`) present |
| `implicit-timing` | Timing | SYS, SWE, V&V | `real-time`, `periodic`, `timer`, `callback` etc. | timing value (e.g. `10ms`) present |
| `implicit-concurrency` | Concurrency | SWE | `thread`, `mutex`, `shared`, `semaphore` etc. | always fires if keyword present |
| `implicit-protocol` | Communication | SYS, SWE, HW | `send`, `receive`, `message`, `transmit` etc. | protocol name (`CAN`, `LIN`, `Ethernet`…) present |
| `implicit-power` | Power | SYS, HW, ME | `sleep`, `standby`, `power-on`, `low-power` etc. | voltage/current value (e.g. `3.3V`) present |
| `implicit-temp` | Temperature | HW, ME | `thermal`, `temperature`, `hot`, `freeze` etc. | temperature range (e.g. `-40°C`) present |
| `implicit-dependency` | Dependency | All | `after`, `before`, `depends on`, `requires`, `assumes` | explicit component/REQ ID present |
| `implicit-config` | Configuration | SWE, SYS | `parameter`, `threshold`, `default`, `setting` etc. | default value or range present |

#### 9d. Domain Warnings — `src/config/domain/index.ts` (`WARNING_RULES`)

| Rule ID | Roles | Fires when… | Suppressed when… | Min length |
|---------|-------|-------------|-----------------|------------|
| `missing-asil` | SYS, HW | Safety keywords (`safety`, `fault`, `hazard`) found | ASIL level present | none |
| `missing-verify-method` | V&V | No verification method keyword | `test`, `analysis`, `review`, `HIL/SIL` present | > 20 chars |
| `missing-traceability` | SYS, V&V | No traceability reference | `REQ-`, `parent`, `trace`, `derived` present | > 50 chars |
| `missing-interface-spec` | HW | Interface keywords found | Quantitative spec present | > 50 chars |
| `missing-thermal` | ME | No thermal/IP content | `thermal`, `temperature`, `IP54` etc. present | > 50 chars |

---

## 10. Traceability Section

> Visible in **Design mode only**.

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 10.1 | Initial state | Observe section | Three fields: Requirement Level (default "—"), Parent Requirement (empty), Verification Method (default "—"). No action buttons. |
| 10.2 | Level = "—" | Select a level (e.g., "System Requirement") | Dropdown shows levels with ASPICE IDs. "Suggest Links" and "Impact Analysis" buttons appear. |
| 10.3 | Level set | Type parent req ID: "SYS-REQ-042" | Text appears in input. |
| 10.4 | Level set | Select verification method → "Test" | Dropdown selects "Test / 测试". |
| 10.5 | Level set | Click "Suggest Links" | Loading state in Coach Panel → streams AI traceability suggestion. Description prepended with context. |
| 10.6 | Level set | Click "Impact Analysis" | Same: Coach streams impact analysis (upstream/downstream/test/safety). Description prepended. |
| 10.7 | Level = "—" | Observe buttons | "Suggest Links" and "Impact Analysis" **not** visible. |
| 10.8 | Level set, parent empty | Observe gap warnings | Warning: "No parent requirement linked". Orange background. |
| 10.9 | Level = System, verification empty | Observe gap warnings | Warning: "No verification method specified — required for ASPICE compliance". |
| 10.10 | Level = Test Case, parent empty | Observe gap warnings | Warning: "Test case has no linked requirement". |
| 10.11 | Role = SYS | Switch role to SWE | Requirement Level auto-updates to SWE default. |

---

## 11. Review Status Bar (5-Stage Pipeline)

> Visible in **Design mode only**.

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 11.1 | Initial state | Observe status bar | 5 circles connected by lines. "Draft" active (glowing). Others muted gray. |
| 11.2 | Run Analyze (after filling form) | Observe after analysis | "Draft" → completed (green checkmark). "AI Reviewed" active (glowing). Line turns green. |
| 11.3 | Status = AI Reviewed | Observe below bar | Peer review checklist with checkbox items and progress "0%". |
| 11.4 | Checklist visible | Check one item | Progress updates (e.g., "33%"). |
| 11.5 | Partially checked | Check all items to 100% | "Approve" button appears (green). |
| 11.6 | All checked | Click "Approve" | "Peer Reviewed" → completed. "Approved" active. Checklist disappears. |
| 11.7 | After JIRA creation | Observe | "Created" active/completed. Full pipeline green. |

---

## 12. Coach Panel — Empty State & Chips

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 12.1 | No chat messages (any mode) | Observe coach panel | Empty state: help icon, title "Get AI guidance…", subtitle text. |
| 12.2 | **Explore mode**, empty state | Observe chips | No chips shown. Empty state only shows guidance text. |
| 12.3 | **Design mode**, empty state | Observe chips | **Elicitation** chip and **Conflict Check** chip shown. No template chips. |
| 12.3a | **Task mode**, empty state | Observe chips | Template chips shown (role-filtered). No Elicitation/Conflict chips. |
| 12.4 | Role = SYS (Design mode) | Observe template chips | Chips filtered for SYS role. |
| 12.5 | Switch to SWE (Design mode) | Observe chips | Chip set may change to SWE-relevant options. |
| 12.6 | **Design mode** | Click "Requirement Elicitation" chip | Description is **overwritten** with the role-specific elicitation prompt. Coach transitions to chat view. AI begins structured Q&A. |
| 12.7 | Paste 2–3 requirements into Description, then **Design mode** | Click "Conflict Check" chip | Description updated to conflict analysis instructions + `---` separator + original text. Coach streams conflict analysis. |
| 12.8 | **Design/Task mode** | Click a template chip | Description updated with chip's template content. Coach request triggers. |

---

## 13. Coach Panel — Chat Flow

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 13.1 | Form ready (Design: all fields; Task: all fields; Explore: description only) | Click "Writing Guidance" (⚡ orange) | Coach transitions to chat. User bubble appears. Typing indicator (avatar + dots). |
| 13.2 | Typing indicator visible | Wait | Response streams token by token. Footer: green cursor + "X tok/s". |
| 13.3 | Streaming complete | Observe | User bubble (right, blue) + Assistant bubble (left, green avatar). Markdown + math rendered. Copy button visible. |
| 13.4 | Chat active | Send another message | New user + assistant bubbles appended. Chat scrolls to bottom. |
| 13.5 | Multiple messages | Scroll up | Previous messages visible. Smooth scroll. |
| 13.6 | Chat active | Click Copy button in Coach header | Last assistant message text copied to clipboard. |
| 13.7 | **Explore mode** after send | Observe description field | Description is **empty** (cleared after send). Chat shows the sent message as a bubble. |
| 13.8 | **Design/Task mode** after send | Observe description field | Description is **preserved**. Not cleared. |

---

## 14. Coach Panel — Streaming & Rate Limit

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 14.1 | Streaming active | Click Reset (■ stop icon, red) | Stream cancels. Partial response stays. "Retry" button appears with 2s cooldown. Icon reverts to ↺. |
| 14.2 | Retry visible | Wait 2 seconds | Button changes: "2s" → "1s" → "Retry". |
| 14.3 | Retry ready | Click "Retry" | Coach re-sent. Typing indicator reappears. |
| 14.4 | Trigger 429 (many rapid requests) | Observe | Clock icon + "Rate limited — retrying in **10s**". Countdown: 10, 9, 8… |
| 14.5 | Backoff active | Click "Cancel auto-retry" | Countdown stops. Retry button appears. |
| 14.6 | Backoff active | Let countdown reach 0 | Auto-retry fires automatically. |

---

## 15. Coach History Tab

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 15.1 | After coach conversations | Click "History" tab | Records shown: role badge (User blue / Coach green), timestamp, hash ID (#XXXXX), 150-char preview. |
| 15.2 | History visible | Type "sensor" in search box | Filters to matching records. |
| 15.3 | History visible | Change role filter → "User" | Only user messages shown. |
| 15.4 | History visible | Change role filter → "Coach" | Only coach messages shown. |
| 15.5 | History visible | Change role filter → "All" | All messages shown. |
| 15.6 | History visible | Click checkbox on 2 records | Both highlighted. "2 selected" count. Delete button appears. |
| 15.7 | 2 selected | Click "Select All" | All selected. Count = total. |
| 15.8 | All selected | Click "Select All" again | All deselected. Count = 0. |
| 15.9 | 2 selected | Click Delete | ConfirmDialog: "Are you sure you want to delete 2 selected records?" |
| 15.10 | Confirm dialog | Click "Cancel" | Dialog closes. Records remain. |
| 15.11 | Confirm dialog | Click "Confirm" | 2 records removed. |
| 15.12 | History exists | Click Download | DownloadModal: record count + format options (JSON / Markdown / Both). |
| 15.13 | Download modal | Select "JSON" + confirm | `.json` file downloads with structured chat data. |
| 15.14 | Download modal | Select "Markdown" + confirm | `.md` file with human-readable transcript. |
| 15.15 | Download modal | Select "Both" + confirm | Both files download. |
| 15.16 | History exists | Click "Clear All" | ConfirmDialog: permanently delete all N records. |
| 15.17 | Clear confirm | Click "Confirm" | All history cleared. Empty state: "No history records yet". |
| 15.18 | User message in history | Click Replay (↻) | Message loaded into description and re-sent. New conversation starts. |

---

## 16. AI Review Panel — Analyze

> Available in **Design** and **Task** modes.

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 16.1 | **Design:** all fields filled. **Task:** all fields filled (project+assignee+type+points+summary+description). | Click "Analyze Task" (💡 blue) | Button shows spinner. Review panel: purple spinner + "AI is analyzing…" + cancel. |
| 16.2 | Streaming | Observe panel | Markdown streams in. Footer: green cursor + "X tok/s". |
| 16.3 | Streaming | Click Cancel | Stream stops. Partial response shown. Retry button appears. |
| 16.4 | Complete | Observe panel | Full markdown rendered: headings, bullets, code blocks, math. Model badge. Copy button. |
| 16.5 | Complete | Click Copy | Analysis copied to clipboard. |
| 16.6 | Complete | Observe TaskForm — **Design mode** | "Create JIRA" button appears (green fade-in). Analyze and Deep Review dim. |
| 16.7 | Complete | Observe TaskForm — **Task mode** | "Create JIRA" button appears. Analyze dims. Deep Review not shown. |
| 16.8 | Complete (Design) | Observe Review Status Bar | Advances Draft → AI Reviewed. Peer review checklist appears. |

---

## 17. AI Review Panel — Deep Review

> Available in **Design mode only**.

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 17.1 | Design, form filled | Click "Deep Review" (🛡 purple) | Button shows spinner. Review panel loading state. |
| 17.2 | Deep review complete | Observe panel | Perspective tabs: "All Perspectives", "Safety", "Testability", "Implementability", "Completeness". |
| 17.3 | Tabs visible | Click "Safety" | Content filters to Safety section only. |
| 17.4 | Safety active | Click "Testability" | Switches to Testability section. |
| 17.5 | Tab active | Click "All Perspectives" | Full content restored. |
| 17.6 | Complete | Observe TaskForm | "Create JIRA" appears. Status advances. |

---

## 18. Diff View

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 18.1 | Run Analyze once | Observe Diff button | Diff button **not** visible (no previous response). |
| 18.2 | Modify description, run Analyze again | Observe | "Diff" toggle button appears in Review panel header. |
| 18.3 | Diff button visible | Click "Diff" | Word-level diff: additions green, removals red. |
| 18.4 | Diff mode | Click "Normal" | Reverts to normal markdown. |

---

## 19. JIRA Creation Flow

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 19.1 | AI analysis exists | Click "Create JIRA" (✓ green) | Confirmation modal: "Confirm JIRA Creation", JsonViewer payload, Cancel + "Create Ticket". |
| 19.2 | Modal open | Inspect payload | Contains: projectKey, summary, description, issueType, assignee, estimatedPoints, AI analysis. |
| 19.3 | Modal open | Click "Cancel" | Modal closes. No JIRA created. |
| 19.4 | Modal open | Click "Create Ticket" | Modal closes. Button shows spinner. Request sent to webhook (TEST or PROD). |
| 19.5 | Modal open | Click dark overlay | Modal closes (same as Cancel). |
| 19.6 | JIRA creation succeeds | Observe | Toast success. Ticket History shows green "Created" badge + new entry with clickable JIRA key. ProcessingSummary shows score card. Status advances to "Created". |
| 19.7 | JIRA creation fails | Observe | Toast error. Error banner at top of TaskForm with close (X) button. |

---

## 20. ~~JIRA Response Panel~~ (Removed in v10.73)

> **Removed.** The "Creating" indicator and "Created" badge are now in the **Ticket History Panel** (section 22). JIRA response data is available in DevTools (section 27).
>
> All test cases from this section have been migrated to section 22.

---

## 21. Processing Summary

> Visible in **Task mode** after successful JIRA creation.

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 21.1 | After successful JIRA creation | Observe | Score card: original points (strikethrough) → AI-corrected points (green bold). Subtask count. Clickable ticket link. |
| 21.2 | Ticket link visible | Click | Opens `https://jira.gwm.cn/browse/TICKET-XXX` in new tab. |

---

## 22. Ticket History Panel

> Visible in **Task mode**. Now also shows "Creating" progress (formerly in JIRA Response Panel).

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 22.1 | No tickets created | Observe panel | "No tickets created yet" empty state. Panel collapsed by default. |
| 22.2 | Click "Create JIRA" → confirm | Observe panel header | Panel auto-opens. Yellow **"Creating"** badge appears with a mini spinner next to the title. |
| 22.3 | JIRA creation in progress | Observe badge | Yellow badge shows "Creating JIRA ticket…" (localized). Spinner animates continuously. |
| 22.4 | JIRA creation succeeds | Observe badge transition | Yellow "Creating" badge fades out, green **"Created"** badge fades in (smooth `out-in` transition). |
| 22.5 | After creating a ticket | Observe entry list | New entry: blue JIRA key (link), summary, project badge, type badge, relative time. Entry has green highlight border. |
| 22.6 | Multiple tickets | Observe | Most recent at top. Up to 20 entries. |
| 22.7 | Entry visible | Click the JIRA key | Opens `https://jira.gwm.cn/browse/TICKET-XXX` in new tab. |
| 22.8 | History exists | Click Clear | All entries removed. Empty state returns. Both badges hidden. |
| 22.9 | JIRA creation fails | Observe | Yellow "Creating" badge disappears (no green badge). Toast shows error. Panel stays open. |

---

## 23. JIRA Search Panel

> Visible in **Task mode**.

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 23.1 | Initial state | Observe | Search input with placeholder. Search button (magnifying glass). Quick-action buttons: Duplicates (orange), Parent Reqs (blue), Sprint (green). |
| 23.2 | Empty input | Click Search | Button disabled. |
| 23.3 | Type "camera" | Press Enter or Search | Spinner. Results as cards: key, status, summary, assignee. |
| 23.4 | Results visible | Click a card | Emits `selectResult` event. |
| 23.5 | Summary filled | Click "Duplicates" | Duplicate check runs. High similarity (>70%) flagged orange. |
| 23.6 | Duplicates found | Observe | Orange warning banner: "Potential duplicate tickets detected". |
| 23.7 | Any state | Click "Parent Reqs" | Searches for parent requirement candidates. |
| 23.8 | Any state | Click "Sprint" | Fetches sprint/release context. Badge: "Sprint: NAME · Release: NAME". |
| 23.9 | Search fails | Observe | Error message below search input. |

---

## 24. Batch Panel

> Visible in **Task mode**.

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 24.1 | Initial state | Observe | "Batch Operations" header. Count badge "0". Import (↑), Add Current (+), Clear (×). |
| 24.2 | Form filled | Click "Add Current" (+) | Snapshot added to batch. Count "1". Card: level badge, type, quality score, summary. |
| 24.3 | 1 item | Click "Add Current" again (modified form) | Count "2". New card. |
| 24.4 | Items in batch | Click Import (↑) | CSV area expands: text area, file picker, Import button. |
| 24.5 | Import area | Paste CSV: `Summary,Description,Type\n"Fix login bug","User cannot login",Bug` | Text in area. Import button enabled. |
| 24.6 | CSV pasted | Click "Import" | Items parsed and added. Toast: "Imported N items". |
| 24.7 | Import area | Click "Choose File" + select .csv | File contents load into text area. |
| 24.8 | Items | Click checkbox on first | Item selected. "1 selected". "Bulk Analyze" appears. |
| 24.9 | Items | Click "Select All" | All selected. |
| 24.10 | Items selected | Click "Bulk Analyze" | First selected item loads into form; analyze triggered. |
| 24.11 | Item card | Click remove (×) on item | Item removed. Count decreases. |
| 24.12 | Items | Click Clear (×) in header | All items removed. Count "0". |

---

## 25. Review Dashboard

> Visible in **Task mode**.

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 25.1 | No reviews done | Observe | Total Reviews = 0, Approval Rate = 0%, Avg Quality Score = 0. No chart. |
| 25.2 | After AI analyses + approvals | Observe | Counts and rates updated. Color: green ≥80%, orange ≥50%, red <50%. |
| 25.3 | Multiple reviews with failures | Observe bar chart | "Top Failed Checks": horizontal bars, most common failures, width proportional to frequency. |
| 25.4 | Stats visible | Click "Clear" | All stats reset to 0. Chart disappears. |

---

## 26. Export Functions

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 26.1 | Form filled (all fields, Design mode) | Observe Export button | Gray export icon next to Reset button. |
| 26.2 | Export button | Click | Dropdown: "Markdown", "ReqIF", "Excel CSV". |
| 26.3 | Menu open | Click "Markdown" | `.md` file downloads. Contains structured requirement with all fields. |
| 26.4 | Menu open | Click "ReqIF" | `.reqif` (XML) file. Valid OMG ReqIF structure. |
| 26.5 | Menu open | Click "Excel CSV" | `.csv` file. 18 columns covering all form fields, summary parts, traceability, quality score. |
| 26.6 | Form incomplete (canSubmit = false) | Observe Export button | Export button **not** visible. |

---

## 27. DevTools Panel

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 27.1 | Initial state | Observe DevTools | Multiple collapsible `<details>` sections. All collapsed by default. |
| 27.2 | Expand "Request Payload" | Click header | JSON tree of last request. Empty if no request yet. |
| 27.3 | After coach interaction | Expand "Coach Response (Raw)" | Raw last assistant message. Copy, Expand All, Collapse All buttons. |
| 27.4 | Raw visible | Click Copy | Raw text copied. |
| 27.5 | Expand "Active Webhook Config" | Observe | Mode: "Production" (green) or "Testing" (orange). Active URL in monospace. |
| 27.6 | Toggle TEST → PROD | Check DevTools | URL and mode label update immediately. |
| 27.7 | Expand "Agent State" | Observe | Model name, active role (colored), active skill, skill modified, streaming status. |
| 27.8 | During coach streaming | Check Agent State | "Coach Streaming: Yes" with tok/s. |
| 27.9 | After role change | Check Agent State | "Active Role" updates. |

---

## 28. LLM Settings Modal

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 28.1 | Any state | Click gear icon | Full-screen modal: Provider URL, API Key, Model Name, Coach Skill, Analyze Skill, Response Format, Template Chips, Export/Import. |
| 28.2 | Modal open | Press Escape | Modal closes. |

### 28a. API Configuration

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 28a.1 | Provider URL field | Type a URL | Accepted. |
| 28a.2 | API Key field | Type a key | Password input (dots). |
| 28a.3 | Key entered | Click "Test" | "Testing…" → "Key valid" (green ✓) or "Key invalid" (red ✗). |
| 28a.4 | Model Name field | Click input | Datalist shows model presets (e.g., glm-4.7-flash, gpt-4o). |
| 28a.5 | Model field | Type "gpt-4o" | Value accepted. |

### 28b. Skill Editors

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 28b.1 | Coach Skill section | Observe | Text area with current system prompt. Character + token counter. |
| 28b.2 | Text area | Edit prompt | "modified" badge in section header. Counter updates. |
| 28b.3 | Modified | Click "Reset to Default" | Prompt reverts. "modified" badge gone. |
| 28b.4 | Text area | Click "Export .md" | `.md` file with skill prompt text. |
| 28b.5 | Any | Click "Import .md" + select file | File content loaded. |
| 28b.6 | Repeat | Test Analyze Skill section | Same behavior. |

### 28c. Response Format

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 28c.1 | Response Format section | Observe | Text area (160px). Reset button. |
| 28c.2 | Edit | Modify content | "modified" badge. Counter updates. |
| 28c.3 | Modified | Click "Reset" | Reverts to default. |

### 28d. Template Chip Editor

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 28d.1 | Template section | Observe | List of chips. Each row: icon, labels, move/delete buttons. |
| 28d.2 | Row | Click move-up | Moves up. |
| 28d.3 | Row | Click move-down | Moves down. |
| 28d.4 | Row | Click delete (×) | Row removed. |
| 28d.5 | Row | Click to expand | Edit form: icon, label ZH/EN, content ZH/EN text areas. |
| 28d.6 | Edit form | Modify labels and content | Changes reflected in preview. |
| 28d.7 | Bottom | Click "+ Add Chip" | New empty row added, edit form expanded. |
| 28d.8 | Templates | Click "Export .json" | `.json` with template definitions. |
| 28d.9 | Templates | Click "Import .json" + file | Templates loaded, replacing current list. |
| 28d.10 | Modified | Click "Reset to Defaults" | All templates revert to built-in defaults. |

### 28e. Settings Export / Import

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 28e.1 | Settings configured | Click "Export Settings" | `.json` with all settings. |
| 28e.2 | Fresh state | Click "Import Settings" + select file | All settings restored. |

### 28f. Save / Cancel

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 28f.1 | Changes made | Click "Save" | Modal closes. Settings persisted to localStorage. |
| 28f.2 | Changes made | Click "Cancel" | Modal closes. Changes discarded. |

---

## 29. Hotkey Modal & Keyboard Shortcuts

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 29.1 | Any state, no modal | Press `?` | Hotkey modal opens showing shortcut table. |
| 29.2 | Modal open | Read table | Shortcuts: Ctrl+Enter, Ctrl+Shift+Enter, Ctrl+Shift+C, Ctrl+,, Escape, ?. |
| 29.3 | Modal open | Press Escape | Modal closes. |
| 29.4 | Form ready, no modal | Press Ctrl+Enter | "Writing Guidance" triggered. |
| 29.5 | Form ready, no modal | Press Ctrl+Shift+Enter | "Analyze Task" triggered. |
| 29.6 | AI analysis exists | Press Ctrl+Shift+C | "Create JIRA" confirmation modal opens. |
| 29.7 | Any state | Press Ctrl+, | LLM Settings modal opens. |

---

## 30. Theme Toggle (Dark / Light)

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 30.1 | Default | Observe | Dark background, light text. Moon icon in header. |
| 30.2 | Dark | Click theme toggle (moon) | Entire UI switches to light theme. Button changes to sun. All panels, dropdowns respect light colors. |
| 30.3 | Light | Click toggle (sun) | Reverts to dark. |
| 30.4 | Set to light | Refresh page | Light theme persists (localStorage). |

---

## 31. i18n — Bilingual (EN / ZH)

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 31.1 | Language = EN | Inspect major elements | All labels in English: "Writing Guidance", "Analyze Task", "Quality Score", etc. |
| 31.2 | Switch to ZH | Inspect | All labels in Chinese: buttons, section titles, placeholders, tooltips, INCOSE messages, ASPICE suggestions. |
| 31.3 | ZH mode | Type: "横向加速度$a_y$的估计值" | Renders correctly. Math adjacent to Chinese characters works. INCOSE checks work on Chinese. |
| 31.4 | ZH mode | Run Coach | Response in Chinese. Markdown + math render correctly. |
| 31.5 | ZH mode | Run Analyze | Chinese headings, bullets, code blocks all display correctly. |
| 31.6 | ZH mode | Check domain warnings | Warnings in Chinese. |
| 31.7 | ZH mode | Check traceability gaps | Gap messages in Chinese. |
| 31.8 | Switch back to EN mid-session | Observe | UI chrome switches. Existing chat messages stay in their original language. |

---

## 32. Draft Persistence (localStorage)

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 32.1 | Empty form | Fill: project, assignee, type, 5 summary parts, description, points | All fields populated. |
| 32.2 | Form filled | Close browser tab | — |
| 32.3 | — | Reopen `localhost:5173` | All values restored. Quality score recalculated. |
| 32.4 | Restored form | Click Reset | All fields cleared. Fresh empty state. |
| 32.5 | After reset | Refresh | Form stays empty (reset clears localStorage draft). |

---

## 33. Form Reset

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 33.1 | Form filled, analysis done | Click Reset (↻ circular arrow) | All form fields cleared. Quality = 0%. Review status → Draft. AI response cleared. "Create JIRA" disappears. |
| 33.2 | Coach streaming | Observe Reset button | Icon changes to stop-square with pulsing animation. |
| 33.3 | Coach streaming | Click Reset | Coach stream cancelled. Partial response preserved. Icon reverts to ↺. |

---

## 34. Skill Auto-Detection

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 34.1 | Design mode | Type a description matching a skill keyword, trigger Coach | "Active Skill" chip may appear in Coach header showing matched skill with colored background. |
| 34.2 | Skill chip visible | Click dismiss (×) | Chip disappears. That skill won't re-match until chat is cleared. |
| 34.3 | Different description | Trigger Coach | Different skill may match, or no chip if no keywords match. |

---

## 35. Accessibility & Keyboard Nav

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 35.1 | Any state | Press Tab repeatedly | Focus moves through interactive elements in logical order. Focus ring visible. |
| 35.2 | LLM Settings modal open | Press Tab | Focus stays trapped within modal. |
| 35.3 | Hotkey modal open | Press Tab | Focus trapped. |
| 35.4 | Assignee combobox open | Press ↑↓ | Highlight moves up/down. |
| 35.5 | Assignee combobox | Press Enter | Highlighted item selected. Dropdown closes. |
| 35.6 | Story points buttons | Press ← → | Focus moves between Fibonacci buttons (roving tabindex). |
| 35.7 | Role selector buttons | Press ← → | Focus moves between role buttons. |
| 35.8 | ConfirmDialog open | Press Escape | Dialog closes (Cancel). |

---

## Quick Smoke Test Checklist

For a fast end-to-end pass, complete these steps in order:

| Step | Action | Pass? |
|------|--------|-------|
| 1 | Launch app, verify layout loads (default Design mode) | ☐ |
| 2 | Switch mode: Design → Explore → Task → Design | ☐ |
| 3 | In Explore: type message, send, verify description clears, chat preserved after switch | ☐ |
| 4 | In Design: switch language EN → ZH → EN | ☐ |
| 5 | In Design: switch role SYS → SWE → V&V | ☐ |
| 6 | Toggle theme dark → light → dark | ☐ |
| 7 | Select project, assignee, type, points | ☐ |
| 8 | Fill all 5 summary fields, verify preview | ☐ |
| 9 | Type description (50+ words), verify counters and quality score > 60% | ☐ |
| 10 | Set requirement level, parent, verification | ☐ |
| 11 | Click "Writing Guidance" → coach streams | ☐ |
| 12 | Click "Analyze Task" → analysis streams → status advances | ☐ |
| 13 | Complete peer review checklist → Approve | ☐ |
| 14 | Click "Create JIRA" → confirm → yellow "Creating" badge appears → success → green "Created" badge | ☐ |
| 15 | Switch to Task mode, fill all fields, coach → analyze → Create JIRA | ☐ |
| 16 | Verify ticket in Ticket History panel (entry + "Created" badge) | ☐ |
| 17 | Export as Markdown | ☐ |
| 18 | Open Settings (Ctrl+,) → verify fields → Cancel | ☐ |
| 19 | Press ? → hotkey modal opens → Escape closes | ☐ |
| 20 | Refresh page → draft restored | ☐ |
| 21 | Reset form → all fields cleared | ☐ |
| 22 | Check DevTools → Agent State is accurate | ☐ |

---

## 36. Runtime Config Hot-Swap (Docker)

Validates that **Basic Info** and **Task Summary** options can be updated by editing `deploy/config/*.json` and restarting the container — no image rebuild.

| # | Input | Action | Expected Output |
|---|-------|--------|-----------------|
| 36.1 | Fresh container up (`docker compose up -d --build`) | Open app, open DevTools console | One line: `[runtime-config] loaded: projects=runtime, team=runtime, summary=runtime, components=runtime`. |
| 36.2 | App open, no project selected | Inspect Task Summary Component field | Datalist suggestions empty. |
| 36.3 | Basic Info → pick project **HW (Hardware Team)** | Focus Component input | Suggestions include HW chips (TLE9461, L9369, Gate Driver); **no MCAL/BSW entries**. |
| 36.4 | Still on HW | Switch project to **DKKF (Software Dev Team)** | Component suggestions switch to MCAL/BSW stack; HW driver chips gone. |
| 36.5 | Shell on host | `echo a new component into deploy/config/components.json under "HW" key`, save | File valid JSON. |
| 36.6 | After edit | `docker compose restart smart-agent` | Container healthy again. |
| 36.7 | Browser | Reload page (no hard refresh needed — fetch URL carries `?v=<timestamp>`) | New component appears in HW dropdown. Console shows `components=runtime`. |
| 36.8 | Put deliberately malformed JSON into `deploy/config/components.json` | `docker compose restart smart-agent`, reload | Console: `[runtime-config] /config/components.json: ... — using fallback`. Component dropdown still populates from baked-in fallback. |
| 36.9 | Rename `deploy/config/components.json` to `components.bak.json` | Restart + reload | Console: `[runtime-config] /config/components.json: HTTP 404 — using fallback`. Fallback still works. |

---

*Updated for AGec v10.12 — 2026-03-25*
