import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import CompositeCodeCombobox from '../CompositeCodeCombobox.vue'

const ITEMS = [
  { code: 'GWM-DE06-MY2026-J500-0009-EDC', productLine: 'X-line', projectNo: 'DE06' },
  { code: 'GWM-DE07-MY2026-J500-0010-EDC', productLine: 'Y-Line', projectNo: 'DE07' },
  { code: 'GWM-DE08HEV-MY2026-J500-0014-EDC', productLine: 'X-line', projectNo: 'DE08HEV' },
]

let wrapper: VueWrapper | null = null
function mountBox() {
  wrapper = mount(CompositeCodeCombobox, {
    props: { modelValue: '', items: ITEMS, resultsLabel: 'codes', noResultsLabel: 'none' },
  })
}
afterEach(() => { wrapper?.unmount(); wrapper = null })

describe('CompositeCodeCombobox', () => {
  it('lists all options on focus and filters by code / line / project', async () => {
    mountBox()
    await wrapper!.find('input').trigger('focus')
    expect(wrapper!.findAll('.combobox-option')).toHaveLength(3)

    // filter by project number
    await wrapper!.find('input').setValue('DE08HEV')
    const opts = wrapper!.findAll('.combobox-option')
    expect(opts).toHaveLength(1)
    expect(opts[0].text()).toContain('GWM-DE08HEV-MY2026-J500-0014-EDC')
  })

  it('emits the composite code on click', async () => {
    mountBox()
    await wrapper!.find('input').trigger('focus')
    await wrapper!.findAll('.combobox-option')[1].trigger('click')
    expect(wrapper!.emitted('update:modelValue')?.[0]).toEqual(['GWM-DE07-MY2026-J500-0010-EDC'])
  })

  it('shows a no-results message when nothing matches', async () => {
    mountBox()
    await wrapper!.find('input').trigger('focus')
    await wrapper!.find('input').setValue('zzz')
    expect(wrapper!.find('.combobox-empty').exists()).toBe(true)
    expect(wrapper!.findAll('.combobox-option')).toHaveLength(0)
  })
})
