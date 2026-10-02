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

  it('topCategories에 포함된 카테고리는 글자 표식으로 강조한다', () => {
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
    expect(links[0].find('[data-test="top-mark"]').text()).toBe('많은 시설')
    expect(links[1].find('[data-test="top-mark"]').exists()).toBe(false)
  })

  it('H2 "생활시설현황" 헤딩 + section id="facilities"', () => {
    const wrapper = mount(RegionFacilityCategoryGrid, {
      props: {
        city: 'seoul', district: 'gangnam', total: 0, categories: {}, topCategories: [],
      },
      global: globalConfig,
    })
    expect(wrapper.find('section#facilities').exists()).toBe(true)
    expect(wrapper.find('h2').text()).toContain('생활시설현황')
  })

  it('평면 섹션 + 구분선 행, 상자·회색 없음', () => {
    const w = mount(RegionFacilityCategoryGrid, {
      props: {
        city: 'seoul', district: 'gangnam', total: 100, categories: { parking: 50, hospital: 30 }, topCategories: ['parking'],
      },
      global: globalConfig,
    })
    expect(w.get('section#facilities').classes()).toContain('section-flat')
    expect(w.html()).not.toMatch(/rounded-xl|bg-primary\/5|slate-/)
  })
})
