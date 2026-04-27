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
  }
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

export interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** A single message in the coach chat conversation */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
  hashId?: string         // 8-char hex from coach history record
}

/** A single record in the persistent global coach history */
export interface CoachHistoryRecord {
  id: string              // 8-char random hex
  role: 'user' | 'assistant'
  content: string         // raw unrendered content
  timestamp: number       // Date.now() at creation
  sessionId?: string      // groups records into conversations; undefined for legacy records
}

export interface LLMRequestBody {
  model: string
  messages: LLMChatMessage[]
}
export interface LLMResponseBody {
  choices: Array<{ message: { content: string } }>
}

export interface LLMStreamChunk {
  choices: Array<{ delta: { content?: string }; finish_reason: string | null }>
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
