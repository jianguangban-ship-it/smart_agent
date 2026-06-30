import type { UserRole } from '@/composables/useRole'
import type { ElicitationQuestion, ElicitationSet } from './types'

/**
 * Explore-mode elicitation — general-purpose requirement elicitation
 * questions that guide users step-by-step through clarifying their needs
 * before writing. Not domain-specific (unlike design mode's INCOSE focus
 * or task mode's scoping focus).
 */

const COMMON_QUESTIONS: ElicitationQuestion[] = [
  {
    questionEn: 'What problem or need does this requirement address?',
    questionZh: '这条需求要解决什么问题或满足什么需要？',
    hintEn: 'Establishes the "why" — the motivation behind the requirement',
    hintZh: '明确"为什么"——需求背后的动机'
  },
  {
    questionEn: 'Who are the stakeholders or end users affected?',
    questionZh: '受影响的利益相关者或最终用户是谁？',
    hintEn: 'Identifies audience and impact scope',
    hintZh: '识别受众和影响范围'
  },
  {
    questionEn: 'What is the desired behavior or outcome?',
    questionZh: '期望的行为或结果是什么？',
    hintEn: 'Defines the "what" concretely',
    hintZh: '具体定义"做什么"'
  },
  {
    questionEn: 'Are there any constraints — technical, regulatory, budget, or timeline?',
    questionZh: '是否存在约束条件——技术、法规、预算或时间方面？',
    hintEn: 'Surfaces boundaries and limitations',
    hintZh: '暴露边界和限制条件'
  },
  {
    questionEn: 'What are the inputs and expected outputs?',
    questionZh: '输入和预期输出是什么？',
    hintEn: 'Makes the requirement testable and concrete',
    hintZh: '使需求可测试且具体'
  },
  {
    questionEn: 'How will you verify this requirement is met?',
    questionZh: '如何验证这条需求已被满足？',
    hintEn: 'Ensures verifiability — test, review, analysis, or demo',
    hintZh: '确保可验证性——测试、评审、分析或演示'
  },
  {
    questionEn: 'Are there edge cases, failure modes, or exceptions to consider?',
    questionZh: '是否有需要考虑的边界情况、故障模式或异常？',
    hintEn: 'Covers negative scenarios and robustness',
    hintZh: '覆盖负面场景和鲁棒性'
  },
  {
    questionEn: 'Does this depend on or conflict with any existing requirements?',
    questionZh: '这条需求是否依赖或与现有需求冲突？',
    hintEn: 'Checks consistency and dependency',
    hintZh: '检查一致性和依赖关系'
  }
]

const ROLE_QUESTIONS: Record<UserRole, ElicitationQuestion[]> = {
  '': [],
  'system-architect': [
    {
      questionEn: 'Which subsystems or components are involved in this requirement?',
      questionZh: '哪些子系统或组件涉及此需求？',
      hintEn: 'Clarifies architectural scope',
      hintZh: '明确架构范围'
    },
    {
      questionEn: 'What are the key interfaces between the affected components?',
      questionZh: '受影响组件之间的关键接口是什么？',
      hintEn: 'Identifies integration points early',
      hintZh: '尽早识别集成点'
    }
  ],
  'sw-developer': [
    {
      questionEn: 'What are the exact input/output data types and value ranges?',
      questionZh: '确切的输入/输出数据类型和取值范围是什么？',
      hintEn: 'Prevents ambiguity in implementation',
      hintZh: '避免实现中的歧义'
    },
    {
      questionEn: 'What error handling or fallback behavior is expected?',
      questionZh: '期望什么样的错误处理或降级行为？',
      hintEn: 'Defines behavior under failure conditions',
      hintZh: '定义故障条件下的行为'
    }
  ],
  'app-developer': [
    {
      questionEn: 'What are the algorithm inputs/outputs, units, and valid ranges?',
      questionZh: '算法的输入/输出、单位和有效范围是什么？',
      hintEn: 'Prevents ambiguity in algorithm implementation',
      hintZh: '避免算法实现中的歧义'
    },
    {
      questionEn: 'What is the expected behavior at limits or under degraded sensor input?',
      questionZh: '在极限工况或传感器降级输入下期望的行为是什么？',
      hintEn: 'Defines robustness and fallback strategy',
      hintZh: '定义鲁棒性与降级策略'
    }
  ],
  'hw-designer': [
    {
      questionEn: 'What are the key electrical or physical parameters?',
      questionZh: '关键的电气或物理参数是什么？',
      hintEn: 'Quantitative hardware specifications',
      hintZh: '量化硬件规格'
    },
    {
      questionEn: 'What environmental conditions must the design withstand?',
      questionZh: '设计必须承受什么环境条件？',
      hintEn: 'Operating environment constraints',
      hintZh: '工作环境约束'
    }
  ],
  'me-designer': [
    {
      questionEn: 'What are the mechanical packaging and mounting constraints?',
      questionZh: '机械封装和安装约束是什么？',
      hintEn: 'Physical design boundaries',
      hintZh: '物理设计边界'
    },
    {
      questionEn: 'What material or manufacturing process requirements apply?',
      questionZh: '适用什么材料或制造工艺要求？',
      hintEn: 'Manufacturing feasibility',
      hintZh: '制造可行性'
    }
  ],
  'vv-engineer': [
    {
      questionEn: 'What verification methods and test environments are needed?',
      questionZh: '需要什么验证方法和测试环境？',
      hintEn: 'Test planning and resource needs',
      hintZh: '测试规划和资源需求'
    },
    {
      questionEn: 'What are the measurable pass/fail criteria?',
      questionZh: '可度量的通过/失败标准是什么？',
      hintEn: 'Ensures objective evaluation',
      hintZh: '确保客观评估'
    }
  ],
  'fusa-engineer': [
    {
      questionEn: 'What hazard and safety goal (with ASIL) is in scope, and what is the safe state?',
      questionZh: '涉及哪个危害与安全目标（含 ASIL）？安全状态是什么？',
      hintEn: 'Frames the safety concept from the HARA',
      hintZh: '从 HARA 出发界定安全概念'
    },
    {
      questionEn: 'What safety mechanism and analysis (FMEDA/FTA/DFA) will demonstrate it?',
      questionZh: '用什么安全机制与分析（FMEDA/FTA/DFA）来论证？',
      hintEn: 'Links mechanism to quantified evidence',
      hintZh: '将安全机制与量化证据关联'
    }
  ],
  'devops-engineer': [
    {
      questionEn: 'What environments and toolchain versions must this run reproducibly on?',
      questionZh: '需要在哪些环境和工具链版本上可复现地运行？',
      hintEn: 'Pins reproducibility constraints early',
      hintZh: '尽早固定可复现性约束'
    },
    {
      questionEn: 'What monitoring, alerting, or rollback is expected on failure?',
      questionZh: '故障时期望什么样的监控、告警或回滚？',
      hintEn: 'Defines operational behavior under failure',
      hintZh: '定义故障下的运维行为'
    }
  ],
  'pmo-manager': [
    {
      questionEn: 'What is the project scope, and what is explicitly out of scope?',
      questionZh: '项目范围是什么？哪些明确不在范围内？',
      hintEn: 'Prevents scope ambiguity',
      hintZh: '避免范围歧义'
    },
    {
      questionEn: 'Who are the stakeholders, and what are the key deliverables and deadlines?',
      questionZh: '利益相关方是谁？关键交付物和截止日期是什么？',
      hintEn: 'Aligns expectations and timeline',
      hintZh: '对齐预期与时间线'
    }
  ]
}

/** Get the full explore-mode elicitation question set for a role */
export function getExploreElicitationSet(role: UserRole, lang: 'zh' | 'en'): ElicitationSet {
  const roleQs = ROLE_QUESTIONS[role] || []
  return {
    titleEn: 'Requirement Elicitation',
    titleZh: '需求引导',
    questions: [...COMMON_QUESTIONS, ...roleQs]
  }
}

/** Build explore-mode elicitation prompt text for the LLM */
export function buildExploreElicitationPrompt(role: UserRole, lang: 'zh' | 'en'): string {
  const set = getExploreElicitationSet(role, lang)
  const lines: string[] = []

  if (lang === 'zh') {
    lines.push('请作为需求引导教练，逐一向用户提出以下问题，帮助他们从零开始理清需求。每次只问一个问题，等待用户回答后再继续下一个。根据用户的回答，追问细节或跳过不相关的问题。最后，基于所有回答，帮助用户起草一条完整、清晰、可验证的需求描述。')
    lines.push('')
    lines.push('## 需求引导问题')
    for (let i = 0; i < set.questions.length; i++) {
      const q = set.questions[i]
      lines.push(`${i + 1}. ${q.questionZh}`)
      lines.push(`   _（${q.hintZh}）_`)
    }
    lines.push('')
    lines.push('先从第一个问题开始。保持友好专业的语气。如果用户的回答不够具体，请温和地追问以获取更多细节。')
  } else {
    lines.push('Act as a Requirement Elicitation Coach. Guide the user through the following questions one at a time to help them clarify their requirement from scratch. Wait for their answer before moving to the next question. Based on their answers, probe for details or skip irrelevant questions. At the end, help draft a complete, clear, and verifiable requirement description based on all answers.')
    lines.push('')
    lines.push('## Elicitation Questions')
    for (let i = 0; i < set.questions.length; i++) {
      const q = set.questions[i]
      lines.push(`${i + 1}. ${q.questionEn}`)
      lines.push(`   _(${q.hintEn})_`)
    }
    lines.push('')
    lines.push('Start with the first question. Use a friendly, professional tone. If the user\'s answer is vague, gently probe for more specific details.')
  }

  return lines.join('\n')
}
