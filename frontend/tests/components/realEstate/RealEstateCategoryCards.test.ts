import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RealEstateCategoryCards from '~/components/realEstate/RealEstateCategoryCards.vue'

describe('RealEstateCategoryCards', () => {
  it('summaries 없이도 6장 카드를 렌더한다', () => {
    const wrapper = mount(RealEstateCategoryCards)
    const cards = wrapper.findAll('[data-test="hub-card"]')
    expect(cards).toHaveLength(6)
  })

  it('카드 순서는 아파트 → 오피스텔 → 빌라', () => {
    const wrapper = mount(RealEstateCategoryCards)
    const links = wrapper.findAll('[data-test="hub-card"]').map((c) => c.attributes('href'))
    expect(links).toEqual([
      '/real-estate/apt-sale',
      '/real-estate/apt-rent',
      '/real-estate/offitel-sale',
      '/real-estate/offitel-rent',
      '/real-estate/villa-sale',
      '/real-estate/villa-rent',
    ])
  })

  it('summaries 제공 시 라이브 수치를 ko-KR 포맷으로 표시', () => {
    const wrapper = mount(RealEstateCategoryCards, {
      props: {
        summaries: {
          'apt-sale': { last30dCount: 12431 },
          'apt-rent': { last30dCount: 8902 },
          'offitel-sale': { last30dCount: 642 },
          'offitel-rent': { last30dCount: 1180 },
          'villa-sale': { last30dCount: 2103 },
          'villa-rent': { last30dCount: 4587 },
        },
      },
    })
    expect(wrapper.text()).toContain('12,431')
    expect(wrapper.text()).toContain('8,902')
  })

  it('last30dCount가 null이면 "데이터 동기화 중" 표시', () => {
    const wrapper = mount(RealEstateCategoryCards, {
      props: {
        summaries: {
          'apt-sale': { last30dCount: null },
          'apt-rent': { last30dCount: null },
          'offitel-sale': { last30dCount: null },
          'offitel-rent': { last30dCount: null },
          'villa-sale': { last30dCount: null },
          'villa-rent': { last30dCount: null },
        },
      },
    })
    const placeholders = wrapper.findAll('[data-test="hub-card-count-placeholder"]')
    expect(placeholders).toHaveLength(6)
  })

  it('매매 카드에는 "매매" 뱃지, 전월세 카드에는 "전월세" 뱃지', () => {
    const wrapper = mount(RealEstateCategoryCards)
    const badges = wrapper.findAll('[data-test="hub-card-badge"]').map((b) => b.text())
    expect(badges).toEqual(['매매', '전월세', '매매', '전월세', '매매', '전월세'])
  })
})
