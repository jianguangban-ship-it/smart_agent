import type { UserRole } from '@/composables/useRole'
import type { ElicitationQuestion, ElicitationSet } from './types'

const COMMON_QUESTIONS: ElicitationQuestion[] = [
  {
    questionEn: 'What is the specific deliverable or outcome of this task?',
    questionZh: '这个任务的具体交付物或成果是什么？',
    hintEn: 'Ensures the task has a clear, tangible goal',
    hintZh: '确保任务有明确、具体的目标'
  },
  {
    questionEn: 'What are the acceptance criteria? How will you know it\'s done?',
    questionZh: '验收标准是什么？如何判断任务完成？',
    hintEn: 'Defines measurable done-ness',
    hintZh: '定义可度量的完成标准'
  },
  {
    questionEn: 'Does this task depend on or block any other tasks?',
    questionZh: '这个任务是否依赖或阻塞其他任务？',
    hintEn: 'Identifies scheduling dependencies',
    hintZh: '识别调度依赖关系'
  },
  {
    questionEn: 'What\'s the estimated effort? (story points or hours)',
    questionZh: '预估工作量是多少？（故事点或工时）',
    hintEn: 'Supports sprint planning',
    hintZh: '支持迭代规划'
  },
  {
    questionEn: 'Are there any risks or unknowns that could delay this?',
    questionZh: '是否存在可能导致延迟的风险或未知因素？',
    hintEn: 'Surfaces blockers early',
    hintZh: '尽早暴露阻塞因素'
  }
]

const ROLE_QUESTIONS: Record<UserRole, ElicitationQuestion[]> = {
  '': [],
  'system-architect': [
    {
      questionEn: 'Which subsystems or teams are affected?',
      questionZh: '涉及哪些子系统或团队？',
      hintEn: 'Cross-team coordination',
      hintZh: '跨团队协调'
    },
    {
      questionEn: 'Are there interface or integration impacts?',
      questionZh: '是否有接口或集成影响？',
      hintEn: 'System-level impact assessment',
      hintZh: '系统级影响评估'
    }
  ],
  'sw-developer': [
    {
      questionEn: 'Which modules or files will be touched?',
      questionZh: '需要修改哪些模块或文件？',
      hintEn: 'Scopes the code change',
      hintZh: '界定代码变更范围'
    },
    {
      questionEn: 'What is the unit/integration test approach?',
      questionZh: '单元/集成测试方案是什么？',
      hintEn: 'Test strategy before coding',
      hintZh: '编码前确定测试策略'
    }
  ],
  'app-developer': [
    {
      questionEn: 'Which control algorithm/module is affected? (braking, steering, suspension, motion observer)',
      questionZh: '涉及哪个控制算法/模块？（制动、转向、悬架、运动观测器）',
      hintEn: 'Scopes the algorithm change',
      hintZh: '界定算法变更范围'
    },
    {
      questionEn: 'What is the validation approach? (MIL/SIL/HIL/bench/vehicle)',
      questionZh: '验证方案是什么？（MIL/SIL/HIL/台架/实车）',
      hintEn: 'Algorithm test strategy',
      hintZh: '算法测试策略'
    }
  ],
  'hw-designer': [
    {
      questionEn: 'Which component or board is affected?',
      questionZh: '涉及哪个器件或板卡？',
      hintEn: 'Hardware scope',
      hintZh: '硬件范围'
    },
    {
      questionEn: 'Is a schematic or layout change needed?',
      questionZh: '是否需要修改原理图或布局？',
      hintEn: 'Design impact',
      hintZh: '设计影响'
    }
  ],
  'me-designer': [
    {
      questionEn: 'What assembly or packaging changes are needed?',
      questionZh: '需要什么装配或包装变更？',
      hintEn: 'Mechanical scope',
      hintZh: '机械范围'
    },
    {
      questionEn: 'Are there tooling or fixture implications?',
      questionZh: '是否涉及工装或夹具？',
      hintEn: 'Manufacturing impact',
      hintZh: '制造影响'
    }
  ],
  'vv-engineer': [
    {
      questionEn: 'What is the test scope and expected coverage?',
      questionZh: '测试范围和预期覆盖率是什么？',
      hintEn: 'V&V planning',
      hintZh: '验证规划'
    },
    {
      questionEn: 'Which test environment is needed? (HIL/SIL/bench/vehicle)',
      questionZh: '需要什么测试环境？（HIL/SIL/台架/实车）',
      hintEn: 'Resource planning',
      hintZh: '资源规划'
    }
  ],
  'devops-engineer': [
    {
      questionEn: 'Which pipeline stages or build/release jobs are affected?',
      questionZh: '涉及哪些流水线阶段或构建/发布任务？',
      hintEn: 'Scopes the CI/CD change',
      hintZh: '界定 CI/CD 变更范围'
    },
    {
      questionEn: 'What is the rollback / failure-recovery strategy?',
      questionZh: '回滚/失败恢复策略是什么？',
      hintEn: 'Operational safety before deployment',
      hintZh: '部署前的运维安全保障'
    }
  ]
}

export function getTaskScopingSet(role: UserRole, lang: 'zh' | 'en'): ElicitationSet {
  const roleQs = ROLE_QUESTIONS[role] || []
  return {
    titleEn: 'Task Scoping',
    titleZh: '任务范围界定',
    questions: [...COMMON_QUESTIONS, ...roleQs]
  }
}

export function buildTaskScopingPrompt(role: UserRole, lang: 'zh' | 'en'): string {
  const set = getTaskScopingSet(role, lang)
  const lines: string[] = []

  if (lang === 'zh') {
    lines.push('请作为任务规划教练，逐一向用户提出以下问题，帮助他们在创建任务前理清范围和交付物。每次只问一个问题，等待用户回答后再继续。根据回答追问或跳过不相关的问题。最后，帮助用户生成一条完整的任务描述。')
    lines.push('')
    lines.push('## 任务范围界定问题')
    for (let i = 0; i < set.questions.length; i++) {
      const q = set.questions[i]
      lines.push(`${i + 1}. ${q.questionZh}`)
      lines.push(`   _（${q.hintZh}）_`)
    }
    lines.push('')
    lines.push('先从第一个问题开始。保持友好专业的语气。')
  } else {
    lines.push('Act as a Task Scoping Coach. Ask the user the following questions one at a time to help them clarify scope and deliverables before creating the task. Wait for their answer before moving to the next question. Based on answers, probe for details or skip irrelevant questions. At the end, help draft a complete task description.')
    lines.push('')
    lines.push('## Task Scoping Questions')
    for (let i = 0; i < set.questions.length; i++) {
      const q = set.questions[i]
      lines.push(`${i + 1}. ${q.questionEn}`)
      lines.push(`   _(${q.hintEn})_`)
    }
    lines.push('')
    lines.push('Start with the first question. Use a friendly, professional tone.')
  }

  return lines.join('\n')
}
