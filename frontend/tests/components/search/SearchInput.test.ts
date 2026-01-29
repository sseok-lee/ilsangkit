import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchInput from '~/app/components/search/SearchInput.vue'

describe('SearchInput', () => {
  it('renders with placeholder', () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: '',
        placeholder: '검색어를 입력하세요',
      },
    })

    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect(input.attributes('placeholder')).toBe('검색어를 입력하세요')
  })

  it('emits update:modelValue when input changes', async () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: '',
        placeholder: '검색',
      },
    })

    const input = wrapper.find('input')
    await input.setValue('화장실')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['화장실'])
  })

  it('emits search event when Enter key is pressed', async () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: '화장실',
        placeholder: '검색',
      },
    })

    const input = wrapper.find('input')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('search')).toBeTruthy()
    expect(wrapper.emitted('search')?.length).toBe(1)
  })

  it('emits search event when search button is clicked', async () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: '화장실',
        placeholder: '검색',
      },
    })

    const button = wrapper.find('button')
    await button.trigger('click')

    expect(wrapper.emitted('search')).toBeTruthy()
    expect(wrapper.emitted('search')?.length).toBe(1)
  })

  it('has minimum touch area of 44px for button', () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: '',
        placeholder: '검색',
      },
    })

    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    // Button should have min-h-11 (44px) or larger
    expect(button.classes()).toContain('min-h-11')
  })

  it('displays search icon', () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: '',
        placeholder: '검색',
      },
    })

    // Should render an icon (svg or icon component)
    const button = wrapper.find('button')
    expect(button.html()).toContain('svg')
  })
})
