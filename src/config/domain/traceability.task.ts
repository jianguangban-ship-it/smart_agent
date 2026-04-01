import type { UserRole } from '@/composables/useRole'
import type { TraceabilityGap } from './types'

export type TaskLevel = 'none' | 'epic' | 'story' | 'task' | 'subtask' | 'bug'

export interface TaskLevelDef {
  id: TaskLevel
  labelEn: string
  labelZh: string
  shortEn: string
  shortZh: string
  roles: UserRole[]
  parentLevels: TaskLevel[]
  childLevels: TaskLevel[]
}

export const TASK_LEVELS: TaskLevelDef[] = [
  {
    id: 'epic',
    labelEn: 'Epic',
    labelZh: '史诗',
    shortEn: 'EPIC',
    shortZh: '史诗',
    roles: ['system-architect'],
    parentLevels: [],
    childLevels: ['story']
  },
  {
    id: 'story',
    labelEn: 'User Story',
    labelZh: '用户故事',
    shortEn: 'STORY',
    shortZh: '故事',
    roles: ['system-architect', 'sw-developer', 'hw-designer', 'me-designer', 'vv-engineer'],
    parentLevels: ['epic'],
    childLevels: ['task', 'subtask']
  },
  {
    id: 'task',
    labelEn: 'Task',
    labelZh: '任务',
    shortEn: 'TASK',
    shortZh: '任务',
    roles: ['sw-developer', 'hw-designer', 'me-designer', 'vv-engineer', ''],
    parentLevels: ['story', 'epic'],
    childLevels: ['subtask']
  },
  {
    id: 'subtask',
    labelEn: 'Sub-task',
    labelZh: '子任务',
    shortEn: 'SUB',
    shortZh: '子任务',
    roles: ['sw-developer', 'hw-designer', 'me-designer', 'vv-engineer', ''],
    parentLevels: ['task', 'story'],
    childLevels: []
  },
  {
    id: 'bug',
    labelEn: 'Bug',
    labelZh: '缺陷',
    shortEn: 'BUG',
    shortZh: '缺陷',
    roles: ['sw-developer', 'hw-designer', 'vv-engineer', ''],
    parentLevels: ['story', 'epic'],
    childLevels: ['subtask']
  }
]

export function getDefaultTaskLevel(_role: UserRole): TaskLevel {
  return 'task'
}

export function getTaskLevelsForRole(role: UserRole): TaskLevelDef[] {
  if (!role) return TASK_LEVELS
  return TASK_LEVELS.filter(l => l.roles.includes(role))
}

export function getTaskLevelDef(level: TaskLevel): TaskLevelDef | undefined {
  return TASK_LEVELS.find(l => l.id === level)
}

export function checkTaskDependencyGaps(
  level: TaskLevel,
  parentId: string
): TraceabilityGap[] {
  const gaps: TraceabilityGap[] = []
  const def = getTaskLevelDef(level)
  if (!def) return gaps

  if (def.parentLevels.length > 0 && !parentId.trim()) {
    const parentNames = def.parentLevels.join('/')
    gaps.push({
      id: 'no-parent',
      messageEn: `No parent linked — ${def.shortEn} should be linked to a ${parentNames}`,
      messageZh: `未关联上级 — ${def.shortZh}应关联到${parentNames}`,
      severity: 'warning'
    })
  }

  return gaps
}

export function buildTaskDependencyContext(
  level: TaskLevel,
  parentId: string,
  lang: 'zh' | 'en'
): string {
  const def = getTaskLevelDef(level)
  if (!def) return ''

  const lines: string[] = []

  if (lang === 'zh') {
    lines.push('## 任务层级')
    lines.push(`- **任务类型**: ${def.labelZh}`)
    if (parentId) lines.push(`- **上级任务**: ${parentId}`)
    if (def.childLevels.length > 0) {
      const children = def.childLevels.map(id => TASK_LEVELS.find(l => l.id === id)?.labelZh).filter(Boolean).join('、')
      lines.push(`- **可包含**: ${children}`)
    }
  } else {
    lines.push('## Task Hierarchy')
    lines.push(`- **Task Type**: ${def.labelEn}`)
    if (parentId) lines.push(`- **Parent**: ${parentId}`)
    if (def.childLevels.length > 0) {
      const children = def.childLevels.map(id => TASK_LEVELS.find(l => l.id === id)?.labelEn).filter(Boolean).join(', ')
      lines.push(`- **Can contain**: ${children}`)
    }
  }

  return lines.join('\n')
}
