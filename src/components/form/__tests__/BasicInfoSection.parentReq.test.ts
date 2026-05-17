import { describe, it, expect, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'

const storage: Record<string, string> = {}
beforeAll(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
  } as Storage
})

import BasicInfoSection from '../BasicInfoSection.vue'
import type { FormState } from '@/types/form'

const ComboStub = { template: '<div class="combo" />', props: ['modelValue', 'items', 'selectedName', 'placeholder', 'groupLabel', 'resultsLabel', 'noResultsLabel'] }
const PointsStub = { template: '<div class="points" />', props: ['modelValue'] }

function makeForm(): FormState {
  return {
    projectKey: '', assignee: '', issueType: 'Story',
    estimatedPoints: 0, description: '', parentReqId: '',
    requirementLevel: 'none',
  } as unknown as FormState
}

function mountSection(form = makeForm()) {
  return mount(BasicInfoSection, {
    props: { form },
    global: { stubs: { AssigneeCombobox: ComboStub, StoryPointsPicker: PointsStub } },
  })
}

describe('BasicInfoSection — Parent Requirement input', () => {
  it('renders a parent-requirement text input bound to form.parentReqId', async () => {
    const form = makeForm()
    const wrapper = mountSection(form)
    expect(wrapper.find('#basic-parent-req').exists()).toBe(true)
    const input = wrapper.get('#basic-parent-req')

    await input.setValue('DKKF-123')
    expect(form.parentReqId).toBe('DKKF-123')
  })

  it('reflects an existing parentReqId value', () => {
    const form = makeForm()
    form.parentReqId = 'ABC-9'
    const wrapper = mountSection(form)
    expect((wrapper.get('#basic-parent-req').element as HTMLInputElement).value).toBe('ABC-9')
  })
})
