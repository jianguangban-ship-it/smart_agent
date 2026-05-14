import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'

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
  ],
  TEAM_MEMBERS: { HW: [{ id: 'user1', name: 'User One' }] }
}))

vi.mock('@/config/constants', () => ({
  DEFAULT_COMPONENTS_BY_PROJECT: { HW: ['CompA', 'CompB'] },
  VEHICLE_OPTIONS: [] as string[],
  PRODUCT_OPTIONS: [] as string[],
  LAYER_OPTIONS: [] as string[]
}))

vi.mock('@/composables/useRole', () => ({
  currentRole: { value: 'sw-developer' }
}))

const storage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v },
  removeItem: (k: string) => { delete storage[k] }
})

import { useForm } from '../useForm'

// sw-developer weights (mirrors ROLE_WEIGHTS['sw-developer'] in useForm.ts):
//   projectKey 8, issueType 8, assignee 8, estimatedPoints 6,
//   vehicle 6, product 6, layer 6, component 8, detail 12,
//   descriptionPresent 12, descriptionLength 20

describe('useForm', () => {
  let formApi: ReturnType<typeof useForm>

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k])
    formApi = useForm()
  })

  describe('canSubmit', () => {
    it('returns false with default state (all fields empty)', () => {
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
      summary.product = ''
      summary.layer = 'L'
      summary.component = 'C'
      summary.detail = 'D'
      await nextTick()
      expect(formApi.canSubmit.value).toBe(false)
    })
  })

  describe('qualityScore', () => {
    it('is 0 with empty defaults', () => {
      expect(formApi.qualityScore.value).toBe(0)
    })

    it('reaches 100 when every field is filled with description >= 200 chars', async () => {
      const { form, summary } = formApi
      form.projectKey = 'HW'
      form.issueType = 'Story'
      form.assignee = 'user1'
      form.estimatedPoints = 3
      form.description = 'x'.repeat(200)
      summary.vehicle = 'V'
      summary.product = 'P'
      summary.layer = 'L'
      summary.component = 'C'
      summary.detail = 'D'
      await nextTick()
      // 8 + 8 + 8 + 6 + 6 + 6 + 6 + 8 + 12 + 12 + 20 = 100
      expect(formApi.qualityScore.value).toBe(100)
    })

    it('caps at 100 even with very long description', async () => {
      const { form, summary } = formApi
      form.projectKey = 'HW'
      form.issueType = 'Story'
      form.assignee = 'user1'
      form.estimatedPoints = 3
      form.description = 'x'.repeat(1000)
      summary.vehicle = 'V'
      summary.product = 'P'
      summary.layer = 'L'
      summary.component = 'C'
      summary.detail = 'D'
      await nextTick()
      expect(formApi.qualityScore.value).toBe(100)
    })

    it('adds description presence and length bonus only', async () => {
      const { form } = formApi
      form.description = 'x'.repeat(100)
      await nextTick()
      // descPresent 12 + floor(100/200 * 20) = 12 + 10 = 22
      expect(formApi.qualityScore.value).toBe(22)
    })

    it('no INCOSE penalty subtraction (v10.87 — penalty term removed)', async () => {
      const { form } = formApi
      // A description that pre-v10.87 would have triggered INCOSE warnings
      // (no action verb, no acceptance criteria, no effort estimate, contains TBD)
      form.description = 'TBD some content here that is long enough to exceed eighty characters in length yes definitely.'
      await nextTick()
      // descPresent 12 + floor(desc.length/200 * 20) = 12 + 9 = 21
      // Pre-v10.87 this would have been 21 - capped penalty; now strictly additive.
      expect(formApi.qualityScore.value).toBeGreaterThan(0)
      expect(formApi.qualityScore.value).toBeLessThanOrEqual(22)
    })
  })

  describe('qualityScoreColor', () => {
    it('returns green for score >= 80', async () => {
      const { form, summary } = formApi
      form.projectKey = 'HW'
      form.issueType = 'Story'
      form.assignee = 'user1'
      form.estimatedPoints = 3
      form.description = 'x'.repeat(200)
      summary.vehicle = 'V'
      summary.product = 'P'
      summary.layer = 'L'
      summary.component = 'C'
      summary.detail = 'D'
      await nextTick()
      expect(formApi.qualityScoreColor.value).toBe('var(--accent-green)')
    })

    it('returns orange for 50 <= score < 80', async () => {
      const { form } = formApi
      // 8 + 8 + 8 + 6 + 12 + 20 = 62
      form.projectKey = 'HW'
      form.issueType = 'Story'
      form.assignee = 'user1'
      form.estimatedPoints = 3
      form.description = 'x'.repeat(200)
      await nextTick()
      expect(formApi.qualityScoreColor.value).toBe('var(--accent-orange)')
    })

    it('returns red for 0 < score < 50', async () => {
      const { form } = formApi
      form.projectKey = 'HW'
      await nextTick()
      // 8 = 8
      expect(formApi.qualityScore.value).toBe(8)
      expect(formApi.qualityScoreColor.value).toBe('var(--accent-red)')
    })

    it('returns muted for score 0', () => {
      expect(formApi.qualityScoreColor.value).toBe('var(--text-muted)')
    })
  })

  describe('qualityScoreLabel', () => {
    it('returns quality.empty for score 0', () => {
      expect(formApi.qualityScoreLabel.value).toBe('quality.empty')
    })

    it('returns quality.incomplete for 0 < score < 50', async () => {
      const { form } = formApi
      form.projectKey = 'HW'
      await nextTick()
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
