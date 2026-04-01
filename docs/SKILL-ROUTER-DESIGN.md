# Skill Router Design Doc / 技能路由设计文档

> **Version:** 1.0 | **Last updated:** 2026-04-01
>
> This document serves two purposes:
> 1. **User Guide** — explains how the skill system works so users can customize AI behavior
> 2. **Design Reference** — captures the architecture for future development
>
> 本文档有两个用途：
> 1. **用户指南** — 讲解技能系统的工作原理，帮助用户自定义 AI 行为
> 2. **设计参考** — 记录架构细节，指导未来开发

---

## Table of Contents / 目录

1. [Overview / 概述](#1-overview--概述)
2. [Core Concepts / 核心概念](#2-core-concepts--核心概念)
3. [Skill Types / 技能类型](#3-skill-types--技能类型)
4. [Routing Flow / 路由流程](#4-routing-flow--路由流程)
5. [Layer-Based Skill Selection / 基于分层的技能选择](#5-layer-based-skill-selection--基于分层的技能选择)
6. [Skill Matching Algorithm / 技能匹配算法](#6-skill-matching-algorithm--技能匹配算法)
7. [Context Layer Assembly / 上下文层组装](#7-context-layer-assembly--上下文层组装)
8. [User Customization / 用户自定义](#8-user-customization--用户自定义)
9. [Key Files / 关键文件](#9-key-files--关键文件)
10. [Known Limitations & Future Work / 已知限制与未来规划](#10-known-limitations--future-work--已知限制与未来规划)

---

## 1. Overview / 概述

The **Skill Router** is the system that decides *what instructions (system prompt) to send to the LLM* for each Coach or Analyze request. It assembles the final prompt from multiple layers: domain context, role-specific skill, and response format.

**技能路由器**决定每次 Coach 或 Analyze 请求时*向 LLM 发送哪些系统提示词*。它从多个层级组装最终提示词：领域上下文、角色专属技能、和响应格式。

```
┌─────────────────────────────────────────────────┐
│              Final System Prompt                │
│              最终系统提示词                        │
├─────────────────────────────────────────────────┤
│  Layer 1: Traceability Context (mode-specific)  │
│  第一层：追溯性上下文（模式相关）                    │
├─────────────────────────────────────────────────┤
│  Layer 2: Skill Content (layer-specific)        │
│  第二层：技能内容（分层相关）                       │
├─────────────────────────────────────────────────┤
│  Layer 3: Response Format (global)              │
│  第三层：响应格式（全局）                           │
└─────────────────────────────────────────────────┘
```

---

## 2. Core Concepts / 核心概念

| Concept / 概念 | Description / 说明 |
|---|---|
| **Skill** / 技能 | A markdown prompt that defines the AI's persona and review criteria. 一段定义 AI 角色和审查标准的 Markdown 提示词。 |
| **Layer** / 分层 | The engineering domain selected by the user (SYS, SW, APP, HW, ME, TEST, SWF). 用户选择的工程领域。 |
| **Role** / 角色 | The user's engineering role, auto-mapped from layer. 用户的工程角色，由分层自动映射。 |
| **Mode** / 模式 | `task` or `explore` — determines which context layers are injected. `task` 或 `explore`，决定注入哪些上下文层。 |
| **Skill Registry** / 技能注册表 | An array of skill definitions with keyword-based matching rules. 包含关键词匹配规则的技能定义数组。 |
| **Response Format** / 响应格式 | Global instructions appended to all prompts (Markdown, math notation, language rules). 附加到所有提示词的全局格式指令。 |

---

## 3. Skill Types / 技能类型

### 3.1 Coach Skill / Coach 技能

Layer-specific prompts that guide the AI Coach when reviewing task descriptions.

分层专属的提示词，引导 AI Coach 审查任务描述。

| Layer / 分层 | File (EN) | Persona / 角色定位 |
|---|---|---|
| **SYS** | `coach-skill-task-sys-en.md` | Senior Systems/Requirements Architect — INCOSE, ISO 26262, ASPICE SYS.3/SYS.4 |
| **SW** | `coach-skill-task-sw-en.md` | Practical JIRA task writing coach — actionability, scope, AC, effort |
| **APP** | `coach-skill-task-app-en.md` | Senior Application SW Engineer — AUTOSAR SWC/RTE |
| **HW** | `coach-skill-task-hw-en.md` | Senior ECU Hardware Designer — schematic, PCB, EMC |
| **ME** | `coach-skill-task-me-en.md` | Senior Mechanics Designer — packaging, thermal, DFM |
| **TEST** | `coach-skill-task-test-en.md` | Senior V&V Engineer — HIL/SIL/MIL, ISO 26262 test |
| **SWF** | `coach-skill-task-swf-en.md` | Software Framework layer |

Each layer has both English (`-en.md`) and Chinese (`-zh.md`) variants.

每个分层都有英文和中文两个版本。

### 3.2 Analyze Skill / 分析技能

A single skill used for the "Analyze Task" feature. It plays an R&D Efficiency Expert who scores complexity (Fibonacci scale), validates story points, and checks ASPICE compliance.

用于"分析任务"功能的单一技能。扮演研发效能专家，按 Fibonacci 数列评估复杂度、校验故事点、检查 ASPICE 合规性。

- Files: `analyze-skill-en.md`, `analyze-skill-zh.md`

### 3.3 Response Format / 响应格式

Global instructions appended to **all** system prompts. Controls Markdown formatting, KaTeX math notation, language matching.

附加到**所有**系统提示词的全局指令。控制 Markdown 格式、KaTeX 数学公式、语言匹配。

- File: `response-format.md`

---

## 4. Routing Flow / 路由流程

### Coach Flow / Coach 流程

```
User clicks "Task Guidance" / "Explore"
用户点击"任务指导"/"探索"
         │
         ▼
┌──────────────────────────────────┐
│ Is coachSkillEnabled?            │
│ Coach 技能是否启用？               │
└────────┬───────────┬─────────────┘
         │ NO        │ YES
         ▼           ▼
  Return only     Run matchSkill()
  responseFormat   on user description
  仅返回响应格式    对用户描述进行关键词匹配
                     │
         ┌───────────┴───────────┐
         │ Skill matched?        │
         │ 匹配到技能？            │
         └───┬──────────────┬────┘
         YES │              │ NO
             ▼              ▼
   Is it ignored?     getCoachSkill()
   是否被用户忽略？    获取默认 Coach 技能
         │                  │
    YES  │  NO              │
     ▼   │   ▼              │
  Use    │  resolveSystem   │
 default │  Prompt(matched) │
         │       │          │
         └───────┴──────────┘
                 │
                 ▼
    Prepend getModeTraceContext()
    前置追溯性上下文
                 │
                 ▼
    ┌────────────────────────┐
    │  Final System Prompt   │
    │  = trace + skill +     │
    │    responseFormat       │
    └────────────────────────┘
                 │
                 ▼
    Send to LLM as system message
    作为 system 消息发送到 LLM
```

### Analyze Flow / 分析流程

The analyze flow is simpler — **no skill matching**, always uses the analyze skill:

分析流程更简单 — **不进行技能匹配**，始终使用分析技能：

```
traceContext + learningContext + analyzeSkill + responseFormat
```

---

## 5. Layer-Based Skill Selection / 基于分层的技能选择

When the user selects a layer in the Summary Builder dropdown, the skill automatically updates:

当用户在摘要构建器下拉框中选择分层时，技能自动更新：

```
SummaryBuilder (v-model="summary.layer")
         │
         ▼ (watcher in useForm.ts:185-192)
activeTaskLayer.value = 'SYS'        // reactive ref
setRole('system-architect')          // maps layer → role
         │
         ▼ (computed in skills/index.ts:48-53)
activeTaskSkillFile = 'coach-skill-task-sys-en.md'
         │
         ▼ (at request time, skills/index.ts:63-67)
getCoachSkillTaskDefault('en')
  → TASK_SKILL_MAP['SYS'].en        // returns the .md content
```

**Layer → Role mapping / 分层 → 角色映射：**

| Layer | Role / 角色 | Short / 简称 |
|---|---|---|
| SYS | system-architect | SYS / 架构 |
| SW, APP, SWF | sw-developer | SWE / 软件 |
| HW | hw-designer | HWE / 硬件 |
| ME | me-designer | ME / 机械 |
| TEST | vv-engineer | V&V / 验证 |

---

## 6. Skill Matching Algorithm / 技能匹配算法

**Source:** `src/utils/skillMatcher.ts`

The matcher scans the user's description text for keyword hits:

匹配器扫描用户描述文本中的关键词命中：

```typescript
matchSkill(message: string, registry: SkillEntry[], lang: 'zh' | 'en'): SkillEntry | null
```

**Algorithm / 算法：**

1. Normalize input to lowercase / 将输入转为小写
2. For each skill in registry, count substring keyword matches / 对注册表中每个技能，计算子串关键词命中数
3. **Threshold = 2** — at least 2 keywords must match / 至少匹配 2 个关键词
4. Return highest-scoring skill, or `null` / 返回得分最高的技能，或 `null`

**Registered skills with keywords / 已注册技能及关键词：**

| Skill ID | Keywords (EN) | Keywords (ZH) |
|---|---|---|
| `coach` | review, improve, suggest, help, coach, guidance, advice, jira, ticket, description, requirement, task, story | 审阅, 改进, 建议, 帮助, 教练, 指导, 任务, 描述, 需求, 工单 |
| `analyze` | analyze, analysis, evaluate, assess, score, quality, check, validate, verify, audit, inspect | 分析, 评估, 评分, 质量, 检查, 验证, 审核 |

**ignoredSkillId Mechanism / 忽略技能机制：**

Users can dismiss a matched skill by clicking the "x" on the skill chip in the Coach panel. This sets `ignoredSkillId`, which is sticky until:
- A **different** skill matches, OR
- The coach conversation is cleared

用户可以点击 Coach 面板中技能标签的 "x" 来忽略匹配的技能。`ignoredSkillId` 会保持到：
- 匹配到**不同的**技能，或
- 清空 Coach 对话

---

## 7. Context Layer Assembly / 上下文层组装

The final system prompt is assembled from multiple layers. Here's the full picture:

最终系统提示词由多个层级组装而成。完整视图：

```
┌─────────────────────────────────────────────────────────────────┐
│                    COACH SYSTEM PROMPT                          │
│                    Coach 系统提示词                               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ getModeTraceContext()                                     │  │
│  │ ─ Task mode only / 仅任务模式                              │  │
│  │ ─ Task type, parent link, possible children               │  │
│  │ ─ 任务类型、上级链接、可能的子级                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          + '\n\n'                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Skill Content (one of):                                   │  │
│  │ ─ resolveSystemPrompt(matched)  ← if skill matched        │  │
│  │ ─ getCoachSkill(mode, lang)     ← default (layer-based)   │  │
│  │   = localStorage override OR TASK_SKILL_MAP[layer]         │  │
│  │   = localStorage 覆盖 或 TASK_SKILL_MAP[layer]             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          + '\n\n'                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ getResponseFormat()                                       │  │
│  │ ─ Markdown, KaTeX math, language matching                 │  │
│  │ ─ Markdown 格式、KaTeX 公式、语言匹配                       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│                   ANALYZE SYSTEM PROMPT                         │
│                   分析系统提示词                                  │
│                                                                 │
│  traceContext + learningContext + analyzeSkill + responseFormat  │
│  追溯上下文   + 学习上下文     + 分析技能     + 响应格式          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. User Customization / 用户自定义

### 8.1 How to edit skills / 如何编辑技能

1. Open **Settings** (gear icon in header) / 打开**设置**（页眉齿轮图标）
2. Scroll to the **Task Skill** or **Analyze Skill** textarea / 滚动到**任务技能**或**分析技能**文本框
3. Edit the prompt content / 编辑提示词内容
4. Click **Save** / 点击**保存**

The modified skill is saved to `localStorage` and takes effect on the next request.

修改后的技能保存到 `localStorage`，在下次请求时生效。

### 8.2 Priority chain / 优先级链

```
localStorage (user edit)  >  TASK_SKILL_MAP[layer] (default)
localStorage（用户编辑）    >  TASK_SKILL_MAP[layer]（默认值）
```

When a user saves a custom skill, it overrides the layer-based default for **all layers**. The UI shows a **"modified"** badge as a visual indicator.

用户保存自定义技能后，它会覆盖**所有分层**的默认值。UI 上会显示**"已修改"**标记。

### 8.3 Reset to default / 恢复默认

Click the **"Reset to Default"** button next to the skill textarea. This removes the `localStorage` entry and restores layer-specific skill resolution.

点击技能文本框旁的**"恢复默认"**按钮。这会移除 `localStorage` 条目，恢复基于分层的技能选择。

### 8.4 Import / Export .md / 导入/导出 .md

- **Export** — downloads the current skill content as a `.md` file / 将当前技能内容下载为 `.md` 文件
- **Import** — reads a `.md` file into the textarea (save to apply) / 将 `.md` 文件读入文本框（需保存才能生效）

This is useful for sharing skill prompts across teams or backing up customizations.

可用于团队间共享技能提示词或备份自定义内容。

### 8.5 Toggles / 开关

| Toggle / 开关 | localStorage Key | Effect / 效果 |
|---|---|---|
| **Coach Skill ON/OFF** | `coach-skill-enabled` | When OFF: no skill or domain context, only response format. 关闭时：不发送技能或领域上下文，仅发送响应格式。 |
| **Task Coach ON/OFF** | `task-coach-enabled` | When OFF: sends only raw description to LLM. 关闭时：仅向 LLM 发送原始描述。 |

---

## 9. Key Files / 关键文件

| File / 文件 | Purpose / 用途 |
|---|---|
| `src/config/skills/registry.ts` | Skill definitions: IDs, keywords, prompt resolvers. 技能定义：ID、关键词、提示词解析器。 |
| `src/config/skills/index.ts` | Skill state management: TASK_SKILL_MAP, localStorage read/write, reactive flags. 技能状态管理：分层映射、localStorage 读写、响应式标志。 |
| `src/utils/skillMatcher.ts` | Keyword-based matching algorithm. 基于关键词的匹配算法。 |
| `src/config/skills/*.md` | Skill prompt content (7 layers x 2 langs + analyze x 2 + response format). 技能提示词内容。 |
| `src/composables/useLLM.ts` | Coach/Analyze flows: system prompt assembly, streaming, retry logic. Coach/Analyze 流程：系统提示词组装、流式传输、重试逻辑。 |
| `src/composables/useForm.ts` | Layer watcher: `summary.layer` → `activeTaskLayer` + `setRole()`. 分层监听：分层选择 → 激活技能层 + 设置角色。 |
| `src/composables/useRole.ts` | Role definitions: 5 roles with bilingual context/placeholders. 角色定义：5 个角色及双语上下文。 |
| `src/config/domain/mode-config.ts` | Mode-specific resolvers: trace context, review steps, quality checks. 模式相关解析器：追溯上下文、审查步骤、质量检查。 |
| `src/config/domain/traceability.task.ts` | Task mode: hierarchy levels (epic/story/task/subtask/bug), dependency context. 任务模式：层级、依赖上下文。 |
| `src/config/domain/traceability.design.ts` | Design mode: requirement levels (stakeholder→test-case), ASPICE mapping. 设计模式：需求层级、ASPICE 映射。 |
| `src/components/settings/LLMSettings.vue` | UI: skill textarea, import/export/reset, modified badges. UI：技能编辑框、导入导出重置、已修改标记。 |

---

## 10. Known Limitations & Future Work / 已知限制与未来规划

### Current Limitations / 当前限制

| # | Issue / 问题 | Impact / 影响 |
|---|---|---|
| 1 | **Single localStorage key for all layers** — user edits to the coach skill override ALL layers, not just the current one. 所有分层共用一个 localStorage key — 用户编辑的技能会覆盖所有分层。 | Switching layers after editing does not restore layer-specific defaults. 编辑后切换分层不会恢复分层默认值。 |
| 2 | **Keyword matching is substring-based** — no semantic understanding, may produce false positives on short words. 关键词匹配基于子串 — 无语义理解，短词可能产生误匹配。 | "task" inside "multitasking" would count as a hit. |
| 3 | **Only 2 registered skills** (coach, analyze) — the registry is underutilized. 仅注册了 2 个技能 — 注册表未充分利用。 | No specialized skills for review, elicitation, or deep-review flows. |
| 4 | **Response format is global** — no per-skill format override. 响应格式是全局的 — 无法按技能覆盖。 | Analyze might benefit from stricter JSON structure rules. |

### Future Enhancements / 未来增强

| # | Enhancement / 增强 | Design Notes / 设计笔记 |
|---|---|---|
| 1 | **Per-layer localStorage keys** — e.g. `coach-skill-task-sys`, `coach-skill-task-sw`. Change `LS_KEY_COACH_SKILL_TASK` to include `activeTaskLayer` in the key. 分层独立的 localStorage key。 | Requires migration logic for existing users. 需要为现有用户提供迁移逻辑。 |
| 2 | **Semantic skill matching** — use LLM embedding or intent classifier instead of substring keywords. 语义技能匹配 — 用 LLM 嵌入或意图分类器替代子串关键词。 | Trade-off: adds latency per request. 权衡：每次请求增加延迟。 |
| 3 | **Skill versioning** — track which version of a skill produced each coach response, for reproducibility. 技能版本管理 — 追踪每次 Coach 响应使用的技能版本。 | Store hash of system prompt alongside coach history. |
| 4 | **Custom skill registry** — let users add new skills with custom keywords and prompts via Settings UI. 自定义技能注册 — 让用户通过设置界面添加自定义技能。 | Extends SKILL_REGISTRY at runtime; persist to localStorage. |
| 5 | **Per-skill response format** — allow analyze skill to enforce structured JSON output. 按技能设置响应格式。 | Add optional `responseFormat` field to `SkillEntry`. |
| 6 | **Skill composition** — allow combining multiple skills (e.g. coach + safety reviewer). 技能组合 — 允许组合多个技能。 | Needs priority/conflict resolution rules. 需要优先级/冲突解决规则。 |

---

## Appendix A: Data Flow Diagram / 附录 A：数据流图

```
┌──────────┐    layer     ┌──────────────┐   activeTaskLayer   ┌─────────────────┐
│ Summary  │─────────────▶│  useForm.ts  │────────────────────▶│ skills/index.ts │
│ Builder  │              │  watcher     │                     │ TASK_SKILL_MAP  │
└──────────┘              └──────┬───────┘                     └────────┬────────┘
                                 │ setRole()                           │
                                 ▼                                     │
                          ┌──────────────┐                             │
                          │ useRole.ts   │                             │
                          │ currentRole  │                             │
                          └──────────────┘                             │
                                                                       │
┌──────────┐  description  ┌──────────────┐  getSystemPrompt()        │
│  Coach   │──────────────▶│  useLLM.ts   │◀──────────────────────────┘
│  Panel   │               │  coach flow  │
└──────────┘               └──────┬───────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼              ▼
             matchSkill()   traceContext    responseFormat
             (registry.ts)  (mode-config)  (response-format.md)
                    │             │              │
                    └─────────────┴──────────────┘
                                  │
                                  ▼
                        ┌─────────────────┐
                        │ LLM API Request │
                        │ { role: system, │
                        │   content: ...} │
                        └─────────────────┘
```

## Appendix B: localStorage Keys / 附录 B：localStorage 键

| Key / 键 | Type | Used By / 使用者 |
|---|---|---|
| `coach-skill-task` | string | Coach skill override (all layers). Coach 技能覆盖。 |
| `analyze-skill` | string | Analyze skill override. 分析技能覆盖。 |
| `response-format` | string | Response format override. 响应格式覆盖。 |
| `coach-skill-enabled` | boolean | Master skill toggle. 技能主开关。 |
| `task-coach-enabled` | boolean | Full-payload toggle. 完整 payload 开关。 |
| `user-role` | string | Selected role. 已选角色。 |

---

*This document is auto-maintained alongside code changes. Update when modifying skill routing logic.*

*本文档随代码变更维护。修改技能路由逻辑时请同步更新。*
