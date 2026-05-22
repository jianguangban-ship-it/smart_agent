import type { UserRole } from '@/composables/useRole'

/**
 * Assumption Detector — scans requirement descriptions for hidden/implicit
 * assumptions that should be made explicit.
 */

export interface Assumption {
  id: string
  categoryEn: string
  categoryZh: string
  messageEn: string
  messageZh: string
  suggestionEn: string
  suggestionZh: string
}

interface AssumptionRule {
  id: string
  roles: UserRole[]
  check: (desc: string) => boolean
  categoryEn: string
  categoryZh: string
  messageEn: string
  messageZh: string
  suggestionEn: string
  suggestionZh: string
}

// ─── Detection patterns ──────────────────────────────────────────────────────

// Implicit hardware/resource assumptions
const ASSUMES_MEMORY = /\b(buffer|cache|queue|stack|heap|store|array|list|map|table|缓存|队列|栈|堆|缓冲)\b/i
const NO_MEMORY_SPEC = /\b(\d+\s*(KB|MB|GB|byte))\b/i

const ASSUMES_TIMING = /\b(real[\s-]?time|periodic|cyclic|interrupt|callback|trigger|timer|timeout|event[\s-]?driven|定时|周期|中断|回调|触发|定时器|超时|事件驱动)\b/i
const NO_TIMING_SPEC = /\b(\d+\s*(ms|us|ns|s|Hz|kHz|MHz))\b/i

const ASSUMES_CONCURRENCY = /\b(thread|task|process|concurrent|parallel|mutex|semaphore|lock|shared|atomic|线程|任务|进程|并发|并行|互斥|信号量|锁|共享|原子)\b/i

const ASSUMES_NETWORK = /\b(send|receive|transmit|message|packet|frame|signal|broadcast|subscribe|publish|发送|接收|传输|消息|数据包|帧|信号|广播|订阅|发布)\b/i
const NO_PROTOCOL_SPEC = /\b(CAN|LIN|SPI|I2C|UART|Ethernet|SOME\/IP|TCP|UDP|HTTP|以太网)\b/i

const ASSUMES_POWER = /\b(sleep|standby|wake[\s-]?up|power[\s-]?(on|off|down|up|mode|save|management)|low[\s-]?power|休眠|待机|唤醒|上电|断电|低功耗|电源管理)\b/i
const NO_POWER_SPEC = /\b(\d+\s*(V|mV|A|mA|W|mW|kW))\b/i

const ASSUMES_TEMP = /\b(hot|cold|warm|cool|thermal|temperature|heat|overheat|freeze|高温|低温|温度|过热|冷却|散热)\b/i
const NO_TEMP_SPEC = /\b(-?\d+\s*°?C|(-?\d+)\s*to\s*(-?\d+))\b/i

const ASSUMES_DEPENDENCY = /\b(after|before|depends on|requires|assumes|prerequisite|once .+ is ready|when .+ completes|在.*之后|在.*之前|依赖|要求|前提|假设|当.*完成)\b/i
const HAS_EXPLICIT_DEP = /\b(REQ[-_]?\w{2,}|[A-Z]{2,5}-\d{2,}|module|component|service|API)\b/i

const ASSUMES_CONFIG = /\b(configur|parameter|setting|option|flag|threshold|constant|default|参数|配置|设置|选项|阈值|常量|默认值)\b/i
const NO_CONFIG_VALUE = /\b(=\s*\d|default[\s:]+\d|range[\s:]+|值[\s:：]+\d|范围[\s:：]+)/i

// ─── Rules ───────────────────────────────────────────────────────────────────

const ASSUMPTION_RULES: AssumptionRule[] = [
  {
    id: 'implicit-memory',
    roles: ['sw-developer', 'hw-designer'],
    check: (desc) => ASSUMES_MEMORY.test(desc) && !NO_MEMORY_SPEC.test(desc),
    categoryEn: 'Resource',
    categoryZh: '资源',
    messageEn: 'Uses memory structures (buffer/cache/queue) but no memory budget specified',
    messageZh: '使用内存结构（缓冲/缓存/队列）但未指定内存预算',
    suggestionEn: 'Add: "Maximum memory usage: ___KB"',
    suggestionZh: '建议补充："最大内存使用：___KB"'
  },
  {
    id: 'implicit-timing',
    roles: ['system-architect', 'sw-developer', 'vv-engineer'],
    check: (desc) => ASSUMES_TIMING.test(desc) && !NO_TIMING_SPEC.test(desc),
    categoryEn: 'Timing',
    categoryZh: '时序',
    messageEn: 'References timing behavior but no specific timing constraints given',
    messageZh: '提及时序行为但未给出具体时序约束',
    suggestionEn: 'Add: "Execution cycle: ___ms" or "Response time: <___ms"',
    suggestionZh: '建议补充："执行周期：___ms" 或 "响应时间：<___ms"'
  },
  {
    id: 'implicit-concurrency',
    roles: ['sw-developer'],
    check: (desc) => ASSUMES_CONCURRENCY.test(desc),
    categoryEn: 'Concurrency',
    categoryZh: '并发',
    messageEn: 'References concurrent execution — ensure thread safety and priority are specified',
    messageZh: '涉及并发执行 — 请确保指定线程安全性和优先级',
    suggestionEn: 'Add: thread priority, shared resource protection, preemption behavior',
    suggestionZh: '建议补充：线程优先级、共享资源保护、抢占行为'
  },
  {
    id: 'implicit-protocol',
    roles: ['system-architect', 'sw-developer', 'hw-designer'],
    check: (desc) => ASSUMES_NETWORK.test(desc) && !NO_PROTOCOL_SPEC.test(desc),
    categoryEn: 'Communication',
    categoryZh: '通信',
    messageEn: 'References data transfer but no communication protocol specified',
    messageZh: '提及数据传输但未指定通信协议',
    suggestionEn: 'Add: protocol (CAN/LIN/Ethernet/SPI), message ID, cycle time',
    suggestionZh: '建议补充：协议（CAN/LIN/以太网/SPI）、消息ID、周期'
  },
  {
    id: 'implicit-power',
    roles: ['system-architect', 'hw-designer', 'me-designer'],
    check: (desc) => ASSUMES_POWER.test(desc) && !NO_POWER_SPEC.test(desc),
    categoryEn: 'Power',
    categoryZh: '功耗',
    messageEn: 'References power states but no power consumption / voltage specs given',
    messageZh: '提及电源状态但未给出功耗/电压规格',
    suggestionEn: 'Add: power consumption per mode, voltage range, wake-up time',
    suggestionZh: '建议补充：各模式功耗、电压范围、唤醒时间'
  },
  {
    id: 'implicit-temp',
    roles: ['hw-designer', 'me-designer'],
    check: (desc) => ASSUMES_TEMP.test(desc) && !NO_TEMP_SPEC.test(desc),
    categoryEn: 'Temperature',
    categoryZh: '温度',
    messageEn: 'References thermal conditions but no temperature range specified',
    messageZh: '提及温度条件但未指定温度范围',
    suggestionEn: 'Add: operating range (e.g., -40°C to +85°C)',
    suggestionZh: '建议补充：工作温度范围（如 -40°C 至 +85°C）'
  },
  {
    id: 'implicit-dependency',
    roles: ['system-architect', 'sw-developer', 'hw-designer', 'me-designer', 'vv-engineer'],
    check: (desc) => ASSUMES_DEPENDENCY.test(desc) && !HAS_EXPLICIT_DEP.test(desc),
    categoryEn: 'Dependency',
    categoryZh: '依赖',
    messageEn: 'References dependencies but no specific component or requirement ID is cited',
    messageZh: '提及依赖关系但未引用具体组件或需求ID',
    suggestionEn: 'Add: specific module/component name or requirement ID (e.g., SYS-REQ-042)',
    suggestionZh: '建议补充：具体模块/组件名称或需求ID（如 SYS-REQ-042）'
  },
  {
    id: 'implicit-config',
    roles: ['sw-developer', 'system-architect'],
    check: (desc) => ASSUMES_CONFIG.test(desc) && !NO_CONFIG_VALUE.test(desc),
    categoryEn: 'Configuration',
    categoryZh: '配置',
    messageEn: 'References configurable parameters but no default values or ranges specified',
    messageZh: '提及可配置参数但未指定默认值或范围',
    suggestionEn: 'Add: default value, valid range, unit',
    suggestionZh: '建议补充：默认值、有效范围、单位'
  }
]

/** Scan description for hidden assumptions */
export function detectAssumptions(
  role: UserRole,
  description: string
): Assumption[] {
  const desc = description.trim()
  if (desc.length < 30) return []

  return ASSUMPTION_RULES
    .filter(r => r.roles.includes(role) && r.check(desc))
    .map(r => ({
      id: r.id,
      categoryEn: r.categoryEn,
      categoryZh: r.categoryZh,
      messageEn: r.messageEn,
      messageZh: r.messageZh,
      suggestionEn: r.suggestionEn,
      suggestionZh: r.suggestionZh
    }))
}
