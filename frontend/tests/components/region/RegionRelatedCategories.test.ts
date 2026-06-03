import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RegionRelatedCategories from '~/components/region/RegionRelatedCategories.vue'

const globalConfig = {
  stubs: {
    SectionBlock: { template: '<section><h3>{{ heading }}</h3><slot /></section>', props: ['heading', 'subtext'] },
    NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  },
}

describe('RegionRelatedCategories', () => {
  it('각 카테고리 링크가 /[city]/[district]/[slug] 형태로 렌더', () => {
    const wrapper = mount(RegionRelatedCategories, {
      props: {
        city: 'seoul',
        district: 'gangnam',
        districtName: '강남구',
        categories: [
          { slug: 'parking', name: '주차장' },
          { slug: 'hospital', name: '병원' },
        ],
      },
      global: globalConfig,
    })

    const links = wrapper.findAll('a')
    expect(links).toHaveLength(2)
    expect(links[0].attributes('href')).toBe('/seoul/gangnam/parking')
    expect(links[1].attributes('href')).toBe('/seoul/gangnam/hospital')
    expect(wrapper.text()).toContain('강남구 주차장')
    expect(wrapper.text()).toContain('강남구 병원')
  })

  it('카테고리 없으면 빈 nav 렌더', () => {
    const wrapper = mount(RegionRelatedCategories, {
      props: { city: 'seoul', district: 'gangnam', districtName: '강남구', categories: [] },
      global: globalConfig,
    })
    expect(wrapper.findAll('a')).toHaveLength(0)
    // SectionBlock heading 자체는 렌더됨
    expect(wrapper.text()).toContain('관련 탐색')
  })

  it('data-testid="region-related-categories"로 식별 가능', () => {
    const wrapper = mount(RegionRelatedCategories, {
      props: {
        city: 'seoul',
        district: 'gangnam',
        districtName: '강남구',
        categories: [{ slug: 'parking', name: '주차장' }],
      },
      global: globalConfig,
    })
    expect(wrapper.find('[data-testid="region-related-categories"]').exists()).toBe(true)
  })
})
