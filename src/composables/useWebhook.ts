import { ref } from 'vue'
import type { WebhookPayload, ActionType } from '@/types/api'
import { WEBHOOK_CONFIG, webhookUrl } from '@/config/webhook'
import { useI18n } from '@/i18n'

const MAX_DETAIL_LEN = 400

function extractErrorDetail(body: string): string {
  if (!body) return ''
  try {
    const parsed = JSON.parse(body)
    const msg =
      parsed?.message ??
      parsed?.error?.message ??
      parsed?.error ??
      parsed?.hint ??
      ''
    const text = typeof msg === 'string' ? msg : JSON.stringify(msg)
    if (text) return text.slice(0, MAX_DETAIL_LEN)
  } catch {
    // not JSON; fall through
  }
  return body.trim().slice(0, MAX_DETAIL_LEN)
}

export function useWebhook() {
  const { t } = useI18n()

  const isSubmitting = ref(false)
  const currentAction = ref<ActionType | ''>('')
  const jiraResponse = ref<unknown>(null)

  async function sendRequest(payload: WebhookPayload): Promise<unknown> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_CONFIG.timeout)

    try {
      const response = await fetch(webhookUrl.value, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const responseText = await response.text()

      if (!response.ok) {
        const detail = extractErrorDetail(responseText)
        const base = `HTTP ${response.status}: ${response.statusText}`
        throw new Error(detail ? `${base} — ${detail}` : base)
      }

      if (!responseText || responseText.trim() === '') {
        throw new Error(t('error.emptyResponse'))
      }

      try {
        return JSON.parse(responseText)
      } catch {
        return { message: responseText }
      }
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(t('error.timeout'))
        }
        if (error.message.includes('Failed to fetch')) {
          throw new Error(t('error.connectionFailed'))
        }
      }
      throw error
    }
  }

  async function createJiraTicket(payload: WebhookPayload): Promise<string | null> {
    isSubmitting.value = true
    currentAction.value = 'create'
    jiraResponse.value = null

    try {
      const result = await sendRequest(payload) as Record<string, unknown>
      jiraResponse.value = result.jira_result || result
      return null
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('error.requestFailed')
      return msg
    } finally {
      isSubmitting.value = false
    }
  }

  function clearResponses() {
    jiraResponse.value = null
    currentAction.value = ''
  }

  return {
    isSubmitting,
    currentAction,
    jiraResponse,
    createJiraTicket,
    clearResponses
  }
}
