import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NearbyDistrictsNav from '~/components/region/NearbyDistrictsNav.vue'

const nearby = [
  { slug: 'songpa', district: '송파구', count: 61 },
  { slug: 'seocho', district: '서초구', count: 52 },
  { slug: 'gangdong', district: '강동구', count: 38 },
]

describe('NearbyDistrictsNav', () => {
  it('인근 구 목록을 NuxtLink로 렌더링', () => {
    const wrapper = mount(NearbyDistrictsNav, {
      props: { citySlug: 'seoul', category: 'toilet', categoryLabel: '공공화장실', districts: nearby },
    })
    const links = wrapper.findAll('a')
    expect(links.length).toBe(3)
  })

  it('각 링크의 href는 /<city>/<district>/<category>', () => {
    const wrapper = mount(NearbyDistrictsNav, {
      props: { citySlug: 'seoul', category: 'toilet', categoryLabel: '공공화장실', districts: nearby },
    })
    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('/seoul/songpa/toilet')
    expect(hrefs).toContain('/seoul/seocho/toilet')
    expect(hrefs).toContain('/seoul/gangdong/toilet')
  })

  it('구 이름과 count를 표시', () => {
    const wrapper = mount(NearbyDistrictsNav, {
      props: { citySlug: 'seoul', category: 'toilet', categoryLabel: '공공화장실', districts: nearby },
    })
    const text = wrapper.text()
    expect(text).toContain('송파구')
    expect(text).toContain('61')
    expect(text).toContain('서초구')
  })

  it('districts가 비어있으면 컴포넌트를 렌더링하지 않음(v-if false)', () => {
    const wrapper = mount(NearbyDistrictsNav, {
      props: { citySlug: 'seoul', category: 'toilet', categoryLabel: '공공화장실', districts: [] },
    })
    // 컴포넌트는 존재하지만 내부 nav는 숨김 — 링크 0개
    expect(wrapper.findAll('a').length).toBe(0)
  })

  it('카테고리 라벨을 섹션 헤더에 표시', () => {
    const wrapper = mount(NearbyDistrictsNav, {
      props: { citySlug: 'seoul', category: 'toilet', categoryLabel: '공공화장실', districts: nearby },
    })
    expect(wrapper.text()).toContain('공공화장실')
  })
})
