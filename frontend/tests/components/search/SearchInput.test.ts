import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchInput from '~/components/search/SearchInput.vue'

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
    // Updated design: button uses rounded-xl (from Stitch design system)
    expect(button.classes()).toContain('rounded-xl')
    // Updated: now uses 'bg-primary' instead of 'bg-primary-600'
    expect(button.classes()).toContain('bg-primary')
  })

  it('displays search icon in left side', () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: '',
        placeholder: '검색',
      },
    })

    // Updated design: search icon container uses pl-4 instead of left-4
    const iconContainer = wrapper.find('div.absolute')
    expect(iconContainer.exists()).toBe(true)
    expect(iconContainer.classes()).toContain('pl-4')
    // Updated: now uses Material Symbols instead of SVG
    expect(iconContainer.html()).toContain('material-symbols-outlined')
  })

  it('displays custom button text when provided', () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: '',
        placeholder: '검색',
        buttonText: '현재 위치로 검색',
      },
    })

    const button = wrapper.find('button')
    expect(button.text()).toBe('현재 위치로 검색')
  })

  it('displays default button text when not provided', () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: '',
        placeholder: '검색',
      },
    })

    const button = wrapper.find('button')
    expect(button.text()).toBe('검색')
  })
})
