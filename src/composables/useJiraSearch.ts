import { ref, computed } from 'vue'
import type { WebhookPayload, JiraSearchResult, JiraSearchResponse } from '@/types/api'
import { WEBHOOK_CONFIG, webhookUrl } from '@/config/webhook'
import { useI18n } from '@/i18n'

export function useJiraSearch() {
  const { t } = useI18n()

  const isSearching = ref(false)
  const searchResults = ref<JiraSearchResult[]>([])
  const searchError = ref('')
  const sprintContext = ref('')
  const releaseContext = ref('')
  const duplicateWarning = ref(false)

  function buildSearchPayload(
    projectKey: string,
    query: string,
    searchType: 'duplicate' | 'parent' | 'sprint'
  ): WebhookPayload {
    return {
      meta: {
        source: 'smart-agent',
        timestamp: Date.now(),
        action: 'search'
      },
      data: {
        project_key: projectKey,
        description: '',
        search_query: query,
        search_type: searchType
      }
    }
  }

  async function searchJira(
    projectKey: string,
    query: string,
    searchType: 'duplicate' | 'parent' | 'sprint'
  ): Promise<void> {
    if (!query.trim() || !projectKey) return

    isSearching.value = true
    searchError.value = ''
    searchResults.value = []
    duplicateWarning.value = false

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_CONFIG.timeout)

      const payload = buildSearchPayload(projectKey, query, searchType)
      const response = await fetch(webhookUrl.value, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const text = await response.text()
      if (!text.trim()) {
        searchResults.value = []
        return
      }

      const data: JiraSearchResponse = JSON.parse(text)
      searchResults.value = data.results || []
      sprintContext.value = data.sprint || ''
      releaseContext.value = data.release || ''

      // Flag potential duplicates (similarity > 0.7)
      if (searchType === 'duplicate') {
        duplicateWarning.value = searchResults.value.some(r => (r.similarity || 0) > 0.7)
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          searchError.value = t('error.timeout')
        } else if (error.message.includes('Failed to fetch')) {
          searchError.value = t('error.connectionFailed')
        } else {
          searchError.value = error.message
        }
      } else {
        searchError.value = t('error.requestFailed')
      }
    } finally {
      isSearching.value = false
    }
  }

  /** Check for duplicates by summary text */
  async function checkDuplicates(projectKey: string, summary: string) {
    return searchJira(projectKey, summary, 'duplicate')
  }

  /** Search for potential parent requirements */
  async function searchParentReqs(projectKey: string, query: string) {
    return searchJira(projectKey, query, 'parent')
  }

  /** Get sprint/release context */
  async function getSprintContext(projectKey: string) {
    return searchJira(projectKey, '', 'sprint')
  }

  function clearSearch() {
    searchResults.value = []
    searchError.value = ''
    duplicateWarning.value = false
    sprintContext.value = ''
    releaseContext.value = ''
  }

  return {
    isSearching,
    searchResults,
    searchError,
    sprintContext,
    releaseContext,
    duplicateWarning,
    checkDuplicates,
    searchParentReqs,
    getSprintContext,
    clearSearch
  }
}
