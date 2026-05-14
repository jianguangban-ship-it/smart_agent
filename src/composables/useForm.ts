import { reactive, ref, computed, watch } from 'vue'
import type { FormState, SummaryState } from '@/types/form'
import { runtimeProjects, runtimeComponentsByProject } from '@/composables/useRuntimeConfig'
import { useI18n } from '@/i18n'
import { currentRole, setRole } from '@/composables/useRole'
import type { UserRole } from '@/composables/useRole'
import { appMode } from '@/composables/useAppMode'
import { activeTaskLayer } from '@/config/skills/index'
import { getModeTraceGaps } from '@/config/domain'
import { getDefaultTaskLevel } from '@/config/domain/traceability.task'
import type { TraceabilityGap } from '@/config/domain'

const DRAFT_KEY = 'jira-workstation-draft'

export function useForm() {
  const { t, isZh } = useI18n()

  const form = reactive<FormState>({
    projectKey: '',
    issueType: '',
    assignee: '',
    estimatedPoints: 0,
    description: '',
    requirementLevel: 'none',
    parentReqId: '',
    verificationMethod: ''
  })

  const summary = reactive<SummaryState>({
    vehicle: '',
    product: '',
    layer: '',
    component: '',
    detail: ''
  })

  // Session-level additions (components the user typed during this session).
  // Scoped per project so different teams don't cross-pollinate each other's history.
  const sessionAddedComponents = reactive<Record<string, string[]>>({})

  const componentHistory = computed<string[]>(() => {
    const key = form.projectKey
    if (!key) return []
    const base = runtimeComponentsByProject.value[key] ?? []
    const session = sessionAddedComponents[key] ?? []
    return [...session, ...base.filter(c => !session.includes(c))]
  })

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

  // Quality score — role-specific weights
  //
  // SYS: completeness + traceability (description heavily weighted)
  // SWE: acceptance criteria + unambiguity (detail + description)
  // HWE: measurability + constraints (component + description)
  // ME:  packaging specs + constraints (component + description)
  // V&V: testability + verification method (description dominant)

  const ROLE_WEIGHTS: Record<UserRole, Record<string, number>> = {
    '': {
      projectKey: 10, issueType: 10, assignee: 5, estimatedPoints: 5,
      vehicle: 5, product: 5, layer: 5, component: 5, detail: 10,
      descriptionPresent: 15, descriptionLength: 25
    },
    'system-architect': {
      projectKey: 6, issueType: 6, assignee: 4, estimatedPoints: 2,
      vehicle: 8, product: 8, layer: 8, component: 8, detail: 8,
      descriptionPresent: 14, descriptionLength: 28
    },
    'sw-developer': {
      projectKey: 8, issueType: 8, assignee: 8, estimatedPoints: 6,
      vehicle: 6, product: 6, layer: 6, component: 8, detail: 12,
      descriptionPresent: 12, descriptionLength: 20
    },
    'hw-designer': {
      projectKey: 6, issueType: 6, assignee: 6, estimatedPoints: 4,
      vehicle: 8, product: 8, layer: 8, component: 10, detail: 10,
      descriptionPresent: 12, descriptionLength: 22
    },
    'me-designer': {
      projectKey: 6, issueType: 6, assignee: 6, estimatedPoints: 4,
      vehicle: 8, product: 8, layer: 8, component: 10, detail: 10,
      descriptionPresent: 12, descriptionLength: 22
    },
    'vv-engineer': {
      projectKey: 6, issueType: 6, assignee: 4, estimatedPoints: 2,
      vehicle: 6, product: 6, layer: 6, component: 6, detail: 8,
      descriptionPresent: 16, descriptionLength: 34
    }
  }

  const qualityScore = computed(() => {
    let score = 0
    const weights = ROLE_WEIGHTS[currentRole.value]

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
    return Math.max(0, Math.min(score, 100))
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

  // Traceability gaps
  const traceabilityGaps = computed<TraceabilityGap[]>(() =>
    getModeTraceGaps(appMode.value, form.requirementLevel, form.parentReqId)
  )

  // ─── Layer → Role auto-routing ──────────────────────────────────────────────
  // The Layer selection directly signals the user's engineering discipline.
  // Auto-set role so the correct skill, context, and weights activate immediately.
  const LAYER_ROLE_MAP: Record<string, UserRole> = {
    SYS:  'system-architect',
    SW:   'sw-developer',
    APP:  'sw-developer',
    SWF:  'sw-developer',
    HW:   'hw-designer',
    ME:   'me-designer',
    TEST: 'vv-engineer',
  }

  watch(() => summary.layer, (layer) => {
    const mapped = LAYER_ROLE_MAP[layer]
    if (mapped && mapped !== currentRole.value) {
      setRole(mapped)
    }
    // Drive layer-specific task skill selection
    activeTaskLayer.value = layer
  })

  // Auto-update requirement level when role is selected (not on initial empty state)
  watch(currentRole, (newRole) => {
    if (newRole) {
      form.requirementLevel = getDefaultTaskLevel(newRole)
    }
  })

  // Get current project name
  function getProjectName(): string {
    return runtimeProjects.value.find(p => p.key === form.projectKey)?.name || ''
  }

  // Reset form
  function resetForm() {
    form.projectKey = ''
    form.issueType = ''
    form.estimatedPoints = 0
    form.description = ''
    form.assignee = ''
    form.requirementLevel = 'none'
    form.parentReqId = ''
    form.verificationMethod = ''
    summary.vehicle = ''
    summary.product = ''
    summary.layer = ''
    summary.component = ''
    summary.detail = ''
    setRole('')
    localStorage.removeItem(DRAFT_KEY)
  }

  // Add component to this session's history for the currently selected project.
  // Persistent changes should go to public/config/components.json or deploy/config/components.json.
  function addComponentToHistory(comp: string) {
    const key = form.projectKey
    if (!key || !comp) return
    if (!sessionAddedComponents[key]) sessionAddedComponents[key] = []
    if (!sessionAddedComponents[key].includes(comp)) {
      sessionAddedComponents[key].unshift(comp)
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
    traceabilityGaps,
    getProjectName,
    resetForm,
    addComponentToHistory,
    restoreDraft
  }
}
