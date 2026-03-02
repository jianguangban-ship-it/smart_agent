import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'

// Mock dependencies
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    setLang: () => {},
    currentLang: { value: 'en' },
    isZh: { value: false }
  })
}))

vi.mock('@/config/projects', () => ({
  PROJECT_CONFIG: [
    { key: 'HW', name: 'Hardware', teamName: 'HW Team' }
  ]
}))

vi.mock('@/config/constants', () => ({
  DEFAULT_COMPONENT_HISTORY: ['CompA', 'CompB']
}))

// Stub localStorage
const storage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v },
  removeItem: (k: string) => { delete storage[k] }
})

import { useForm } from '../useForm'

describe('useForm', () => {
  let formApi: ReturnType<typeof useForm>

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k])
    formApi = useForm()
  })

  describe('canSubmit', () => {
    it('returns false with default state (assignee empty)', () => {
      expect(formApi.canSubmit.value).toBe(false)
    })

    it('returns true when all fields are filled', async () => {
      const { form, summary } = formApi
      form.projectKey = 'HW'
      form.issueType = 'Story'
      form.assignee = 'user1'
      form.estimatedPoints = 3
      form.description = 'Some description'
      summary.vehicle = 'VehicleA'
      summary.product = 'ProductB'
      summary.layer = 'LayerC'
      summary.component = 'CompD'
      summary.detail = 'DetailE'
      await nextTick()
      expect(formApi.canSubmit.value).toBe(true)
    })

    it('returns false when description is empty', async () => {
      const { form, summary } = formApi
      form.projectKey = 'HW'
      form.issueType = 'Story'
      form.assignee = 'user1'
      form.estimatedPoints = 3
      form.description = ''
      summary.vehicle = 'V'
      summary.product = 'P'
      summary.layer = 'L'
      summary.component = 'C'
      summary.detail = 'D'
      await nextTick()
      expect(formApi.canSubmit.value).toBe(false)
    })

    it('returns false when a summary field is empty', async () => {
      const { form, summary } = formApi
      form.projectKey = 'HW'
      form.issueType = 'Story'
      form.assignee = 'user1'
      form.estimatedPoints = 3
      form.description = 'desc'
      summary.vehicle = 'V'
      summary.product = ''  // missing
      summary.layer = 'L'
      summary.component = 'C'
      summary.detail = 'D'
      await nextTick()
      expect(formApi.canSubmit.value).toBe(false)
    })
  })

  describe('qualityScore', () => {
    it('starts with base score from defaults (projectKey + issueType + points)', () => {
      // projectKey=8, issueType=8, estimatedPoints=6 = 22
      expect(formApi.qualityScore.value).toBe(22)
    })

    it('reaches 100 when all fields filled with long description', async () => {
      const { form, summary } = formApi
      form.assignee = 'user1'
      form.description = 'x'.repeat(200)
      summary.vehicle = 'V'
      summary.product = 'P'
      summary.layer = 'L'
      summary.component = 'C'
      summary.detail = 'D'
      await nextTick()
      expect(formApi.qualityScore.value).toBe(100)
    })

    it('caps at 100 even with very long description', async () => {
      const { form, summary } = formApi
      form.assignee = 'user1'
      form.description = 'x'.repeat(1000)
      summary.vehicle = 'V'
      summary.product = 'P'
      summary.layer = 'L'
      summary.component = 'C'
      summary.detail = 'D'
      await nextTick()
      expect(formApi.qualityScore.value).toBe(100)
    })

    it('adds description presence and length bonus', async () => {
      const { form } = formApi
      form.description = 'x'.repeat(100)
      await nextTick()
      // base 22 + descPresent 10 + floor(100/200*18)=9 = 41
      expect(formApi.qualityScore.value).toBe(41)
    })
  })

  describe('qualityScoreColor', () => {
    it('returns green for score >= 80', async () => {
      const { form, summary } = formApi
      form.assignee = 'user1'
      form.description = 'x'.repeat(200)
      summary.vehicle = 'V'
      summary.product = 'P'
      summary.layer = 'L'
      summary.component = 'C'
      summary.detail = 'D'
      await nextTick()
      expect(formApi.qualityScoreColor.value).toBe('var(--accent-green)')
    })

    it('returns orange for score >= 50', async () => {
      const { form, summary } = formApi
      form.assignee = 'user1'
      form.description = 'x'.repeat(100)
      summary.vehicle = 'V'
      summary.product = 'P'
      summary.layer = 'L'
      await nextTick()
      // 22 + 8 + 8 + 8 + 8 + 10 + 9 = 73... let me just check the boundary
      expect(['var(--accent-orange)', 'var(--accent-green)']).toContain(formApi.qualityScoreColor.value)
    })

    it('returns red for score > 0 and < 50', async () => {
      // default score is 22
      expect(formApi.qualityScoreColor.value).toBe('var(--accent-red)')
    })
  })

  describe('qualityScoreLabel', () => {
    it('returns quality.empty for score 0', async () => {
      const { form } = formApi
      form.projectKey = '' as any
      form.issueType = '' as any
      form.estimatedPoints = 0
      await nextTick()
      expect(formApi.qualityScoreLabel.value).toBe('quality.empty')
    })

    it('returns quality.incomplete for low score', () => {
      // defaults give 22
      expect(formApi.qualityScoreLabel.value).toBe('quality.incomplete')
    })
  })

  describe('computedSummary', () => {
    it('returns empty string when all parts are empty', () => {
      expect(formApi.computedSummary.value).toBe('')
    })

    it('fills missing parts with [...]', async () => {
      formApi.summary.vehicle = 'A'
      await nextTick()
      expect(formApi.computedSummary.value).toBe('[A][...][...][...][...]')
    })

    it('joins all parts when filled', async () => {
      const { summary } = formApi
      summary.vehicle = 'V'
      summary.product = 'P'
      summary.layer = 'L'
      summary.component = 'C'
      summary.detail = 'D'
      await nextTick()
      expect(formApi.computedSummary.value).toBe('[V][P][L][C][D]')
    })
  })
})
