# AGec — User Manual
# 智能工程平台 — 用户手册

> Version / 版本: v10.73 | Language / 语言: English · 中文

---

## Table of Contents / 目录

1. [Overview / 概述](#1-overview--概述)
2. [Interface Layout / 界面布局](#2-interface-layout--界面布局)
3. [First-Time Setup / 初次配置](#3-first-time-setup--初次配置)
4. [Step-by-Step Workflow / 标准操作流程](#4-step-by-step-workflow--标准操作流程)
5. [Header Controls / 顶栏控件](#5-header-controls--顶栏控件)
6. [AI Coach Panel / 设计教练面板](#6-ai-coach-panel--设计教练面板)
7. [Task Form / 任务表单](#7-task-form--任务表单)
8. [Domain Intelligence / 领域智能](#8-domain-intelligence--领域智能)
9. [Traceability / 需求追溯](#9-traceability--需求追溯)
10. [Analyze Task / 分析任务](#10-analyze-task--分析任务)
11. [Deep Review / 深度评审](#11-deep-review--深度评审)
12. [Review Workflow / 评审工作流](#12-review-workflow--评审工作流)
13. [JIRA Search / JIRA 搜索](#13-jira-search--jira-搜索)
14. [Creating a JIRA Ticket / 创建 JIRA 工单](#14-creating-a-jira-ticket--创建-jira-工单)
15. [Export Formats / 导出格式](#15-export-formats--导出格式)
16. [Batch Operations / 批量操作](#16-batch-operations--批量操作)
17. [Review Dashboard / 评审仪表盘](#17-review-dashboard--评审仪表盘)
18. [Ticket History / 工单历史](#18-ticket-history--工单历史)
19. [Settings / 设置](#19-settings--设置)
20. [Keyboard Shortcuts / 键盘快捷键](#20-keyboard-shortcuts--键盘快捷键)
21. [Tips & Troubleshooting / 使用技巧与常见问题](#21-tips--troubleshooting--使用技巧与常见问题)

---

## 1. Overview / 概述

The **Agentic Engineering Platform (AGec)** is a browser-based workstation for automotive software engineers. It combines AI-powered writing guidance, multi-perspective review, domain knowledge enforcement, and full JIRA integration into a single tool — from requirement elicitation through to ticket creation.

**智能工程平台 (AGec)** 是面向汽车软件工程师的浏览器工作站。集 AI 写作指导、多视角评审、领域知识执行和完整 JIRA 集成于一体，覆盖从需求引出到工单创建的全流程。

**Key capabilities / 核心功能：**

| Capability | Description |
|-----------|-------------|
| **Structured Summary** | 5-part task title builder (Vehicle / Product / Layer / Component / Detail) |
| **AI Writing Coach** | Real-time quality guidance with multi-turn conversation |
| **5-Role System** | Role-specific prompts, checklists, and domain context (SYS / SWE / HWE / ME / V&V) |
| **Domain Knowledge** | Automotive vocabulary, ISO 26262, ASPICE, INCOSE quality rules |
| **Guided Elicitation** | Interactive requirement elicitation, assumption detection, conflict checking |
| **Requirement Traceability** | Hierarchy model (Stakeholder → System → SW/HW/ME → DD → TC), AI link suggestions, impact analysis |
| **Multi-Perspective Review** | 4-viewpoint deep review: Safety, Testability, Implementability, Completeness |
| **Review Workflow** | 5-stage pipeline: Draft → AI Reviewed → Peer Reviewed → Approved → JIRA Created |
| **JIRA Search** | Duplicate detection, parent requirement lookup, sprint context |
| **Export** | Markdown, ReqIF (DOORS/Polarion), Excel CSV |
| **Batch Operations** | CSV import, bulk quality scoring, requirement decomposition |
| **Learning** | Review history informs future AI suggestions |

---

## 2. Interface Layout / 界面布局

The app uses a resizable three-column layout with a top header bar. Drag the handles between columns to resize.

应用采用可调节的三列布局加顶部标题栏，拖动列间手柄可调节宽度。

```
┌──────────────────────────────────────────────────────────────────────┐
│ Header: AGec | EN/中文 | Role (SYS/SWE/HWE/ME/V&V) | TEST/PROD | ☀ │
├──────────────────┬──────────────────┬────────────────────────────────┤
│                  │                  │                                │
│  LEFT COLUMN     │  CENTER COLUMN   │  RIGHT COLUMN                  │
│  AI Coach Panel  │  Review Status   │  Task Analysis / Deep Review   │
│  · Chat / History│  Task Form       │  Task Analysis / Deep Review   │
│  · Templates     │  · Basic Info    │  Ticket History                │
│  · Elicitation   │  · Traceability  │  Processing Summary            │
│                  │  · Summary       │  Dev Tools                     │
│                  │  · Description   │  JIRA Search                   │
│                  │  · Actions       │  Batch Operations              │
│                  │  · Export        │  Review Dashboard              │
│                  │                  │                                │
└──────────────────┴──────────────────┴────────────────────────────────┘
```

| Column | Purpose |
|--------|---------|
| **Left / 左列** | AI Design Coach — writing guidance, elicitation, conflict checking |
| **Center / 中列** | Main task form with review status bar, traceability, and action buttons |
| **Right / 右列** | AI review, ticket history (with creation status), search, batch ops, review dashboard |

**Column Resizing / 列宽调节：** Drag the thin vertical handles between columns to adjust widths. Your layout preference is saved to localStorage.

---

## 3. First-Time Setup / 初次配置

Before using the app, configure your LLM connection in **Settings**.
使用前，请先在**设置**中配置 LLM 连接。

### Step 1 — Open Settings / 打开设置

Click the **⚙** gear icon in the top-right corner of the header.
点击顶栏右侧的 **⚙** 图标。

### Step 2 — Enter Provider Base URL (optional) / 填写服务商 URL（可选）

If you use a proxy or an alternative OpenAI-compatible endpoint, enter it in the **Provider Base URL** field (e.g. `https://your-proxy/v1`). Leave blank to use the default GLM API endpoint.

如使用代理或其他 OpenAI 兼容端点，请填写 **Provider Base URL**（如 `https://your-proxy/v1`），留空则使用默认 GLM API 地址。

### Step 3 — Enter your API Key / 输入 API Key

Paste your provider API Key into the **API Key** field.
Click **Test / 验证** to verify the key is valid before saving.

将 API Key 粘贴至 **API Key** 字段，点击**验证**确认可用后再保存。

### Step 4 — Choose a model / 选择模型

The default model is `glm-4.7-flash`. Click the **Model Name** field to see a dropdown of presets from popular providers (GLM, OpenAI, Anthropic, DeepSeek, Qwen, Mistral), or type any model name supported by your provider.

默认模型为 `glm-4.7-flash`，可从下拉列表中选择常用模型（覆盖 GLM、OpenAI、Anthropic、DeepSeek、通义千问、Mistral），或直接输入自定义模型名称。

### Step 5 — Save / 保存

Click **Save / 保存**. Settings are stored locally in your browser and persist across sessions.
点击**保存**，设置将保存在本地浏览器中，下次打开自动恢复。

---

## 4. Step-by-Step Workflow / 标准操作流程

The recommended workflow from requirement to JIRA ticket:
从需求到 JIRA 工单的推荐流程：

```
① Select Role (SYS/SWE/HWE/ME/V&V)
       ↓
② Fill Basic Info + Traceability
       ↓
③ Build Summary + Write Description
       ↓
④ (Optional) Get AI Coach Guidance / Elicitation / Conflict Check
       ↓
⑤ Click "Analyze Task" or "Deep Review"
       ↓
⑥ Review AI findings — check multi-perspective tabs
       ↓
⑦ Complete Peer Review Checklist (if team review is needed)
       ↓
⑧ (Optional) Search JIRA for duplicates / parent requirements
       ↓
⑨ Click "Create JIRA" → Preview payload → Confirm
       ↓
⑩ Export as Markdown / ReqIF / CSV if needed
```

**Batch workflow / 批量流程：** Import CSV → Review items → Bulk Analyze → Export

---

## 5. Header Controls / 顶栏控件

The header bar sits at the top of every page and contains global controls.
顶栏位于页面顶部，包含全局控制选项。

### Language Toggle / 语言切换

Click **EN** or **中文** to switch the entire interface language.
点击 **EN** 或 **中文** 切换界面语言，即时生效。

### Role Selector / 角色选择器

Five engineering roles are available. The active role affects AI prompts, quality checklists, domain context, and review perspectives.

五个工程角色可选，当前角色影响 AI 提示词、质量检查清单、领域上下文和评审视角。

| Role | ID | Focus Area |
|------|----|------------|
| **System Architect / 系统架构师** | SYS | Cross-domain integration, system-level requirements |
| **SW Developer / 软件开发** | SWE | Software requirements, ASPICE SWE processes |
| **HW Designer / 硬件设计** | HWE | Hardware requirements, component specs |
| **ME Designer / 机械设计** | ME | Mechanical requirements, physical constraints |
| **V&V Engineer / 验证确认** | V&V | Test requirements, verification methods |

Click any role button in the header to switch. The active role is highlighted with a role-specific color.

点击顶栏中的角色按钮切换，当前角色以特定颜色高亮显示。

### TEST / PROD Mode Toggle / 测试/生产模式切换

| Mode | Color | Description |
|------|-------|-------------|
| **TEST** | Orange | Requires clicking "Listen" in the n8n editor to activate the JIRA creation webhook |
| **PROD** | Green | Requires the n8n workflow to be in **Active** state |

A **breathing pulse dot** next to the toggle shows the current mode at a glance (orange = test, green = prod).
切换按钮旁的**呼吸脉冲点**实时指示当前模式（橙色 = 测试，绿色 = 生产）。

> This toggle only affects the webhook URL used for **JIRA ticket creation**. It has no effect on LLM Direct API calls.
> 该切换仅影响 **JIRA 工单创建**所用的 Webhook URL，对 LLM 直连 API 调用无影响。

### Theme Toggle / 主题切换

Click the sun/moon button to switch between **Light** and **Dark** themes. Your preference is saved automatically.
点击太阳/月亮按钮切换**浅色**和**深色**主题，偏好自动保存。

### Help / 帮助

Click the **?** icon to open the user manual wiki page in a new browser tab.
点击 **?** 图标在新标签页中打开用户手册 wiki 页面。

### Settings / 设置

Click **⚙** to open the LLM Settings modal. See [Section 19](#19-settings--设置) for details.

---

## 6. AI Coach Panel / 设计教练面板

The **Design Coach** panel is on the **left column**. It provides writing guidance *before* you run the full AI analysis, helping you improve your task description quality upfront.

**设计教练**面板位于**左列**。在运行完整 AI 分析之前，Coach 提供写作指导，帮助你提前优化任务描述质量。

### Chat-Style Conversation / 对话式交互

The Coach panel uses a **chat-style interface** with message bubbles:

- **Your messages** appear on the **right** with a blue-tinted bubble and your avatar
- **Coach responses** appear on the **left** with a neutral bubble and the Coach avatar
- Multi-turn conversations are fully preserved — each exchange is a separate bubble
- The panel **auto-scrolls** to the latest message during streaming

你的消息显示在**右侧**（蓝色气泡 + 用户头像），Coach 回复显示在**左侧**（中性气泡 + Coach 头像）。多轮对话完整保留，面板在流式输出时自动滚动到最新消息。

### Getting Guidance / 获取指导

1. Fill in at least the **Basic Info** and **Task Description** fields in the center form.
2. Click the **Get Writing Guidance / 获取写作指导** button at the bottom of the Coach panel.
3. Your input appears as a user message bubble; the AI response streams in as a Coach bubble.
4. Send follow-up messages to continue the conversation — full history is sent to the AI.

### Streaming & Thinking Indicator / 流式输出与思考指示

- When the Coach is thinking (waiting for the first token), a **breathing green halo** glows around the Coach avatar with **animated dots**
- During streaming, a cursor and token speed indicator appear below the response
- Click **Cancel** to stop streaming at any time

Coach 思考时头像周围会有**绿色呼吸光晕**和跳动的点；流式输出中底部显示速度指示器，随时可点击取消。

### Model Badge / 模型标识

The panel header shows the **active model name** (e.g., `glm-4.7-flash`, `deepseek-v3-2`) as a badge. This updates immediately after you change the model in Settings.

### Skill Toggle / 技能开关

| State | Behavior |
|-------|----------|
| **Skill ON** (default) | AI uses the JIRA coaching system prompt — focused, structured feedback |
| **Skill OFF** | No system prompt — AI responds freely; useful for general questions or brainstorming |

点击切换按钮可随时开启或关闭技能提示词，**关闭**后 AI 将自由回答，适合头脑风暴或非 JIRA 相关问题。

### Task Skill Toggle / 任务技能开关

| State | Behavior |
|-------|----------|
| **Task Skill ON** | Full task context (all form fields) is included in the Coach prompt |
| **Task Skill OFF** | Only the description text is sent — lighter, free-form coaching |

**Dependency:** Task Skill is only effective when **Skill is ON**. When Skill is switched OFF, Task Skill is automatically disabled.

**Dynamic Focus Layout / 动态聚焦布局:** When **Skill OFF** is active, the right panel collapses and the Coach panel expands for better readability. Toggling **Skill ON** restores the 3-column layout.

### Guided Elicitation / 引导式需求引出

Click the **Elicitation / 需求引出** button in the Coach panel to start an interactive requirement elicitation session. The AI will ask structured questions based on your current role to help you discover and articulate requirements.

点击**需求引出**按钮开始交互式需求引出会话。AI 将根据当前角色提出结构化问题，帮助你发现和表达需求。

### Conflict Check / 冲突检查

Click **Conflict Check / 冲突检查** to analyze multiple requirements (pasted in the description) for contradictions, redundancy, or inconsistencies.

点击**冲突检查**分析描述中粘贴的多条需求是否存在矛盾、冗余或不一致。

### Chat / History Tabs / 对话/历史标签页

| Tab | Description |
|-----|-------------|
| **Chat** | The default live conversation view |
| **History** | A searchable archive of all coach conversations saved locally |

**History Tab features:**
- Search messages by content with role filter (All / User / Assistant)
- Each record shows: role badge, hash ID, timestamp, content preview, replay button
- Multi-select for bulk delete or download (JSON / Markdown / Both)
- Maximum **200 records** with FIFO eviction
- **Replay:** Click replay on any user message to re-send it to the Coach

### Template Chips / 快捷模板

Pre-defined prompt shortcuts appear below the empty-state hint. Click any chip to instantly send that template to the AI Coach. Templates can be imported by dragging a `.json` file onto the chips area.

### Copy & Retry / 复制与重试

- **Copy icon** — copies the full response to clipboard
- **Retry button** — resends the same request if it failed
- **Rate limit (429)** — automatic countdown timer with retry; cancel anytime

---

## 7. Task Form / 任务表单

The **center column** contains the main task form.
**中列**为主任务表单。

### 7.1 Review Status Bar / 评审状态栏

At the top of the form, a **5-step pipeline bar** shows the current review status. See [Section 12](#12-review-workflow--评审工作流) for details.

表单顶部的**五步管线栏**显示当前评审状态，详见第 12 节。

### 7.2 Basic Information / 基本信息

| Field | Description |
|-------|-------------|
| **Project Name / 项目空间** | Select the JIRA project from the dropdown |
| **Assignee / 经办人** | Search by name or employee ID using the combobox; supports fuzzy search |
| **Task Type / 任务类型** | Select the issue type (Story, Task, Bug, Sub-task, etc.) |
| **Story Points / 故事点** | Select from preset values **1 · 2 · 3 · 5 · 8**, or type any custom number |

> **Story Points note:** The AI will verify your story point estimate during analysis and may suggest a correction.
> AI 将在分析阶段校验故事点估算，并可能给出修正建议。

### 7.3 Traceability Section / 追溯信息

This section captures the requirement's position in the traceability hierarchy. See [Section 9](#9-traceability--需求追溯) for full details.

| Field | Description |
|-------|-------------|
| **Requirement Level / 需求层级** | Stakeholder, System, SW, HW, ME, DD (Detailed Design), TC (Test Case), or None |
| **Parent Requirement / 上级需求** | ID of the parent requirement (e.g., `SYS-REQ-001`) |
| **Verification Method / 验证方法** | How this requirement will be verified (Test, Analysis, Inspection, Demonstration) |

### 7.4 Task Summary — Five-Part Structured Input / 任务摘要 — 五段式结构化输入

| Field | Example | Limit |
|-------|---------|-------|
| **Vehicle / 车型** | GWM01, Tank500 | Select from dropdown |
| **Product / 产品** | IBC, EPS | Select from dropdown |
| **Layer / 分层** | BSW, ASW, SYS | Select from dropdown |
| **Component / 组件** | CAN Driver, NvM | Free text, max 50 chars |
| **Task Detail / 任务概括** | Add error handling for sensor timeout | Free text, max 100 chars |

**Live Preview / 实时预览:** The assembled summary string updates in real time and becomes the JIRA ticket title.

**Quality Meter / 质量评分:** Progress bar showing quality score (Excellent / Good / Incomplete / Empty). The score incorporates INCOSE rule violations as penalties.

### 7.5 Task Description / 任务描述

Write a detailed task description including:
- Background information / 背景信息
- Prerequisites / 前置条件
- Change requests / 变更请求
- Defect description / 缺陷描述
- Design ideas / 设计思路
- Acceptance criteria (AC) / 验收标准
- Reproduction steps (for bugs) / 复现步骤

**Word & Sentence Counter:** Real-time stats below the text area.

### 7.6 Action Buttons / 操作按钮

| Button | Shortcut | Action |
|--------|----------|--------|
| **Reset / 重置** | — | Clears the entire form, all responses, and resets the review workflow |
| **Export** | — | Opens dropdown: Markdown / ReqIF / Excel CSV (see [Section 15](#15-export-formats--导出格式)) |
| **Analyze Task / 分析任务** | `Ctrl+Shift+Enter` | Sends the task to AI for standard review |
| **Deep Review / 深度评审** | — | Runs 4-perspective analysis (see [Section 11](#11-deep-review--深度评审)) |
| **Create JIRA / 创建 JIRA** | `Ctrl+Shift+C` | Opens the payload preview modal (after analysis) |

---

## 8. Domain Intelligence / 领域智能

The platform embeds automotive engineering domain knowledge that automatically enhances your workflow.

平台内嵌汽车工程领域知识，自动增强您的工作流程。

### 8.1 Automotive Vocabulary / 汽车工程词汇

30+ automotive engineering terms are available to the AI, ensuring accurate interpretation of domain-specific language (e.g., ADAS, CAN, LIN, ECU, OTA, FOTA, AUTOSAR).

### 8.2 Standards Enforcement / 标准执行

The AI is informed of relevant standards based on context:

| Standard | Coverage |
|----------|----------|
| **ISO 26262** | Functional safety — ASIL levels, safety goals, fault tolerance |
| **ASPICE** | Automotive SPICE process assessment — process IDs, work products |
| **ISO 21448 (SOTIF)** | Safety of the intended functionality |
| **ISO 21434** | Cybersecurity engineering |

### 8.3 ASPICE Process Awareness / ASPICE 流程感知

Based on your selected **role** and **issue type**, the system maps to the relevant ASPICE process ID (e.g., SWE.1 for SW Requirements Analysis). This appears as a badge in the form and generates process-specific suggestions.

根据所选**角色**和**任务类型**，系统映射相关 ASPICE 流程 ID（如 SWE.1 对应软件需求分析），显示为表单中的徽标并生成流程特定建议。

### 8.4 INCOSE Quality Rules / INCOSE 质量规则

Your requirement description is automatically checked against INCOSE best practices:
- No ambiguous terms ("some", "several", "various", "etc.")
- No passive voice where avoidable
- Testable, measurable, and atomic statements
- Clear subject-action-object structure

**Violations reduce the quality score** and appear as warnings in the form.

违反 INCOSE 规则将**降低质量评分**并在表单中显示警告。

### 8.5 Assumption Detection / 假设检测

The system automatically scans your description for implicit assumptions and flags them. This helps ensure all assumptions are explicitly stated.

### 8.6 Domain Warnings / 领域警告

Context-specific warnings appear below the form when the AI detects potential issues based on domain knowledge — for example, missing safety context for safety-critical components, or mismatched terminology.

---

## 9. Traceability / 需求追溯

The traceability system models the full requirement hierarchy used in automotive engineering.

追溯系统建模了汽车工程中使用的完整需求层级。

### 9.1 Requirement Hierarchy / 需求层级

```
Stakeholder Requirements
    └── System Requirements
        ├── SW Requirements
        │     └── Detailed Design
        │           └── Test Cases
        ├── HW Requirements
        │     └── Detailed Design
        │           └── Test Cases
        └── ME Requirements
              └── Detailed Design
                    └── Test Cases
```

Select the appropriate **Requirement Level** in the traceability section of the form to position your requirement in this hierarchy.

### 9.2 Traceability Gap Detection / 追溯缺口检测

The system automatically detects missing links:
- A System requirement without a parent Stakeholder requirement
- A SW/HW/ME requirement without a parent System requirement
- Any requirement missing a verification method

Gaps appear as warnings in the form.

### 9.3 AI Traceability Suggestions / AI 追溯建议

Click **Suggest Links / 建议追溯** in the traceability section. The AI will analyze your requirement and suggest:
- Potential parent requirements to link to
- Related requirements at the same level
- Downstream requirements that should be derived

点击**建议追溯**，AI 将分析需求并建议：潜在的上级需求链接、同级相关需求、应派生的下游需求。

### 9.4 Impact Analysis / 影响分析

Click **Impact Analysis / 影响分析** to analyze the ripple effects if your requirement changes. The AI evaluates across 6 dimensions:

点击**影响分析**分析需求变更的波及效应，AI 从 6 个维度评估：

1. **Upstream Impact** — parent requirements affected
2. **Downstream Impact** — derived requirements affected
3. **Cross-Domain Impact** — other engineering domains affected
4. **Test Impact** — test cases that need updating
5. **Safety Impact** — functional safety implications
6. **Schedule Impact** — project timeline implications

The analysis is **role-aware** — for example, a System Architect sees cross-team impact across SW/HW/ME, while a SW Developer sees detailed software-specific impacts.

---

## 10. Analyze Task / 分析任务

Click **Analyze Task** (or press `Ctrl+Shift+Enter`) to send your task to the AI Agent.
点击**分析任务**（或按 `Ctrl+Shift+Enter`）将任务发送给 AI Agent。

### What the AI reviews / AI 审核内容

- **Story point correctness** — compares your estimate to industry standards
- **Task description quality** — completeness, clarity, and structure
- **Subtask decomposition** — if the task is large, AI may propose splitting it
- **Field consistency** — checks summary and description alignment
- **Domain compliance** — ASPICE, ISO 26262, INCOSE rule adherence
- **Traceability completeness** — checks hierarchy links and verification methods

### Reading the Task Analysis Panel / 阅读任务分析面板

| Element | Description |
|---------|-------------|
| **Processing Summary** | Score card: AI-corrected story points, number of subtasks |
| **Detailed review** | Full markdown response with findings and recommendations |
| **Status badge** | `Success` (green), `Loading` (orange), `Error` (red) |
| **Model badge** | Shows the active model name |

### Diff View / 差异对比视图

After running a **second** analysis, a **Diff** toggle appears. Shows word-level differences between previous and current AI response (green = added, red = removed).

### Auto-Advancement / 自动推进

A successful analysis automatically advances the review status from **Draft** to **AI Reviewed**.

分析成功后，评审状态自动从**草稿**推进到**AI 已审核**。

---

## 11. Deep Review / 深度评审

Click the **Deep Review** button (purple, with shield icon) for a comprehensive multi-perspective analysis.

点击**深度评审**按钮（紫色盾牌图标）进行全面多视角分析。

### Four Perspectives / 四个视角

| Perspective | Focus |
|-------------|-------|
| **Safety / 安全性** | Functional safety, ASIL compliance, fault tolerance, ISO 26262 alignment |
| **Testability / 可测试性** | Measurability, test method clarity, acceptance criteria completeness |
| **Implementability / 可实现性** | Technical feasibility, resource constraints, design complexity |
| **Completeness / 完整性** | Missing information, ambiguity, boundary conditions, edge cases |

### Perspective Tabs / 视角标签页

The analysis result is shown with **tab navigation**:
- **All** — shows the complete review across all 4 perspectives
- Click any individual perspective tab to focus on just that viewpoint

Each perspective tab shows a colored indicator matching the perspective's theme.

### Role-Aware Analysis / 角色感知分析

The deep review adapts to your selected role:
- **SYS** — emphasizes cross-domain safety and system-level integration
- **SWE** — focuses on AUTOSAR compliance, code-level testability
- **HWE** — highlights component reliability and thermal constraints
- **ME** — checks physical constraints and manufacturing feasibility
- **V&V** — prioritizes test coverage and verification traceability

---

## 12. Review Workflow / 评审工作流

A 5-stage pipeline tracks each requirement from draft to JIRA creation.

五阶段管线跟踪每条需求从草稿到 JIRA 创建的全过程。

### Review Stages / 评审阶段

```
● Draft  →  ● AI Reviewed  →  ● Peer Reviewed  →  ● Approved  →  ● JIRA Created
  草稿        AI 已审核         同行已审核          已批准          JIRA 已创建
```

| Stage | How to Reach | Color |
|-------|-------------|-------|
| **Draft** | Default state for new requirements | Gray |
| **AI Reviewed** | Automatic after successful Analyze or Deep Review | Blue |
| **Peer Reviewed** | Complete the peer review checklist (see below) | Purple |
| **Approved** | Click "Approve" after completing all checklist items | Green |
| **JIRA Created** | Automatic after successful JIRA ticket creation | Green |

### Peer Review Checklist / 同行评审检查清单

After AI Review, the form shows a **role-specific checklist**. Each role gets **3 common items + 3 role-specific items**:

AI 审核后，表单显示**角色特定检查清单**，每个角色有 **3 项通用 + 3 项角色特定**检查项：

**Common checks (all roles):**
1. Requirements are clear, unambiguous, and testable
2. Acceptance criteria are defined
3. Dependencies are identified

**Role-specific examples:**
- **SYS**: Cross-domain interfaces verified, system-level traceability complete, safety impact assessed
- **SWE**: AUTOSAR compliance checked, code-level design feasible, unit test approach defined
- **V&V**: Test methods specified, coverage targets defined, traceability to requirements verified

Check off each item as you review. When all items are checked, click **Approve** to advance the status.

### Restarting the Workflow / 重启工作流

The workflow resets to **Draft** in two situations:

| Trigger | What resets |
|---------|-------------|
| **Re-click "Task Guidance"** | Workflow returns to Draft; Ticket History "Created" badge clears. The form fields are preserved so you can iterate on the same content. 工作流回到草稿；工单历史"已创建"标记清除。表单字段保留，便于迭代。 |
| **Click "Reset"** | Workflow returns to Draft; form fields, all AI responses, and Ticket History badge are all cleared. 工作流回到草稿；表单、所有 AI 响应及工单历史标记全部清除。 |

> **Tip:** After creating a JIRA ticket, clicking **Task Guidance** again lets you refine and re-create without manually resetting — the workflow automatically restarts.
>
> **提示：** 创建 JIRA 工单后，再次点击**任务指导**可直接优化并重新创建，无需手动重置——工作流会自动重启。

---

## 13. JIRA Search / JIRA 搜索

The **JIRA Search** panel in the right column lets you search your JIRA project without leaving the workstation.

右列的 **JIRA 搜索**面板让你无需离开工作站即可搜索 JIRA 项目。

### Three Search Modes / 三种搜索模式

| Button | Action | Use Case |
|--------|--------|----------|
| **Check Duplicates / 查重** | Searches for similar tickets | Before creating a new ticket |
| **Parent Reqs / 上级需求** | Finds potential parent requirements | When linking traceability |
| **Sprint Context / 迭代上下文** | Gets current sprint information | For planning and scheduling |

### Duplicate Detection / 重复检测

When you click **Check Duplicates**, the system searches for tickets similar to your current summary. Results with **similarity > 70%** are flagged with a warning badge.

点击**查重**后，系统搜索与当前摘要相似的工单，**相似度 > 70%** 的结果带警告标记。

> **Auto-check:** Duplicate detection runs automatically when you click "Create JIRA", so you'll see warnings before confirming.
> **自动查重：** 点击"创建 JIRA"时自动运行查重，确认前即可看到警告。

### Using Search Results / 使用搜索结果

Click any search result to **set it as the parent requirement** in the traceability section. A toast notification confirms the action.

点击搜索结果可将其**设为追溯部分的上级需求**，弹窗通知确认。

---

## 14. Creating a JIRA Ticket / 创建 JIRA 工单

After reviewing the AI analysis, click **Create JIRA** to create the ticket.
AI 分析完成后，点击**创建 JIRA** 创建工单。

### Step 1 — Preview Modal / 预览弹窗

A modal opens showing the **full request payload** that will be sent to JIRA. Review it carefully:
- Ticket summary (title)
- Assignee
- Task type
- Story points (AI-corrected value)
- Description text
- Subtasks (if any)

### Step 2 — Confirm or Cancel / 确认或取消

| Button | Action |
|--------|--------|
| **Create Ticket / 创建工单** | Submits the payload to JIRA |
| **Cancel / 取消** | Closes the modal without creating anything |

### Step 3 — Creation Progress / 创建进度

Creation status is shown directly in the **Ticket History** panel:

创建状态直接显示在**工单历史**面板中：

| State / 状态 | Display / 显示 |
|--------|---------|
| **In progress / 创建中** | Panel auto-opens. Yellow **"Creating"** badge with spinner appears in the header. 面板自动展开，标题栏显示带旋转动画的黄色"创建中"标记。 |
| **Success / 成功** | Yellow badge transitions to green **"Created"** badge. New ticket entry appears with clickable JIRA key. 黄色标记过渡为绿色"已创建"标记，新工单条目带可点击的 JIRA 链接。 |
| **Error / 失败** | Badge disappears. Error toast shown. 标记消失，显示错误提示。 |

### Auto-Actions on Success / 成功后自动操作

When a JIRA ticket is created successfully:
1. Review status advances to **JIRA Created**
2. Ticket is added to **Ticket History** with green highlight
3. A **review record** is saved (including checklist pass/fail state) for learning context

---

## 15. Export Formats / 导出格式

Click the **Export** dropdown button (download icon) in the action bar to export the current requirement.

点击操作栏中的**导出**下拉按钮（下载图标）导出当前需求。

### Available Formats / 可用格式

| Format | Extension | Use Case |
|--------|-----------|----------|
| **Markdown** | `.md` | Documentation, wiki pages, sharing with teams |
| **ReqIF** | `.reqif` | Import into DOORS, Polarion, or other RM tools (OMG standard XML) |
| **Excel CSV** | `.csv` | Legacy workflows, spreadsheet review, bulk processing |

### What's Included / 导出内容

Each export contains:
- Summary and description
- Project, issue type, assignee, story points
- Traceability info (requirement level, parent requirement, verification method)
- Summary structure breakdown (Vehicle / Product / Layer / Component / Detail)
- Quality score
- Review status
- Role and timestamp

### ReqIF Details / ReqIF 详情

The ReqIF export follows the OMG ReqIF 2.0 schema and includes:
- Datatype definitions (String, Integer)
- Spec-object-type with 6 attributes: Summary, Description, RequirementLevel, ParentRequirement, VerificationMethod, QualityScore
- Ready for import into IBM DOORS, Polarion, or any ReqIF-compatible tool

---

## 16. Batch Operations / 批量操作

The **Batch Operations** panel in the right column supports processing multiple requirements at once.

右列的**批量操作**面板支持同时处理多条需求。

### Adding Items to Batch / 添加批量项

**From current form / 从当前表单添加：**
Click the **+** button in the batch panel header to snapshot the current form state (summary, description, type, level, parent) into the batch list.

**From CSV import / 从 CSV 导入：**
1. Click the **import** button (upload icon) to expand the import area
2. Either **paste CSV text** directly into the textarea, or click **Choose File** to select a `.csv` file
3. Click **Import** to parse and add items

**CSV Format Requirements / CSV 格式要求：**
- Must contain a **Summary** column header (or **摘要** in Chinese)
- Optional columns: Description/描述, Issue Type/类型, Requirement Level/层级, Parent Requirement/上级需求
- Supports quoted fields with commas and escaped quotes

### Batch List / 批量列表

Each item in the list shows:
- **Checkbox** — select/deselect for bulk operations
- **Level badge** — requirement hierarchy level (if set)
- **Issue type** — Story, Task, or Bug
- **Quality score** — color-coded (green ≥ 70, orange ≥ 40, red < 40)
- **Summary** — truncated title
- **Description preview** — first 80 characters
- **Remove button** — delete individual items

### Toolbar / 工具栏

| Control | Action |
|---------|--------|
| **Select All / 全选** | Toggle checkbox for all items |
| **Selected count** | Shows number of selected items |
| **Bulk Analyze / 批量分析** | Loads the first selected item into the form and runs analysis |
| **Clear / 清空** | Removes all batch items |

### Persistence / 持久化

Batch items are saved to `localStorage` under the key `batch-requirements` and persist across browser sessions.

批量项保存在浏览器 `localStorage` 中，跨会话保留。

---

## 17. Review Dashboard / 评审仪表盘

The **Review Dashboard** panel shows aggregate statistics from your review history, helping you identify patterns and improve over time.

**评审仪表盘**面板显示评审历史的汇总统计，帮助你识别模式并持续改进。

### Statistics / 统计指标

| Metric | Description |
|--------|-------------|
| **Total Reviews** | Total number of completed reviews |
| **Approval Rate** | Percentage of requirements that reached Approved status |
| **Avg Quality Score** | Average quality score across all reviewed requirements |

### Top Failed Checks / 最常失败的检查项

A horizontal bar chart shows the checklist items that most frequently fail across your reviews. This helps you focus on recurring quality issues.

水平条形图显示在评审中最常失败的检查项，帮助你关注反复出现的质量问题。

### Learning Context / 学习上下文

After **3 or more** review records, the system automatically injects learning context into AI prompts. This means the AI adapts its suggestions based on your historical patterns — focusing more attention on areas where you typically have issues.

**3 条以上**评审记录后，系统自动将学习上下文注入 AI 提示词，使 AI 根据历史模式调整建议，重点关注你常见的问题领域。

### Clear History / 清空历史

Click **Clear** to remove all review records. Maximum **100 records** are stored.

---

## 18. Ticket History / 工单历史

The **Ticket History** panel keeps a log of the last **20 successfully created tickets**, persisted in your browser. It also shows real-time creation status.

**工单历史**面板保存最近 **20 条**成功创建的工单记录，同时显示实时创建状态。

### Creation Status Badges / 创建状态标记

| Badge / 标记 | When / 时机 | Appearance / 外观 |
|-------|-------------|-------------|
| **Creating / 创建中** | JIRA creation is in progress | Yellow badge with spinning indicator 黄色标记 + 旋转动画 |
| **Created / 已创建** | Ticket just created successfully | Green badge with dot 绿色标记 + 圆点 |

The panel **auto-opens** when creation starts. Badges transition smoothly (yellow → green on success).

创建开始时面板**自动展开**。标记平滑过渡（成功时黄 → 绿）。

### Ticket Entries / 工单条目

| Field | Description |
|-------|-------------|
| **Ticket Key** | Clickable link (e.g., `PROJ-1234`) — opens the ticket in JIRA |
| **Summary** | Truncated task title |
| **Project + Type badge** | Project code and issue type |
| **Relative time** | How long ago the ticket was created |

The most recently created ticket is highlighted with a green border.

最新创建的工单以绿色边框高亮显示。

Click **Clear / 清空** to remove all history entries.

---

## 19. Settings / 设置

Open Settings with the **⚙** button or press `Ctrl+,`.
点击 **⚙** 按钮或按 `Ctrl+,` 打开设置。

### LLM Connection / LLM 连接

| Setting | Description |
|---------|-------------|
| **Provider Base URL** | Optional custom endpoint; leave blank for default GLM API |
| **API Key** | Your provider API key; click **Test / 验证** to validate |
| **Model Name** | Default: `glm-4.7-flash`; select from presets or type any model name |

Presets available from: **GLM (ZhipuAI)**, **OpenAI**, **Anthropic**, **DeepSeek**, **Qwen (Alibaba)**, **Mistral**.

### AI Skills / AI 技能提示词

Each feature (Writing Coach / Analyze Task) has an independent, editable **skill prompt**. The Coach skill **automatically changes based on the selected layer** (SYS, SW, APP, HW, ME, TEST, SWF) — each layer loads a domain-specific AI persona.

每个功能（写作教练 / 分析任务）有独立可编辑的**技能提示词**。Coach 技能会**根据所选分层自动切换**（SYS、SW、APP、HW、ME、TEST、SWF），每个分层加载对应的领域 AI 角色。

| Button | Action |
|--------|--------|
| **Import .md** | Load a skill prompt from a local Markdown file |
| **Export .md** | Save the current skill prompt as a `.md` file |
| **Reset to Default** | Restore the built-in prompt for the current language and layer |
| **modified badge** | Shown when the skill has been customised |

> **Note / 注意:** A custom edit overrides the default for **all layers** until you click Reset. See [`docs/SKILL-ROUTER-DESIGN.md`](docs/SKILL-ROUTER-DESIGN.md) for the full skill routing architecture.
>
> 自定义编辑会覆盖**所有分层**的默认值，直到点击重置。完整技能路由架构请参见 [`docs/SKILL-ROUTER-DESIGN.md`](docs/SKILL-ROUTER-DESIGN.md)。

### Template Chips / 快捷模板管理

| Action | How |
|--------|-----|
| Add a chip | Click **+ Add Chip** and fill in icon, label and content |
| Edit a chip | Click the chip row to expand the edit form |
| Reorder chips | Use the **↑ / ↓** buttons |
| Remove a chip | Click the **✕** button |
| Import from file | Click **Import .json** |
| Export to file | Click **Export .json** |
| Reset to defaults | Click **Reset to Defaults** |

### Export / Import API Settings / 导出/导入 API 设置

- **Export** — downloads API connection settings as JSON
- **Import** — loads API settings from a previously exported JSON file

---

## 20. Keyboard Shortcuts / 键盘快捷键

Press **`?`** anywhere (outside a text input) to open the shortcuts reference modal.
在非输入框区域按 **`?`** 键可随时打开快捷键速查弹窗。

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Get Writing Guidance / 获取写作指导 |
| `Ctrl+Shift+Enter` | Run Analyze Task / 运行任务分析 |
| `Ctrl+Shift+C` | Open Create JIRA modal / 打开创建 JIRA 弹窗 |
| `Ctrl+,` | Open Settings / 打开设置 |
| `Escape` | Close any open modal / 关闭当前弹窗 |
| `?` | Show keyboard shortcuts cheat sheet / 显示快捷键列表 |

---

## 21. Tips & Troubleshooting / 使用技巧与常见问题

### Tips for better results / 获得更好结果的技巧

- **Select the right role first.** The role affects all AI interactions — prompts, checklists, and domain context are all role-specific.
  **先选对角色。**角色影响所有 AI 交互——提示词、检查清单和领域上下文都是角色特定的。

- **Fill in traceability fields.** Setting the requirement level and parent requirement significantly improves AI analysis quality and quality score.
  **填写追溯字段。**设置需求层级和上级需求能显著提升 AI 分析质量和质量评分。

- **Use the Coach first.** Running the Design Coach before the main analysis helps improve description quality upfront.
  **先用设计教练。**主分析前先请 Coach 审阅可提前优化描述质量。

- **Try Deep Review for important requirements.** The 4-perspective analysis catches issues that standard analysis might miss.
  **对重要需求使用深度评审。**四视角分析能发现标准分析可能遗漏的问题。

- **Check for duplicates before creating.** Use JIRA Search to avoid duplicate tickets.
  **创建前先查重。**使用 JIRA 搜索避免重复工单。

- **Export for compliance.** Use ReqIF export when requirements need to go into DOORS or Polarion for formal traceability.
  **合规导出。**当需求需要导入 DOORS 或 Polarion 进行正式追溯时使用 ReqIF 导出。

- **Batch import from spreadsheets.** If your team maintains requirements in Excel, export as CSV and use batch import to process them all.
  **从电子表格批量导入。**如果团队在 Excel 中维护需求，导出为 CSV 后使用批量导入一次处理。

- **Review Dashboard shows your patterns.** After several reviews, check the dashboard to see which checklist items you commonly miss.
  **评审仪表盘显示你的模式。**多次评审后，查看仪表盘了解你常遗漏的检查项。

- **Draft saved automatically.** Form content auto-saves to the browser. Reopen the app to restore your draft.
  **草稿自动保存。**表单内容自动保存到浏览器，重新打开可恢复草稿。

- **LaTeX math is supported.** AI responses render `$...$` (inline) and `$$...$$` (display) formulas via KaTeX.
  **支持 LaTeX 数学公式。**AI 回复中的公式由 KaTeX 渲染。

---

### Common Issues / 常见问题

#### App shows "Request timeout" / 提示「请求超时」

Check your network connection and confirm the LLM API endpoint is reachable.

#### "Invalid API Key" error / 提示「API Key 无效」

Open **Settings (⚙)**, re-enter your API Key, click **Test / 验证**, then **Save / 保存**.

#### Rate limit — countdown timer appears / 出现频率限制倒计时

The LLM API has a rate limit. The app automatically waits and retries. Click **Cancel auto-retry** to abort, or wait.

#### "Create JIRA" button not visible / 「创建 JIRA」按钮不显示

This button only appears **after a successful AI analysis**. Run the analysis first.

#### Draft restored toast on startup / 启动时提示草稿已恢复

Normal — the app found a previously unsaved draft. Click **Reset** to start fresh.

#### Story points were changed by AI / AI 修改了故事点

The AI verifies your estimate. The corrected value is shown in the Processing Summary. Note disagreements in the description before creating.

#### JIRA creation fails but LLM analysis works / LLM 分析正常但 JIRA 创建失败

LLM analysis and JIRA creation use separate connections. Check that the n8n workflow is running and the correct **Test / Prod** mode is selected.

#### Deep Review shows "All" tab only / 深度评审只显示"全部"标签

The perspective tabs appear only when the AI response contains the expected `## Safety`, `## Testability`, `## Implementability`, `## Completeness` headings. If the LLM doesn't follow the format, only the "All" tab is shown.

#### Batch import shows 0 items / 批量导入显示 0 条

Ensure your CSV has a header row with a **Summary** (or **摘要**) column. The importer requires at least this column to parse rows.

---

*For technical issues or feature requests, please contact your system administrator.*
*如有技术问题或功能建议，请联系系统管理员。*
