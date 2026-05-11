import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RegionRealEstateCta from '~/components/region/RegionRealEstateCta.vue'

const globalConfig = {
  stubs: {
    NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  },
}

describe('RegionRealEstateCta', () => {
  it('areaName이 H3에 포함된 CTA 헤딩 렌더', () => {
    const wrapper = mount(RegionRealEstateCta, {
      props: { areaName: '강남구' },
      global: globalConfig,
    })
    expect(wrapper.find('h3').text()).toContain('강남구 부동산 실거래가 상세 보기')
  })

  it('areaName은 시 이름도 받음 (시·구 양쪽에서 재사용)', () => {
    const wrapper = mount(RegionRealEstateCta, {
      props: { areaName: '서울' },
      global: globalConfig,
    })
    expect(wrapper.find('h3').text()).toContain('서울 부동산 실거래가 상세 보기')
  })

  it('3개 부동산 카테고리 버튼 — 매매 페이지로 링크', () => {
    const wrapper = mount(RegionRealEstateCta, {
      props: { areaName: '강남구' },
      global: globalConfig,
    })
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(3)
    expect(links[0].attributes('href')).toBe('/real-estate/apt-sale')
    expect(links[1].attributes('href')).toBe('/real-estate/villa-sale')
    expect(links[2].attributes('href')).toBe('/real-estate/offitel-sale')
    expect(links[0].text()).toBe('아파트')
    expect(links[1].text()).toBe('빌라')
    expect(links[2].text()).toBe('오피스텔')
  })
})
