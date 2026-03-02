import { reactive, ref, computed, watch } from 'vue'
import type { FormState, SummaryState } from '@/types/form'
import type { ProjectKey } from '@/types/team'
import { PROJECT_CONFIG } from '@/config/projects'
import { DEFAULT_COMPONENT_HISTORY } from '@/config/constants'
import { useI18n } from '@/i18n'

const DRAFT_KEY = 'jira-workstation-draft'

export function useForm() {
  const { t, isZh } = useI18n()

  const form = reactive<FormState>({
    projectKey: 'HW',
    issueType: 'Story',
    assignee: '',
    estimatedPoints: 3,
    description: ''
  })

  const summary = reactive<SummaryState>({
    vehicle: '',
    product: '',
    layer: '',
    component: '',
    detail: ''
  })

  const componentHistory = ref<string[]>([...DEFAULT_COMPONENT_HISTORY])

  // Computed summary string
  const computedSummary = computed(() => {
    const parts = [
      summary.vehicle,
      summary.product,
      summary.layer,
      summary.component,
      summary.detail
    ]
    const filled = parts.filter(p => p)
    if (filled.length === 0) return ''
    return parts.map(p => `[${p || '...'}]`).join('')
  })

  // Can submit check
  const canSubmit = computed(() => {
    return !!(
      form.projectKey &&
      form.issueType &&
      form.assignee &&
      form.estimatedPoints &&
      form.description.trim() &&
      summary.vehicle &&
      summary.product &&
      summary.layer &&
      summary.component &&
      summary.detail
    )
  })

  // Quality score
  const qualityScore = computed(() => {
    let score = 0
    const weights: Record<string, number> = {
      projectKey: 8, issueType: 8, assignee: 8, estimatedPoints: 6,
      vehicle: 8, product: 8, layer: 8, component: 8, detail: 10,
      descriptionPresent: 10, descriptionLength: 18
    }
    if (form.projectKey) score += weights.projectKey
    if (form.issueType) score += weights.issueType
    if (form.assignee) score += weights.assignee
    if (form.estimatedPoints) score += weights.estimatedPoints
    if (summary.vehicle) score += weights.vehicle
    if (summary.product) score += weights.product
    if (summary.layer) score += weights.layer
    if (summary.component) score += weights.component
    if (summary.detail) score += weights.detail

    const desc = form.description.trim()
    if (desc) {
      score += weights.descriptionPresent
      score += Math.min(
        Math.floor(desc.length / 200 * weights.descriptionLength),
        weights.descriptionLength
      )
    }
    return Math.min(score, 100)
  })

  const qualityScoreColor = computed(() => {
    const s = qualityScore.value
    if (s >= 80) return 'var(--accent-green)'
    if (s >= 50) return 'var(--accent-orange)'
    if (s > 0) return 'var(--accent-red)'
    return 'var(--text-muted)'
  })

  const qualityScoreLabel = computed(() => {
    const s = qualityScore.value
    if (s >= 80) return t('quality.excellent')
    if (s >= 50) return t('quality.good')
    if (s > 0) return t('quality.incomplete')
    return t('quality.empty')
  })

  // Get current project name
  function getProjectName(): string {
    return PROJECT_CONFIG.find(p => p.key === form.projectKey)?.name || ''
  }

  // Reset form
  function resetForm() {
    form.issueType = 'Story'
    form.estimatedPoints = 3
    form.description = ''
    form.assignee = ''
    summary.vehicle = ''
    summary.product = ''
    summary.layer = ''
    summary.component = ''
    summary.detail = ''
    localStorage.removeItem(DRAFT_KEY)
  }

  // Add component to history
  function addComponentToHistory(comp: string) {
    if (comp && !componentHistory.value.includes(comp)) {
      componentHistory.value.unshift(comp)
    }
  }

  // Auto-save draft
  function saveDraft() {
    const draft = { form: { ...form }, summary: { ...summary } }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }

  // Restore draft — returns true if a draft was found
  function restoreDraft(): boolean {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (!saved) return false
    try {
      const draft = JSON.parse(saved)
      if (draft.form) {
        Object.assign(form, draft.form)
      }
      if (draft.summary) {
        Object.assign(summary, draft.summary)
      }
      return true
    } catch {
      return false
    }
  }

  // Watch for changes and auto-save (debounced to avoid localStorage thrashing)
  let _draftTimer: ReturnType<typeof setTimeout> | null = null
  watch([form, summary], () => {
    if (_draftTimer) clearTimeout(_draftTimer)
    _draftTimer = setTimeout(saveDraft, 300)
  }, { deep: true })

  return {
    form,
    summary,
    componentHistory,
    computedSummary,
    canSubmit,
    qualityScore,
    qualityScoreColor,
    qualityScoreLabel,
    getProjectName,
    resetForm,
    addComponentToHistory,
    restoreDraft
  }
}
