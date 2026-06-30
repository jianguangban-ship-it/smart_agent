import { ref, computed } from 'vue'
import type { LLMRequestBody, LLMStreamChunk, LLMChatMessage, LLMContentPart, WebhookPayload, ChatMessage, ToolEvent, SmartAgentEvent } from '@/types/api'
import { getProviderUrl, getApiKey, getTaskModel, getExploreModel, isVisionModel } from '@/config/llm'
import { ICONS } from '@/config/icons'
import { getCoachSkillTaskRaw, getAnalyzeSkill, getResponseFormat } from '@/config/skills/index'
import { SKILL_REGISTRY } from '@/config/skills/registry'
import type { SkillEntry } from '@/config/skills/registry'
import { matchSkill } from '@/utils/skillMatcher'
import { currentRole } from '@/composables/useRole'
import { appMode } from '@/composables/useAppMode'
import { getModeTraceContext, buildDeepReviewPrompt } from '@/config/domain'
import { useReviewHistory } from '@/composables/useReviewHistory'
import type { TaskLevel } from '@/config/domain/traceability.task'
import { useI18n } from '@/i18n'
import { addRecord, setSessionId } from '@/composables/useCoachHistory'
import { inlineAttachments, buildMultimodalContent, stripImageContent } from '@/composables/useAttachment'
import { selectionContextFields } from '@/composables/useSelectionContext'
import type { CoachHistoryRecord, CoachChannel, Attachment } from '@/types/api'

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
  /** Composer files for this turn (Explore). Kept off the displayed message; re-inlined into apiMessages. */
  getAttachments?: (payload: WebhookPayload) => Attachment[]
  /** When true (Explore), image attachments are sent as multi-modal content parts. */
  multimodal?: boolean
  onBeforeRequest?: (currentResponse: unknown) => void
  /** When true, uses chat message array model instead of single response */
  chatMode?: boolean
  channel?: CoachChannel  // 'task' | 'explore'
}

/**
 * L3 (v10.134): merge an incoming SmartAgentEvent into an assistant message's
 * toolEvents array. tool_call appends a new 'requested' event; tool_result
 * matches the most-recent 'requested' event by tool name and flips its
 * status to 'received' + fills in the content preview. Orphan tool_results
 * (no matching prior call — shouldn't happen but be defensive) get pushed
 * as standalone 'received' entries.
 */
function applyToolEvent(events: ToolEvent[], event: SmartAgentEvent, now: number): void {
  if (event.kind === 'tool_call') {
    events.push({
      id: nextMsgId(),
      tool: event.tool,
      args: event.args,
      status: 'requested',
      timestamp: now
    })
    return
  }
  // event.kind === 'tool_result'
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].tool === event.tool && events[i].status === 'requested') {
      events[i].status = 'received'
      events[i].contentLen = event.contentLen
      events[i].contentPreview = event.preview
      return
    }
  }
  events.push({
    id: nextMsgId(),
    tool: event.tool,
    contentLen: event.contentLen,
    contentPreview: event.preview,
    status: 'received',
    timestamp: now
  })
}

function createStreamFlow(
  opts: StreamFlowOptions,
  callStream: (
    messages: LLMChatMessage[],
    onChunk: (text: string) => void,
    signal: AbortSignal,
    onToolEvent?: (event: SmartAgentEvent) => void
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
    // Composer files for this turn. Kept OFF the displayed/persisted `content`
    // (so the bubble renders file cards, not inlined text) and re-inlined into
    // the API payload below. Empty for non-Explore flows.
    const attachments = opts.getAttachments?.(payload) ?? []

    if (opts.chatMode) {
      // Chat mode: push user message, then stream assistant reply
      if (!_isAutoRetry) {
        messages.value.push({
          id: nextMsgId(),
          role: 'user',
          content: userMessage,
          timestamp: Date.now(),
          ...(attachments.length > 0 ? { attachments } : {})
        })
        // Save user message to global coach history
        if (opts.chatMode) {
          // Persist with image base64 stripped (session-only) to avoid bloating
          // localStorage; the in-memory message keeps the full data URL for the
          // live thumbnail + this turn's send.
          const record = addRecord('user', userMessage, opts.channel ?? 'task', undefined, stripImageContent(attachments))
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
        // Build a CLEAN history for the upstream request:
        //  • skip empty turns (e.g. failed/cancelled assistant placeholders) —
        //    proxies reject a request containing empty assistant messages, which
        //    silently dropped every Explore turn once one failed.
        //  • image (image_url) parts are sent ONLY for the current turn AND only
        //    to a vision model; history messages and text models get a
        //    `[Image: name]` placeholder (never base64), so stale images aren't
        //    re-shipped and text models never receive image content.
        const lastIdx = messages.value.length - 1            // empty assistant placeholder
        const curUserIdx = lastIdx - 1                        // the turn being sent
        const visionOk = !!opts.multimodal && isVisionModel(getExploreModel())
        for (let i = 0; i < messages.value.length; i++) {
          const msg = messages.value[i]
          if (i === lastIdx) break // skip the current empty assistant placeholder
          if (!msg.content?.trim() && !msg.attachments?.length) continue // drop empty/failed turns
          let content: string | LLMContentPart[] = msg.content
          if (msg.attachments?.length) {
            content = (visionOk && i === curUserIdx)
              ? buildMultimodalContent(msg.content, msg.attachments)
              : inlineAttachments(msg.content, msg.attachments)
          }
          apiMessages.push({ role: msg.role, content })
        }
      } else {
        apiMessages.push({ role: 'user', content: userMessage })
      }

      await callStream(apiMessages, (chunk) => {
        const firstToken = tokenCount === 0
        if (firstToken) streamStart = Date.now()
        tokenCount++
        accumulated += chunk

        if (opts.chatMode) {
          // Update the last assistant message in the array
          const lastMsg = messages.value[messages.value.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = accumulated
            // Time-to-first-token for the "Thought for Xs" header. The assistant
            // placeholder's timestamp is the request-start moment, so the wait
            // before the first chunk landed is streamStart − timestamp.
            if (firstToken) lastMsg.firstTokenMs = streamStart - lastMsg.timestamp
          }
          // Also update response ref for backward compat
          response.value = { markdown_msg: accumulated, message: accumulated }
        } else {
          response.value = { markdown_msg: accumulated, message: accumulated }
        }

        const elapsed = (Date.now() - streamStart) / 1000
        if (elapsed > 0) streamSpeed.value = Math.round(tokenCount / elapsed)
      }, _ac.signal, (event) => {
        // L3 (v10.134): tool-event arrived from the brokered stream. Only
        // chat-mode flows have a parent assistant message to anchor it to;
        // analyze and direct-path flows pass this callback through but
        // their callStream impls never invoke it (no MCP on those paths).
        if (!opts.chatMode) return
        const lastMsg = messages.value[messages.value.length - 1]
        if (!lastMsg || lastMsg.role !== 'assistant') return
        if (!lastMsg.toolEvents) lastMsg.toolEvents = []
        applyToolEvent(lastMsg.toolEvents, event, Date.now())
      })

      // Mark streaming complete
      if (opts.chatMode) {
        const lastMsg = messages.value[messages.value.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.isStreaming = false
          // Save completed coach response to global history. L3 (v10.134):
          // Explore-mode messages that invoked MCP tools pass their toolEvents
          // through so the chips survive page reload; Task-mode messages have
          // no toolEvents so addRecord skips the field for those.
          if (lastMsg.content) {
            const record = addRecord('assistant', lastMsg.content, opts.channel ?? 'task', lastMsg.toolEvents)
            lastMsg.hashId = record.id
          }
        }
      }

      return null
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        wasCancelled.value = true
        streamSpeed.value = 0
        // Drop the empty assistant placeholder on cancel — leaving an
        // `assistant:""` in history poisons every later request (proxies reject
        // empty assistant messages). Keep it only if partial text streamed.
        if (opts.chatMode) {
          const lastMsg = messages.value[messages.value.length - 1]
          if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content) messages.value.pop()
          else if (lastMsg && lastMsg.role === 'assistant') lastMsg.isStreaming = false
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
      // Drop the empty assistant placeholder on error so a failed turn doesn't
      // persist in history and get re-sent (empty assistant messages make the
      // proxy reject — and drop — every subsequent request).
      if (opts.chatMode) {
        const lastMsg = messages.value[messages.value.length - 1]
        if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content) messages.value.pop()
        else if (lastMsg && lastMsg.role === 'assistant') lastMsg.isStreaming = false
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

  // Regenerate the reply for the CURRENT tail of `messages` without re-pushing a
  // user turn. The caller is responsible for trimming `messages` so the last
  // entry is the user message to answer; `_isAutoRetry=true` then rebuilds the
  // API history from `messages` and streams a fresh assistant message. A fresh
  // `payload` may be supplied so regenerate works even after a page reload (when
  // `_lastPayload` is null) — its body is unused in auto-retry mode beyond
  // system-prompt/multimodal config.
  async function regenerate(payload?: WebhookPayload): Promise<string | null> {
    const p = payload ?? _lastPayload
    if (!p) return null
    return request(p, true)
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
           request, cancel, retry, regenerate, clear, _config: opts }
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
        // L3 (v10.134): restore persisted tool events so the chips reappear
        // on page reload / history navigation. Empty/absent for non-Explore
        // and pre-v10.134 records, which is fine — the chip block in
        // ChatBubble.vue is v-if'd on toolEvents.length > 0.
        ...(r.toolEvents && r.toolEvents.length > 0 ? { toolEvents: r.toolEvents } : {}),
        // Restore attachments so the user-message file cards reappear on reload
        // / history navigation. Absent for non-attachment and pre-v10.152 records.
        ...(r.attachments && r.attachments.length > 0 ? { attachments: r.attachments } : {})
      })
    }
    if (records.length && records[0].sessionId) {
      setSessionId(channel, records[0].sessionId)
    }
  }

  /**
   * Direct browser-to-provider call (v10.132 — restored from v10.130).
   * Used by Task-mode coach and Analyze per the project rule that MCP /
   * gateway work must not touch Task mode. Reads the user-configured
   * Provider URL + API Key from localStorage (Settings panel).
   */
  async function _callGLMStream(
    apiMessages: LLMChatMessage[],
    onChunk: (text: string) => void,
    signal: AbortSignal,
    _onToolEvent?: (event: SmartAgentEvent) => void  // ignored — direct path doesn't carry MCP
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
      model: getTaskModel(),
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

  /**
   * Brokered Fastify → GWM `llmproxy.gwm.cn` path (v10.131, Phase L1).
   * Used by Explore mode only — this is where MCP plugs in later. The SPA
   * no longer holds an API key or knows the provider URL on this path;
   * `server/routes/llm.ts` owns those. Bytes on the wire are
   * OpenAI-compatible SSE, so the consumer loop below is unchanged from
   * the direct version.
   */
  async function _callBrokeredLLM(
    apiMessages: LLMChatMessage[],
    onChunk: (text: string) => void,
    signal: AbortSignal,
    onToolEvent?: (event: SmartAgentEvent) => void
  ): Promise<void> {
    const body: LLMRequestBody = {
      model: getExploreModel(),
      messages: apiMessages
    }
    // Attach the current selection (team/project/assignee) for server-side
    // Activity-log traceability. Omitted entirely when nothing is selected.
    const ctx = selectionContextFields()
    if (Object.keys(ctx).length > 0) body.context = ctx

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const internalToken = import.meta.env.VITE_INTERNAL_API_TOKEN
    if (typeof internalToken === 'string' && internalToken.length > 0) {
      headers['X-Internal-Token'] = internalToken
    }

    const response = await fetch('/api/llm/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    })

    if (!response.ok) {
      if (response.status === 401) throw new Error(t('error.glm401'))
      if (response.status === 429) throw new GLM429Error(t('error.glm429'))
      if (response.status >= 500) throw new Error(t('error.glm5xx'))
      const errText = await response.text().catch(() => '')
      throw new Error(`LLM proxy ${response.status}: ${errText || response.statusText}`)
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
          // Guard ONLY the JSON.parse so a thrown upstream error below isn't
          // swallowed as a "malformed line".
          let chunk: LLMStreamChunk & { error?: { message?: string } }
          try {
            chunk = JSON.parse(data)
          } catch {
            continue // ignore malformed SSE lines
          }
          // The server emits upstream failures as `data: {"error":{...}}` once
          // SSE headers are already sent. Surface them instead of ending silent.
          if (chunk.error) throw new Error(chunk.error.message || t('error.glm5xx'))
          const delta = chunk.choices?.[0]?.delta
          if (!delta) continue
          // L3 (v10.134): brokered stream carries tool-use lifecycle events
          // alongside the OpenAI-compatible content deltas. They're in a
          // namespaced field so unknown to vanilla OpenAI consumers.
          if (delta.smart_agent_event && onToolEvent) {
            onToolEvent(delta.smart_agent_event)
          }
          if (delta.content) onChunk(delta.content)
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
      // The layer-routed coach skill is ALWAYS the base prompt and is never
      // replaced or weakened. A matched registry skill (if any) is appended
      // as an *additional* specialty layer — additive, not a substitute — so
      // the discipline baseline from the Layer selection is always preserved.
      const baseSkill = getCoachSkillTaskRaw(langKey)
      const matched = matchSkill(rawInput, SKILL_REGISTRY, langKey)
      let specialtySkill = ''
      if (matched && matched.id !== ignoredSkillId.value) {
        if (ignoredSkillId.value && matched.id !== ignoredSkillId.value) ignoredSkillId.value = null
        activeSkill.value = matched
        specialtySkill = matched.getRawPrompt ? matched.getRawPrompt(langKey) : matched.systemPrompt
      } else {
        activeSkill.value = null
      }
      const traceCtx = getModeTraceContext('task',
        (payload.data.requirement_level || 'none') as TaskLevel,
        payload.data.parent_req_id || '', langKey)
      return [traceCtx, baseSkill, specialtySkill, getResponseFormat()]
        .filter(Boolean).join('\n\n')
    },
    getUserMessage: (payload, zh) => buildUserMessage(payload, zh),
  }, _callGLMStream, t, isZh)

  // Explore channel — free chat on any topic (Response Format only).
  // This is the ONE client surface that uses the brokered Fastify path; MCP
  // and any future gateway-backed tool calls land here. Task and Analyze stay
  // on the direct path (project rule: MCP must not touch Task mode).
  const exploreCoach = createStreamFlow({
    chatMode: true,
    channel: 'explore',
    getSystemPrompt: () => getResponseFormat(),
    getUserMessage: (payload) => payload.data.description || '',
    getAttachments: (payload) => payload.data.attachments ?? [],
    multimodal: true,
  }, _callBrokeredLLM, t, isZh)

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
    regenerateTaskCoach: taskCoach.regenerate,
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
    regenerateExploreCoach: exploreCoach.regenerate,
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
