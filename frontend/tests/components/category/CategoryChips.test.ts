import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CategoryChips from '~/app/components/category/CategoryChips.vue'

describe('CategoryChips', () => {
  const categories = [
    { id: 'toilet', label: '공공화장실' },
    { id: 'trash', label: '쓰레기 배출' },
    { id: 'wifi', label: '무료 와이파이' },
    { id: 'clothes', label: '의류수거함' },
    { id: 'kiosk', label: '무인민원발급기' },
  ]

  it('renders all 5 categories', () => {
    const wrapper = mount(CategoryChips, {
      props: {
        categories,
        selectedCategory: null,
      },
    })

    const chips = wrapper.findAll('button')
    expect(chips).toHaveLength(5)
  })

  it('displays correct labels for each category', () => {
    const wrapper = mount(CategoryChips, {
      props: {
        categories,
        selectedCategory: null,
      },
    })

    const chips = wrapper.findAll('button')
    expect(chips[0].text()).toContain('공공화장실')
    expect(chips[1].text()).toContain('쓰레기 배출')
    expect(chips[2].text()).toContain('무료 와이파이')
    expect(chips[3].text()).toContain('의류수거함')
    expect(chips[4].text()).toContain('무인민원발급기')
  })

  it('highlights selected category', () => {
    const wrapper = mount(CategoryChips, {
      props: {
        categories,
        selectedCategory: 'toilet',
      },
    })

    const chips = wrapper.findAll('button')
    // First chip (toilet) should have selected styling
    expect(chips[0].classes()).toContain('bg-indigo-600')
    // Others should not
    expect(chips[1].classes()).not.toContain('bg-indigo-600')
  })

  it('emits select event when chip is clicked', async () => {
    const wrapper = mount(CategoryChips, {
      props: {
        categories,
        selectedCategory: null,
      },
    })

    const chips = wrapper.findAll('button')
    await chips[1].trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')?.[0]).toEqual(['trash'])
  })

  it('allows deselecting by clicking selected chip', async () => {
    const wrapper = mount(CategoryChips, {
      props: {
        categories,
        selectedCategory: 'wifi',
      },
    })

    const chips = wrapper.findAll('button')
    await chips[2].trigger('click') // Click wifi again

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')?.[0]).toEqual([null])
  })

  it('applies horizontal scroll on mobile', () => {
    const wrapper = mount(CategoryChips, {
      props: {
        categories,
        selectedCategory: null,
      },
    })

    const container = wrapper.find('[data-testid="chips-container"]')
    expect(container.classes()).toContain('overflow-x-auto')
  })

  it('applies grid layout on desktop', () => {
    const wrapper = mount(CategoryChips, {
      props: {
        categories,
        selectedCategory: null,
      },
    })

    const container = wrapper.find('[data-testid="chips-container"]')
    // Should have md:grid or lg:grid class
    expect(container.classes().some((c) => c.includes('md:grid'))).toBe(true)
  })
})
