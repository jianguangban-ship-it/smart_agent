import { ref, computed } from 'vue'
import type { LLMRequestBody, LLMStreamChunk, LLMChatMessage, WebhookPayload, ChatMessage } from '@/types/api'
import { getProviderUrl, getApiKey, getModel } from '@/config/llm'
import { ICONS } from '@/config/icons'
import { getCoachSkill, getAnalyzeSkill, getResponseFormat } from '@/config/skills/index'
import { SKILL_REGISTRY, resolveSystemPrompt } from '@/config/skills/registry'
import type { SkillEntry } from '@/config/skills/registry'
import { matchSkill } from '@/utils/skillMatcher'
import { currentRole } from '@/composables/useRole'
import { appMode } from '@/composables/useAppMode'
import { getModeTraceContext, buildDeepReviewPrompt } from '@/config/domain'
import { useReviewHistory } from '@/composables/useReviewHistory'
import type { TaskLevel } from '@/config/domain/traceability.task'
import { useI18n } from '@/i18n'
import { addRecord, setSessionId } from '@/composables/useCoachHistory'
import type { CoachHistoryRecord, CoachChannel } from '@/types/api'

// Hoisted function (no TDZ) so the localStorage key is reachable from
// getCoachSkillRef() even when called during the circular-import cycle below.
function lsKeyCoachSkillEnabled(): string { return 'coach-skill-enabled' }

// Sole skill flag: ON in Task mode (full coach skill + structured task payload),
// OFF in Explore mode (free chat with Response Format only). Driven by useAppMode's
// applyModeFlags(); tool handlers (elicitation, conflict-check, etc.) temporarily flip
// it OFF to bypass the canSubmit guard, then applyModeFlags re-asserts on return.
//
// Created via a hoisted function (getCoachSkillRef) so it survives a
// circular-import init-order hazard: the `@/composables/useAppMode` import
// (below) runs applyModeFlags() → setCoachSkillEnabled() at module-evaluation
// time, BEFORE this module's body executes. A plain `const = ref()` (or `let`)
// would be in the temporal dead zone at that point and crash. Function
// declarations are hoisted, so getCoachSkillRef() is callable during the cycle;
// it returns a single shared, genuine Vue Ref (stored in a hoisted `var`), so
// every importer and consumer still gets the same reactive ref.
var _coachSkillEnabledRef: ReturnType<typeof ref<boolean>> | undefined // eslint-disable-line no-var
function getCoachSkillRef(): ReturnType<typeof ref<boolean>> {
  if (!_coachSkillEnabledRef) {
    _coachSkillEnabledRef = ref(localStorage.getItem(lsKeyCoachSkillEnabled()) !== 'false')
  }
  return _coachSkillEnabledRef
}
export const coachSkillEnabled = getCoachSkillRef()

export const activeSkill = ref<SkillEntry | null>(null)

export const ignoredSkillId = ref<string | null>(null)

export function setCoachSkillEnabled(val: boolean): void {
  getCoachSkillRef().value = val
  localStorage.setItem(lsKeyCoachSkillEnabled(), String(val))
}

/** Tagged error class for HTTP 429 so callers can start backoff instead of showing an error */
class GLM429Error extends Error {
  constructor(msg: string) { super(msg); this.name = 'GLM429Error' }
}

let _msgIdCounter = 0
function nextMsgId(): string {
  return `msg-${Date.now()}-${++_msgIdCounter}`
}

// ─── Stream flow factory ──────────────────────────────────────────────────────
// Eliminates duplication between Coach and Analyze flows.
// Fixes: timer leak on concurrent 429, infinite retry loop (max 3).

const MAX_429_RETRIES = 3

interface StreamFlowOptions {
  getSystemPrompt: (lang: 'en' | 'zh', payload: WebhookPayload) => string
  getUserMessage: (payload: WebhookPayload, isZh: boolean) => string
  onBeforeRequest?: (currentResponse: unknown) => void
  /** When true, uses chat message array model instead of single response */
  chatMode?: boolean
  channel?: CoachChannel  // 'task' | 'explore'
}

function createStreamFlow(
  opts: StreamFlowOptions,
  callStream: (
    messages: LLMChatMessage[],
    onChunk: (text: string) => void,
    signal: AbortSignal
  ) => Promise<void>,
  t: (key: string) => string,
  isZh: { value: boolean }
) {
  const isLoading = ref(false)
  const response = ref<unknown>(null)
  const wasCancelled = ref(false)
  const hadError = ref(false)
  const streamSpeed = ref(0)
  const backoffSecs = ref(0)

  // Chat mode: message array
  const messages = ref<ChatMessage[]>([])

  let _ac: AbortController | null = null
  let _lastPayload: WebhookPayload | null = null
  let _backoffTimer: number | null = null
  let _retryCount = 0

  async function request(payload: WebhookPayload, _isAutoRetry = false): Promise<string | null> {
    // Clear any existing backoff timer to prevent timer leak
    if (_backoffTimer !== null) {
      clearInterval(_backoffTimer)
      _backoffTimer = null
    }

    // Reset retry count on fresh user-initiated calls
    if (!_isAutoRetry) _retryCount = 0

    _lastPayload = payload
    wasCancelled.value = false
    hadError.value = false
    streamSpeed.value = 0
    backoffSecs.value = 0
    isLoading.value = true

    const lang: 'en' | 'zh' = isZh.value ? 'zh' : 'en'
    const systemPrompt = opts.getSystemPrompt(lang, payload)
    const userMessage = opts.getUserMessage(payload, isZh.value)

    if (opts.chatMode) {
      // Chat mode: push user message, then stream assistant reply
      if (!_isAutoRetry) {
        messages.value.push({
          id: nextMsgId(),
          role: 'user',
          content: userMessage,
          timestamp: Date.now()
        })
        // Save user message to global coach history
        if (opts.chatMode) {
          const record = addRecord('user', userMessage, opts.channel ?? 'task')
          messages.value[messages.value.length - 1].hashId = record.id
        }
      }

      // Add empty assistant message placeholder
      const assistantMsg: ChatMessage = {
        id: nextMsgId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true
      }
      messages.value.push(assistantMsg)
      // Also set response for backward compat (DevTools etc.)
      response.value = null
    } else {
      opts.onBeforeRequest?.(response.value)
      response.value = null
    }

    _ac = new AbortController()

    try {
      let accumulated = ''
      let tokenCount = 0
      let streamStart = 0

      // Build API messages array
      const apiMessages: LLMChatMessage[] = []
      if (systemPrompt) {
        apiMessages.push({ role: 'system', content: systemPrompt })
      }

      if (opts.chatMode) {
        // Send full conversation history (excluding the current empty assistant placeholder)
        for (const msg of messages.value) {
          if (msg === messages.value[messages.value.length - 1]) break // skip the empty assistant placeholder
          apiMessages.push({ role: msg.role, content: msg.content })
        }
      } else {
        apiMessages.push({ role: 'user', content: userMessage })
      }

      await callStream(apiMessages, (chunk) => {
        if (tokenCount === 0) streamStart = Date.now()
        tokenCount++
        accumulated += chunk

        if (opts.chatMode) {
          // Update the last assistant message in the array
          const lastMsg = messages.value[messages.value.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = accumulated
          }
          // Also update response ref for backward compat
          response.value = { markdown_msg: accumulated, message: accumulated }
        } else {
          response.value = { markdown_msg: accumulated, message: accumulated }
        }

        const elapsed = (Date.now() - streamStart) / 1000
        if (elapsed > 0) streamSpeed.value = Math.round(tokenCount / elapsed)
      }, _ac.signal)

      // Mark streaming complete
      if (opts.chatMode) {
        const lastMsg = messages.value[messages.value.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.isStreaming = false
          // Save completed coach response to global history
          if (lastMsg.content) {
            const record = addRecord('assistant', lastMsg.content, opts.channel ?? 'task')
            lastMsg.hashId = record.id
          }
        }
      }

      return null
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        wasCancelled.value = true
        streamSpeed.value = 0
        // Mark streaming stopped on cancel
        if (opts.chatMode) {
          const lastMsg = messages.value[messages.value.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.isStreaming = false
          }
        }
        return 'cancelled'
      }
      if (error instanceof GLM429Error) {
        // Remove the empty assistant placeholder on 429 so retry can re-add it
        if (opts.chatMode) {
          const lastMsg = messages.value[messages.value.length - 1]
          if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content) {
            messages.value.pop()
          }
        }
        _retryCount++
        if (_retryCount >= MAX_429_RETRIES) {
          streamSpeed.value = 0
          hadError.value = true
          return t('error.maxRetries')
        }
        backoffSecs.value = 10
        _backoffTimer = window.setInterval(async () => {
          backoffSecs.value--
          if (backoffSecs.value <= 0) {
            clearInterval(_backoffTimer!)
            _backoffTimer = null
            if (_lastPayload) await request(_lastPayload, true)
          }
        }, 1000)
        return null
      }
      streamSpeed.value = 0
      hadError.value = true
      // Mark streaming stopped on error
      if (opts.chatMode) {
        const lastMsg = messages.value[messages.value.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.isStreaming = false
        }
      }
      return error instanceof Error ? error.message : t('error.requestFailed')
    } finally {
      _ac = null
      isLoading.value = false
    }
  }

  function cancel() {
    _ac?.abort()
    if (_backoffTimer !== null) {
      clearInterval(_backoffTimer)
      _backoffTimer = null
      backoffSecs.value = 0
    }
  }

  async function retry(): Promise<string | null> {
    if (!_lastPayload) return null
    return request(_lastPayload)
  }

  function clear() {
    messages.value = []
    response.value = null
    wasCancelled.value = false
    hadError.value = false
    streamSpeed.value = 0
    backoffSecs.value = 0
  }

  return { isLoading, response, messages, wasCancelled, hadError, streamSpeed, backoffSecs,
           request, cancel, retry, clear, _config: opts }
}

// ─── Main composable ──────────────────────────────────────────────────────────

export function useLLM() {
  const { isZh, t } = useI18n()
  const { buildLearningContext } = useReviewHistory()

  // ─── Shared helpers ────────────────────────────────────────────────────────

  /** Build the LLM user message from payload data fields. Only includes fields present in the payload. */
  function buildUserMessage(payload: WebhookPayload, zh: boolean): string {
    const d = payload.data
    const lines: string[] = []

    if (zh) {
      lines.push('请帮我审阅以下 JIRA 任务描述并给出改进建议：')
      lines.push('')
      if (d.project_name) lines.push(`**项目**: ${d.project_name}`)
      if (d.issue_type) lines.push(`**任务类型**: ${d.issue_type}`)
      if (d.summary) lines.push(`**摘要**: ${d.summary}`)
      lines.push(`**描述**:\n${d.description || '（未填写）'}`)
      if (d.assignee !== undefined) lines.push(`**经办人**: ${d.assignee || '（未分配）'}`)
      if (d.estimated_points !== undefined) lines.push(`**故事点**: ${d.estimated_points}`)
      if (d.requirement_level) lines.push(`**需求层级**: ${d.requirement_level}`)
      if (d.parent_req_id) lines.push(`**上级需求**: ${d.parent_req_id}`)
      if (d.verification_method) lines.push(`**验证方法**: ${d.verification_method}`)
    } else {
      lines.push('Please review the following JIRA task description and provide improvement suggestions:')
      lines.push('')
      if (d.project_name) lines.push(`**Project**: ${d.project_name}`)
      if (d.issue_type) lines.push(`**Issue Type**: ${d.issue_type}`)
      if (d.summary) lines.push(`**Summary**: ${d.summary}`)
      lines.push(`**Description**:\n${d.description || '(empty)'}`)
      if (d.assignee !== undefined) lines.push(`**Assignee**: ${d.assignee || '(unassigned)'}`)
      if (d.estimated_points !== undefined) lines.push(`**Story Points**: ${d.estimated_points}`)
      if (d.requirement_level) lines.push(`**Requirement Level**: ${d.requirement_level}`)
      if (d.parent_req_id) lines.push(`**Parent Requirement**: ${d.parent_req_id}`)
      if (d.verification_method) lines.push(`**Verification Method**: ${d.verification_method}`)
    }

    return lines.join('\n')
  }

  function _restoreInto(
    flow: ReturnType<typeof createStreamFlow>,
    records: CoachHistoryRecord[],
    channel: CoachChannel
  ) {
    flow.clear()
    if (channel === 'task') { activeSkill.value = null; ignoredSkillId.value = null }
    for (const r of records) {
      flow.messages.value.push({
        id: nextMsgId(), role: r.role, content: r.content,
        timestamp: r.timestamp, hashId: r.id,
      })
    }
    if (records.length && records[0].sessionId) {
      setSessionId(channel, records[0].sessionId)
    }
  }

  async function _callGLMStream(
    apiMessages: LLMChatMessage[],
    onChunk: (text: string) => void,
    signal: AbortSignal
  ): Promise<void> {
    const apiKey = getApiKey()
    if (!apiKey) {
      throw new Error(
        isZh.value
          ? `GLM API Key 未配置，请点击右上角 ${ICONS.settings} 进行设置。`
          : `GLM API Key not set. Please click ${ICONS.settings} in the header to configure it.`
      )
    }

    const body: LLMRequestBody & { stream: true } = {
      model: getModel(),
      stream: true,
      messages: apiMessages
    }

    // Normalize: if user entered a base URL (e.g. https://host/v1), append /chat/completions
    const rawUrl = getProviderUrl()
    const endpointUrl = rawUrl.endsWith('/chat/completions') ? rawUrl : rawUrl.replace(/\/$/, '') + '/chat/completions'

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal
    })

    if (!response.ok) {
      if (response.status === 401) throw new Error(t('error.glm401'))
      if (response.status === 429) throw new GLM429Error(t('error.glm429'))
      if (response.status >= 500) throw new Error(t('error.glm5xx'))
      const errText = await response.text().catch(() => '')
      throw new Error(`GLM API ${response.status}: ${errText || response.statusText}`)
    }

    if (!response.body) throw new Error('Response body is not readable')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        if (signal.aborted) break
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') return
          try {
            const chunk = JSON.parse(data) as LLMStreamChunk
            const content = chunk.choices?.[0]?.delta?.content
            if (content) onChunk(content)
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  // ─── Coach flows (chat mode) — independent task & explore channels ─────────

  // Task channel — task-requirement coaching (skill + trace logic, unchanged).
  const taskCoach = createStreamFlow({
    chatMode: true,
    channel: 'task',
    getSystemPrompt: (lang, payload) => {
      const langKey = lang === 'zh' ? 'zh' as const : 'en' as const
      const rawInput = payload.data.description || ''
      const matched = matchSkill(rawInput, SKILL_REGISTRY, langKey)
      let basePrompt: string
      if (matched && matched.id !== ignoredSkillId.value) {
        if (ignoredSkillId.value && matched.id !== ignoredSkillId.value) ignoredSkillId.value = null
        activeSkill.value = matched
        basePrompt = resolveSystemPrompt(matched, langKey)
      } else {
        activeSkill.value = null
        basePrompt = getCoachSkill('task', lang)
      }
      const traceCtx = getModeTraceContext('task',
        (payload.data.requirement_level || 'none') as TaskLevel,
        payload.data.parent_req_id || '', langKey)
      return [traceCtx, basePrompt].filter(Boolean).join('\n\n')
    },
    getUserMessage: (payload, zh) => buildUserMessage(payload, zh),
  }, _callGLMStream, t, isZh)

  // Explore channel — free chat on any topic (Response Format only).
  const exploreCoach = createStreamFlow({
    chatMode: true,
    channel: 'explore',
    getSystemPrompt: () => getResponseFormat(),
    getUserMessage: (payload) => payload.data.description || '',
  }, _callGLMStream, t, isZh)

  // Active-channel alias for read-only shared consumers (DevTools/TaskForm).
  const activeCoach = computed(() =>
    appMode.value === 'explore' ? exploreCoach : taskCoach)

  // ─── Analyze flow ───────────────────────────────────────────────────────────

  const previousAnalyzeResponse = ref<unknown>(null)

  const analyze = createStreamFlow({
    getSystemPrompt: (lang, payload) => {
      const langKey = lang === 'zh' ? 'zh' as const : 'en' as const
      const traceCtx = getModeTraceContext(appMode.value,
        (payload.data.requirement_level || 'none') as TaskLevel,
        payload.data.parent_req_id || '',
        langKey
      )
      const learningCtx = buildLearningContext(langKey)
      const parts = [traceCtx, learningCtx, getAnalyzeSkill(appMode.value, lang)].filter(Boolean)
      return parts.join('\n\n')
    },
    getUserMessage: (payload, zh) => buildUserMessage(payload, zh),
    onBeforeRequest: (currentResponse) => {
      previousAnalyzeResponse.value = currentResponse
    }
  }, _callGLMStream, t, isZh)

  // ─── Deep Review flag ──────────────────────────────────────────────────────
  // When true, the last analyze response came from a multi-perspective deep review
  const isDeepReview = ref(false)

  // ─── Public API (preserve existing interface) ───────────────────────────────

  return {
    // Task channel
    isTaskCoachLoading: taskCoach.isLoading,
    taskCoachMessages: taskCoach.messages,
    taskCoachWasCancelled: taskCoach.wasCancelled,
    taskCoachHadError: taskCoach.hadError,
    taskCoachStreamSpeed: taskCoach.streamSpeed,
    taskCoachBackoffSecs: taskCoach.backoffSecs,
    requestTaskCoach: (p: WebhookPayload) => taskCoach.request(p),
    cancelTaskCoach: taskCoach.cancel,
    retryTaskCoach: taskCoach.retry,
    clearTaskCoach: () => { taskCoach.clear(); activeSkill.value = null; ignoredSkillId.value = null },

    // Explore channel
    isExploreCoachLoading: exploreCoach.isLoading,
    exploreCoachMessages: exploreCoach.messages,
    exploreCoachWasCancelled: exploreCoach.wasCancelled,
    exploreCoachHadError: exploreCoach.hadError,
    exploreCoachStreamSpeed: exploreCoach.streamSpeed,
    exploreCoachBackoffSecs: exploreCoach.backoffSecs,
    requestExploreCoach: (p: WebhookPayload) => exploreCoach.request(p),
    cancelExploreCoach: exploreCoach.cancel,
    retryExploreCoach: exploreCoach.retry,
    clearExploreCoach: () => exploreCoach.clear(),

    // Per-channel restore from history
    restoreTaskCoachMessages: (records: CoachHistoryRecord[]) =>
      _restoreInto(taskCoach, records, 'task'),
    restoreExploreCoachMessages: (records: CoachHistoryRecord[]) =>
      _restoreInto(exploreCoach, records, 'explore'),

    // Back-compat (read-only, resolves to active mode's channel)
    isCoachLoading: computed(() => activeCoach.value.isLoading.value),
    coachMessages: computed(() => activeCoach.value.messages.value),
    coachResponse: computed(() => {
      const msgs = activeCoach.value.messages.value
      const last = msgs[msgs.length - 1]
      return last?.role === 'assistant' && last.content
        ? { markdown_msg: last.content, message: last.content }
        : activeCoach.value.response.value
    }),
    coachWasCancelled: computed(() => activeCoach.value.wasCancelled.value),
    coachHadError: computed(() => activeCoach.value.hadError.value),
    coachStreamSpeed: computed(() => activeCoach.value.streamSpeed.value),
    coachBackoffSecs: computed(() => activeCoach.value.backoffSecs.value),

    // Analyze
    isAnalyzeLoading: analyze.isLoading,
    analyzeResponse: analyze.response,
    previousAnalyzeResponse,
    analyzeWasCancelled: analyze.wasCancelled,
    analyzeHadError: analyze.hadError,
    analyzeStreamSpeed: analyze.streamSpeed,
    analyzeBackoffSecs: analyze.backoffSecs,
    requestAnalyze: (payload: WebhookPayload) => analyze.request(payload),
    cancelAnalyze: analyze.cancel,
    retryAnalyze: analyze.retry,
    clearAnalyzeResponse: () => {
      analyze.clear()
      previousAnalyzeResponse.value = null
      isDeepReview.value = false
    },

    // Deep Review (reuses analyze flow with multi-perspective prompt)
    isDeepReview,
    requestDeepReview: async (payload: WebhookPayload) => {
      isDeepReview.value = true
      // Override the analyze system prompt with multi-perspective review
      const langKey = isZh.value ? 'zh' as const : 'en' as const
      const traceCtx = getModeTraceContext(appMode.value,
        (payload.data.requirement_level || 'none') as TaskLevel,
        payload.data.parent_req_id || '',
        langKey
      )
      const reviewPrompt = buildDeepReviewPrompt(currentRole.value, langKey)
      const learningCtx = buildLearningContext(langKey)
      const parts = [traceCtx, learningCtx, reviewPrompt].filter(Boolean)
      // Temporarily override getSystemPrompt for this request
      const originalGetSystemPrompt = analyze._config.getSystemPrompt
      analyze._config.getSystemPrompt = () => parts.join('\n\n')
      const err = await analyze.request(payload)
      analyze._config.getSystemPrompt = originalGetSystemPrompt
      return err
    }
  }
}
