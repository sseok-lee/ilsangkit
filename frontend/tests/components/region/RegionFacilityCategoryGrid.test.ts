import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RegionFacilityCategoryGrid from '~/components/region/RegionFacilityCategoryGrid.vue'

const globalConfig = {
  stubs: {
    NuxtLink: { template: '<a :href="to" :class="$attrs.class"><slot /></a>', props: ['to'], inheritAttrs: false },
  },
}

describe('RegionFacilityCategoryGrid', () => {
  it('카테고리별 시설수 카드를 /[city]/[district]/[cat]으로 링크', () => {
    const wrapper = mount(RegionFacilityCategoryGrid, {
      props: {
        city: 'seoul',
        district: 'gangnam',
        total: 1234,
        categories: { parking: 50, hospital: 30 },
        topCategories: ['parking'],
      },
      global: globalConfig,
    })
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(2)
    expect(links[0].attributes('href')).toBe('/seoul/gangnam/parking')
    expect(links[1].attributes('href')).toBe('/seoul/gangnam/hospital')
  })

  it('총 시설수를 천 단위 콤마 포맷으로 표시', () => {
    const wrapper = mount(RegionFacilityCategoryGrid, {
      props: {
        city: 'seoul',
        district: 'gangnam',
        total: 12345,
        categories: { parking: 50 },
        topCategories: [],
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('12,345개 시설')
  })

  it('topCategories에 포함된 카테고리는 강조 클래스 적용', () => {
    const wrapper = mount(RegionFacilityCategoryGrid, {
      props: {
        city: 'seoul',
        district: 'gangnam',
        total: 100,
        categories: { parking: 50, hospital: 30 },
        topCategories: ['parking'],
      },
      global: globalConfig,
    })
    const links = wrapper.findAll('a')
    // parking is in topCategories → primary border
    expect(links[0].classes().some(c => c.includes('primary'))).toBe(true)
    // hospital is not → slate border
    expect(links[1].classes().some(c => c.includes('slate-200'))).toBe(true)
  })

  it('H2 "생활시설 현황" 헤딩 + section id="facilities"', () => {
    const wrapper = mount(RegionFacilityCategoryGrid, {
      props: {
        city: 'seoul', district: 'gangnam', total: 0, categories: {}, topCategories: [],
      },
      global: globalConfig,
    })
    expect(wrapper.find('section#facilities').exists()).toBe(true)
    expect(wrapper.find('h2').text()).toContain('생활시설 현황')
  })
})
