import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RegionRealEstateCta from '~/components/region/RegionRealEstateCta.vue'

const globalConfig = {
  stubs: {
    NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  },
}

describe('RegionRealEstateCta', () => {
  it('areaName이 H2에 포함된 CTA 헤딩 렌더', () => {
    const wrapper = mount(RegionRealEstateCta, {
      props: { areaName: '강남구' },
      global: globalConfig,
    })
    expect(wrapper.find('h2').text()).toContain('강남구 부동산 실거래가 상세 보기')
  })

  it('areaName은 시 이름도 받음 (시·구 양쪽에서 재사용)', () => {
    const wrapper = mount(RegionRealEstateCta, {
      props: { areaName: '서울' },
      global: globalConfig,
    })
    expect(wrapper.find('h2').text()).toContain('서울 부동산 실거래가 상세 보기')
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

  // SectionBlock/UiButton은 stub하지 않는다: 평면 섹션 클래스와 버튼 변형은 실제 컴포넌트가 렌더해야 검증된다.
  it('평면 섹션 + 아파트 primary, 빌라·오피스텔 secondary 버튼', () => {
    const w = mount(RegionRealEstateCta, { props: { areaName: '강남구' }, global: globalConfig })
    expect(w.get('section').classes()).toContain('section-flat')
    const links = w.findAll('a')
    expect(links[0].classes()).toContain('ui-btn--primary')
    expect(links[1].classes()).toContain('ui-btn--secondary')
    expect(links[2].classes()).toContain('ui-btn--secondary')
    expect(w.html()).not.toMatch(/bg-primary\/5|rounded-2xl|slate-/)
  })
})
