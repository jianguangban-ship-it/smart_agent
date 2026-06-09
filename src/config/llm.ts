import { ref, computed } from 'vue'

export const GLM_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
export const GLM_DEFAULT_MODEL = 'glm-4.7-flash'

/** Preset model names grouped by provider, shown in the model name datalist */
export const LLM_MODEL_PRESETS: { group: string; models: string[] }[] = [
  {
    group: 'GLM (ZhipuAI)',
    models: ['glm-4.7-flash', 'glm-4-plus', 'glm-4-air', 'glm-z1-flash', 'glm-z1-airx']
  },
  {
    group: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
  },
  {
    group: 'Anthropic',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']
  },
  {
    group: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  {
    group: 'Qwen (Alibaba)',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max']
  },
  {
    group: 'Mistral',
    models: ['mistral-large-latest', 'mistral-small-latest']
  }
]

const LS_KEY_PROVIDER_URL = 'provider-url'

export function getProviderUrl(): string {
  return localStorage.getItem(LS_KEY_PROVIDER_URL) || GLM_BASE_URL
}

export function setProviderUrl(url: string): void {
  if (url.trim()) {
    localStorage.setItem(LS_KEY_PROVIDER_URL, url.trim())
  } else {
    localStorage.removeItem(LS_KEY_PROVIDER_URL)
  }
}

const LS_KEY_API = 'glm-api-key'
const LS_KEY_MODEL = 'glm-model'

export function getApiKey(): string {
  return localStorage.getItem(LS_KEY_API) ?? ''
}

export function setApiKey(key: string): void {
  localStorage.setItem(LS_KEY_API, key)
}

// ─── Models ──────────────────────────────────────────────────────────────────
// Two configured model slots:
//   • Model 1 (LS_KEY_MODEL_1) — used by Task/Analyze (the direct path) and the
//     default for Explore. Migrated from the legacy single `glm-model` key.
//   • Model 2 (LS_KEY_MODEL_2) — optional secondary, selectable in Explore.
// Explore mode persists which of the two it uses in LS_KEY_EXPLORE_MODEL.
const LS_KEY_MODEL_1 = 'model-1'
const LS_KEY_MODEL_2 = 'model-2'
const LS_KEY_EXPLORE_MODEL = 'explore-model'

export function getModel1(): string {
  return localStorage.getItem(LS_KEY_MODEL_1) || localStorage.getItem(LS_KEY_MODEL) || GLM_DEFAULT_MODEL
}
export function getModel2(): string {
  return localStorage.getItem(LS_KEY_MODEL_2) || ''
}

export const model1 = ref(getModel1())
export const model2 = ref(getModel2())

/** Task/Analyze always use Model 1. Alias ref for badges. */
export const taskModel = model1
export function getTaskModel(): string { return model1.value }

/** The models a user can pick from in Explore (drops an empty Model 2). */
export const availableModels = computed(() => [model1.value, model2.value].filter(Boolean))

export function setModel1(value: string): void {
  localStorage.setItem(LS_KEY_MODEL_1, value)
  model1.value = value
  reconcileExplore()
}
export function setModel2(value: string): void {
  if (value) localStorage.setItem(LS_KEY_MODEL_2, value)
  else localStorage.removeItem(LS_KEY_MODEL_2)
  model2.value = value
  reconcileExplore()
}

/** Explore's chosen model — only honoured if it's still a configured model. */
export function getExploreModel(): string {
  const stored = localStorage.getItem(LS_KEY_EXPLORE_MODEL) || ''
  const opts = [model1.value, model2.value].filter(Boolean)
  return opts.includes(stored) ? stored : (opts[0] || GLM_DEFAULT_MODEL)
}
export const exploreModel = ref(getExploreModel())
export function setExploreModel(value: string): void {
  localStorage.setItem(LS_KEY_EXPLORE_MODEL, value)
  exploreModel.value = value
}

/** Keep the Explore selection valid after a settings edit changes the slots. */
function reconcileExplore(): void {
  const opts = [model1.value, model2.value].filter(Boolean)
  if (!opts.includes(exploreModel.value)) {
    const next = opts[0] || GLM_DEFAULT_MODEL
    exploreModel.value = next
    localStorage.setItem(LS_KEY_EXPLORE_MODEL, next)
  }
}

/**
 * Context-window limits, in TOKENS. LLM context windows are measured in tokens
 * (not bytes), so Explore mode sizes its estimated token count against the
 * active model's window before sending. Values are approximate and
 * version-dependent — edit freely as models change.
 */
export const DEFAULT_CONTEXT_LIMIT_TOKENS = 128_000

/**
 * Per-model token windows; `match` is tested case-insensitively as a substring
 * of the model name. ORDER MATTERS — most specific first, since the first
 * `includes` match wins (e.g. `gpt-3.5`/`gpt-4o` before `gpt-4`).
 */
export const MODEL_CONTEXT_LIMITS: { match: string; tokens: number }[] = [
  { match: 'gpt-3.5',       tokens: 16_385 },
  { match: 'gpt-4o',        tokens: 128_000 },
  { match: 'gpt-4',         tokens: 128_000 },
  { match: 'claude',        tokens: 200_000 },
  { match: 'glm-4-long',    tokens: 1_000_000 },
  { match: 'glm',           tokens: 128_000 },
  { match: 'deepseek',      tokens: 64_000 },
  { match: 'qwen-turbo',    tokens: 1_000_000 },
  { match: 'qwen-max',      tokens: 32_768 },
  { match: 'qwen',          tokens: 131_072 },
  { match: 'mistral-small', tokens: 32_000 },
  { match: 'mistral',       tokens: 128_000 },
  { match: 'minimax',       tokens: 245_000 },
]

/** Resolve the context-window limit (tokens) for a model, falling back to the default. */
export function getContextLimitTokens(model: string = getExploreModel()): number {
  const m = model.toLowerCase()
  return MODEL_CONTEXT_LIMITS.find(e => m.includes(e.match))?.tokens ?? DEFAULT_CONTEXT_LIMIT_TOKENS
}

/**
 * Models that accept image (vision) input. Substring match, case-insensitive —
 * edit as your deployment's vision models change. Used to ensure image parts are
 * only sent to a vision-capable model (a text model receives a placeholder).
 */
export const VISION_MODEL_MATCHES = ['qwen', 'vl', 'vision', 'gpt-4o', 'gemini', 'claude']

export function isVisionModel(model: string = getExploreModel()): boolean {
  const m = model.toLowerCase()
  return VISION_MODEL_MATCHES.some(s => m.includes(s))
}

