export interface WebhookPayload {
  meta: {
    source: string
    timestamp: number
    action: 'analyze' | 'create' | 'coach' | 'preview' | 'deepReview' | 'search'
  }
  data: {
    project_key?: string
    project_name?: string
    issue_type?: string
    summary?: string
    description: string
    assignee?: { name: string; displayName: string }
    estimated_points?: number
    requirement_level?: string
    parent_req_id?: string
    verification_method?: string
    search_query?: string
    search_type?: 'duplicate' | 'parent' | 'sprint'
    attachments?: Attachment[]   // Explore: files carried separately so the model gets their content while the bubble shows file cards (not inlined text)
  }
}

/**
 * A composer file attachment. Lives on the user `ChatMessage`'s `attachments`
 * array (and the matching `CoachHistoryRecord`). The file `content` is kept here
 * — NOT inlined into `content` — so the chat bubble renders a file card while
 * the upstream request re-inlines the content at apiMessages-build time
 * (see `inlineAttachments` in useAttachment + the apiMessages loop in useLLM).
 */
export interface Attachment {
  name: string
  size: number      // bytes
  content: string   // text body for text files; a base64 data URL for images. Blanked on persist for images (session-only).
  kind?: 'text' | 'image'   // absent === 'text' (back-compat)
  mime?: string             // for images, e.g. 'image/png'
}

export interface AIAgentResponse {
  ai_points?: number
  subtasks_created?: number
  [key: string]: unknown
}

export interface JiraResponse {
  key?: string
  id?: string
  self?: string
  [key: string]: unknown
}

export interface CoachResponse {
  status?: string
  comment?: string
  markdown_msg?: string
  team?: string
  assignee?: string
  jira_id?: string
  raw_content?: string
  message?: string
  output?: string
  content?: string
  text?: string
  [key: string]: unknown
}

export interface WebhookConfig {
  testUrl: string
  prodUrl: string
  timeout: number
}

export type ActionType = 'analyze' | 'create' | 'coach'

/** A part of a multi-modal message (Explore vision). */
export type LLMContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant'
  /** Plain text, or an array of parts for multi-modal (image) messages. */
  content: string | LLMContentPart[]
}

/**
 * A single tool invocation that happened during an assistant turn (v10.134, L3).
 * Lives on the parent assistant `ChatMessage`'s `toolEvents` array — anchored to
 * the turn that produced it, not a top-level message. A `tool_call` event is
 * created when the agent decides to invoke a tool; the matching `tool_result`
 * (matched by `tool` name) flips `status` from 'requested' to 'received' and
 * fills in the content preview.
 */
export interface ToolEvent {
  id: string                              // client-side uuid, stable across status transitions
  tool: string                            // tool name as discovered from the MCP server
  args?: unknown                          // arguments the agent passed (may be any JSON shape)
  contentPreview?: string                 // up to 200 chars of the tool's response, filled on tool_result
  contentLen?: number                     // full length of the tool's response, filled on tool_result
  status: 'requested' | 'received'        // 'received' once the matching tool_result arrived
  timestamp: number
}

/** A single message in the coach chat conversation */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
  hashId?: string         // 8-char hex from coach history record
  toolEvents?: ToolEvent[]  // L3 (Explore mode only): tool invocations during this turn
  attachments?: Attachment[]  // user composer files; rendered as file cards, content re-inlined for the API
  firstTokenMs?: number   // assistant only: time-to-first-token (ms) for the "Thought for Xs" header
}

export type CoachChannel = 'task' | 'explore'

/** A single record in the persistent global coach history */
export interface CoachHistoryRecord {
  id: string              // 8-char random hex
  role: 'user' | 'assistant'
  content: string         // raw unrendered content
  timestamp: number       // Date.now() at creation
  sessionId?: string      // groups records into conversations; undefined for legacy records
  channel?: CoachChannel  // undefined === legacy 'task'
  toolEvents?: ToolEvent[]  // L3 (v10.134): MCP tool invocations during this assistant turn; only set for Explore-channel assistant records that invoked tools. Always absent on user records and on Task-mode records.
  attachments?: Attachment[]  // user composer files; persisted so file cards survive reload/replay. Only set on user records that attached files.
}

export interface LLMRequestBody {
  model: string
  messages: LLMChatMessage[]
  /** Optional traceability context (team_key/project/assignee) for server-side
   *  Activity logs. Brokered Explore path only; omitted when nothing selected. */
  context?: { team_key?: string; project?: string; assignee?: string }
}
export interface LLMResponseBody {
  choices: Array<{ message: { content: string } }>
}

/**
 * L3 (v10.134): the brokered SSE stream from `/api/llm/chat` carries two
 * kinds of `delta` envelopes — the OpenAI-compatible `content` deltas
 * (assistant text tokens, unchanged from v10.131) and a namespaced
 * `smart_agent_event` delta for tool-use lifecycle events. The latter is
 * ignored by any non-Smart-Agent consumer because it's outside the OpenAI
 * spec; only `useLLM.ts:_callBrokeredLLM` knows how to interpret it.
 */
export type SmartAgentEvent =
  | { kind: 'tool_call'; tool: string; args?: unknown }
  | { kind: 'tool_result'; tool: string; contentLen: number; preview: string }

export interface LLMStreamChunk {
  choices: Array<{
    delta: {
      content?: string
      smart_agent_event?: SmartAgentEvent
    }
    finish_reason: string | null
  }>
}

export interface JiraSearchResult {
  key: string
  summary: string
  status: string
  issueType: string
  assignee?: string
  similarity?: number
}

export interface JiraSearchResponse {
  results: JiraSearchResult[]
  total: number
  sprint?: string
  release?: string
}

export type CoachMode = 'llm' | 'webhook'
export type AnalyzeMode = 'llm' | 'webhook'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  type: ToastType
  message: string
  duration: number
}
