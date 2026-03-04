import { ref } from 'vue'
import type { LLMRequestBody, LLMStreamChunk, WebhookPayload } from '@/types/api'
import { getProviderUrl, getApiKey, getModel } from '@/config/llm'
import { getCoachSkill, getAnalyzeSkill } from '@/config/skills/index'
import { useI18n } from '@/i18n'

const LS_KEY_COACH_SKILL_ENABLED = 'coach-skill-enabled'
const LS_KEY_TASK_COACH_ENABLED = 'task-coach-enabled'

/** Whether the coach system-prompt skill is active. Toggle from the UI for free-form chat. Persisted to localStorage. */
export const coachSkillEnabled = ref(localStorage.getItem(LS_KEY_COACH_SKILL_ENABLED) !== 'false')

export function setCoachSkillEnabled(val: boolean): void {
  coachSkillEnabled.value = val
  localStorage.setItem(LS_KEY_COACH_SKILL_ENABLED, String(val))
}

/** Whether full task fields (project, type, summary, assignee, points) are included in the coach user message. Only effective when coachSkillEnabled is true. Persisted to localStorage. */
export const taskCoachEnabled = ref(localStorage.getItem(LS_KEY_TASK_COACH_ENABLED) !== 'false')

export function setTaskCoachEnabled(val: boolean): void {
  taskCoachEnabled.value = val
  localStorage.setItem(LS_KEY_TASK_COACH_ENABLED, String(val))
}

/** Tagged error class for HTTP 429 so callers can start backoff instead of showing an error */
class GLM429Error extends Error {
  constructor(msg: string) { super(msg); this.name = 'GLM429Error' }
}

// ─── Stream flow factory ──────────────────────────────────────────────────────
// Eliminates duplication between Coach and Analyze flows.
// Fixes: timer leak on concurrent 429, infinite retry loop (max 3).

const MAX_429_RETRIES = 3

interface StreamFlowOptions {
  getSystemPrompt: (lang: 'en' | 'zh', payload: WebhookPayload) => string
  getUserMessage: (payload: WebhookPayload, isZh: boolean) => string
  onBeforeRequest?: (currentResponse: unknown) => void
  /** When true, new responses are appended after previous ones with a --- separator */
  preserveHistory?: boolean
}

function createStreamFlow(
  opts: StreamFlowOptions,
  callStream: (
    systemPrompt: string,
    userMessage: string,
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

  let _ac: AbortController | null = null
  let _lastPayload: WebhookPayload | null = null
  let _backoffTimer: number | null = null
  let _retryCount = 0
  let _historyPrefix = ''

  async function request(payload: WebhookPayload, _isAutoRetry = false): Promise<string | null> {
    // Clear any existing backoff timer to prevent timer leak
    if (_backoffTimer !== null) {
      clearInterval(_backoffTimer)
      _backoffTimer = null
    }

    // Reset retry count on fresh user-initiated calls
    if (!_isAutoRetry) _retryCount = 0

    // Capture current response as history prefix before clearing
    if (!_isAutoRetry && opts.preserveHistory && response.value) {
      const r = response.value as Record<string, unknown>
      const text = typeof r?.message === 'string' ? r.message : ''
      if (text) _historyPrefix = text
    }

    _lastPayload = payload
    wasCancelled.value = false
    hadError.value = false
    streamSpeed.value = 0
    backoffSecs.value = 0
    isLoading.value = true

    opts.onBeforeRequest?.(response.value)
    response.value = null
    _ac = new AbortController()

    try {
      const lang: 'en' | 'zh' = isZh.value ? 'zh' : 'en'
      let accumulated = ''
      let tokenCount = 0
      let streamStart = 0

      const systemPrompt = opts.getSystemPrompt(lang, payload)
      const userMessage = opts.getUserMessage(payload, isZh.value)

      const historyPrefix = _historyPrefix ? _historyPrefix + '\n\n===COACH_TURN===\n\n' : ''

      await callStream(systemPrompt, userMessage, (chunk) => {
        if (tokenCount === 0) streamStart = Date.now()
        tokenCount++
        accumulated += chunk
        const full = historyPrefix + accumulated
        response.value = { markdown_msg: full, message: full }
        const elapsed = (Date.now() - streamStart) / 1000
        if (elapsed > 0) streamSpeed.value = Math.round(tokenCount / elapsed)
      }, _ac.signal)
      return null
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        wasCancelled.value = true
        streamSpeed.value = 0
        return 'cancelled'
      }
      if (error instanceof GLM429Error) {
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
    _historyPrefix = ''
    response.value = null
    wasCancelled.value = false
    hadError.value = false
    streamSpeed.value = 0
    backoffSecs.value = 0
  }

  return { isLoading, response, wasCancelled, hadError, streamSpeed, backoffSecs,
           request, cancel, retry, clear }
}

// ─── Main composable ──────────────────────────────────────────────────────────

export function useLLM() {
  const { isZh, t } = useI18n()

  // ─── Shared helpers ────────────────────────────────────────────────────────

  function buildUserMessage(payload: WebhookPayload, zh: boolean): string {
    const d = payload.data
    if (zh) {
      return `请帮我审阅以下 JIRA 任务描述并给出改进建议：

**项目**: ${d.project_name}
**任务类型**: ${d.issue_type}
**摘要**: ${d.summary}
**描述**:
${d.description || '（未填写）'}
**经办人**: ${d.assignee || '（未分配）'}
**故事点**: ${d.estimated_points}`
    }
    return `Please review the following JIRA task description and provide improvement suggestions:

**Project**: ${d.project_name}
**Issue Type**: ${d.issue_type}
**Summary**: ${d.summary}
**Description**:
${d.description || '(empty)'}
**Assignee**: ${d.assignee || '(unassigned)'}
**Story Points**: ${d.estimated_points}`
  }

  async function _callGLMStream(
    systemPrompt: string,
    userMessage: string,
    onChunk: (text: string) => void,
    signal: AbortSignal
  ): Promise<void> {
    const apiKey = getApiKey()
    if (!apiKey) {
      throw new Error(
        isZh.value
          ? 'GLM API Key 未配置，请点击右上角 ⚙ 进行设置。'
          : 'GLM API Key not set. Please click ⚙ in the header to configure it.'
      )
    }

    const body: LLMRequestBody & { stream: true } = {
      model: getModel(),
      stream: true,
      messages: [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user', content: userMessage }
      ]
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

  // ─── Coach flow ─────────────────────────────────────────────────────────────

  const coach = createStreamFlow({
    preserveHistory: true,
    getSystemPrompt: (lang, payload) => {
      const skillOn = coachSkillEnabled.value
      return skillOn ? getCoachSkill(lang) : ''
    },
    getUserMessage: (payload, zh) => {
      const skillOn = coachSkillEnabled.value
      const taskOn = taskCoachEnabled.value
      return (skillOn && taskOn)
        ? buildUserMessage(payload, zh)
        : (payload.data.description || payload.data.summary || '')
    }
  }, _callGLMStream, t, isZh)

  // ─── Analyze flow ───────────────────────────────────────────────────────────

  const previousAnalyzeResponse = ref<unknown>(null)

  const analyze = createStreamFlow({
    getSystemPrompt: (lang) => getAnalyzeSkill(lang),
    getUserMessage: (payload, zh) => buildUserMessage(payload, zh),
    onBeforeRequest: (currentResponse) => {
      previousAnalyzeResponse.value = currentResponse
    }
  }, _callGLMStream, t, isZh)

  // ─── Public API (preserve existing interface) ───────────────────────────────

  return {
    // Coach
    isCoachLoading: coach.isLoading,
    coachResponse: coach.response,
    coachWasCancelled: coach.wasCancelled,
    coachHadError: coach.hadError,
    coachStreamSpeed: coach.streamSpeed,
    coachBackoffSecs: coach.backoffSecs,
    requestCoach: (payload: WebhookPayload) => coach.request(payload),
    cancelCoach: coach.cancel,
    retryCoach: coach.retry,
    clearCoachResponse: coach.clear,

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
    }
  }
}
