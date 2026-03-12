import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TransactionModeTab from '~/components/realEstate/TransactionModeTab.vue'

describe('TransactionModeTab', () => {
  it('should render two tabs (매매, 전월세)', () => {
    const wrapper = mount(TransactionModeTab, {
      props: { modelValue: 'sale' },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBe(2)
    expect(buttons[0].text()).toBe('매매')
    expect(buttons[1].text()).toBe('전월세')
  })

  it('should highlight the active tab (sale)', () => {
    const wrapper = mount(TransactionModeTab, {
      props: { modelValue: 'sale' },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons[0].classes()).toContain('bg-white')
    expect(buttons[1].classes()).not.toContain('bg-white')
  })

  it('should highlight the active tab (rent)', () => {
    const wrapper = mount(TransactionModeTab, {
      props: { modelValue: 'rent' },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons[0].classes()).not.toContain('bg-white')
    expect(buttons[1].classes()).toContain('bg-white')
  })

  it('should emit update:modelValue when tab is clicked', async () => {
    const wrapper = mount(TransactionModeTab, {
      props: { modelValue: 'sale' },
    })
    const buttons = wrapper.findAll('button')
    await buttons[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['rent'])
  })

  it('should emit sale when 매매 tab is clicked', async () => {
    const wrapper = mount(TransactionModeTab, {
      props: { modelValue: 'rent' },
    })
    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['sale'])
  })
})
