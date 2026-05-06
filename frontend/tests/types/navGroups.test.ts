import { describe, it, expect } from 'vitest'
import {
  NAV_GROUPS,
  CATEGORY_GROUPS,
  isLinkGroup,
  type NavGroup,
  type LinkGroup,
} from '../../types/facility'

describe('NAV_GROUPS', () => {
  it('6개 그룹을 포함해야 한다', () => {
    expect(NAV_GROUPS).toHaveLength(6)
  })

  it('첫 번째 그룹이 LinkGroup이어야 한다', () => {
    const firstGroup = NAV_GROUPS[0]
    expect(isLinkGroup(firstGroup)).toBe(true)
  })

  it('부동산 그룹에 4개 링크가 있어야 한다', () => {
    const firstGroup = NAV_GROUPS[0] as LinkGroup
    expect(firstGroup.links).toHaveLength(4)
  })

  it('부동산 그룹의 제목이 "부동산"이어야 한다', () => {
    const firstGroup = NAV_GROUPS[0] as LinkGroup
    expect(firstGroup.title).toBe('부동산')
  })

  it('부동산 그룹의 링크 경로가 올바르게 정의되어야 한다', () => {
    const firstGroup = NAV_GROUPS[0] as LinkGroup
    const links = firstGroup.links.map(({ to, label }) => ({ to, label }))
    const expectedLinks = [
      { to: '/real-estate', label: '부동산 전체' },
      { to: '/real-estate/apt-sale', label: '아파트' },
      { to: '/real-estate/villa-sale', label: '빌라' },
      { to: '/real-estate/offitel-sale', label: '오피스텔' },
    ]
    expect(links).toEqual(expectedLinks)
  })

  it('청약·임대 그룹은 분양·임대 청약·공공임대 입주 3개 섹션 링크를 포함한다', () => {
    const subscriptionGroup = NAV_GROUPS[1] as LinkGroup
    expect(subscriptionGroup.title).toBe('청약·임대')
    const links = subscriptionGroup.links.map(({ to, label }) => ({ to, label }))
    expect(links).toEqual([
      // 분양
      { to: '/subscription', label: '청약 전체' },
      { to: '/subscription/sale', label: '분양 전체' },
      { to: '/subscription/sale/optional', label: '임의공급' },
      // 임대 청약 (청약통장)
      { to: '/subscription/rent', label: '임대 청약 전체' },
      { to: '/subscription/rent/public', label: '공공임대 청약' },
      { to: '/subscription/rent/private', label: '공공지원 민간임대' },
      // 공공임대 입주 (자격 기반)
      { to: '/public-rental', label: '공공임대 단지' },
      { to: '/public-rental/buy-lease', label: '매입임대' },
      { to: '/public-rental/charter', label: '전세임대' },
    ])
  })

  it('청약·임대 그룹 링크는 분양·임대 청약·공공임대 입주 3개 섹션으로 나뉜다', () => {
    const subscriptionGroup = NAV_GROUPS[1] as LinkGroup
    const sections = subscriptionGroup.links.map(l => l.section)
    expect(sections).toEqual([
      '분양', '분양', '분양',
      '임대 청약', '임대 청약', '임대 청약',
      '공공임대 입주', '공공임대 입주', '공공임대 입주',
    ])
  })
})

describe('CATEGORY_GROUPS', () => {
  it('CATEGORY_GROUPS는 4개 그룹을 유지해야 한다', () => {
    expect(CATEGORY_GROUPS).toHaveLength(4)
  })

  it('CATEGORY_GROUPS의 첫 번째 그룹은 교육/육아여야 한다', () => {
    expect(CATEGORY_GROUPS[0].title).toBe('교육/육아')
  })

  it('CATEGORY_GROUPS의 두 번째 그룹은 건강/안전이어야 한다', () => {
    expect(CATEGORY_GROUPS[1].title).toBe('건강/안전')
  })

  it('CATEGORY_GROUPS의 세 번째 그룹은 생활/편의여야 한다', () => {
    expect(CATEGORY_GROUPS[2].title).toBe('생활/편의')
  })

  it('CATEGORY_GROUPS의 네 번째 그룹은 환경/생활이어야 한다', () => {
    expect(CATEGORY_GROUPS[3].title).toBe('환경/생활')
  })

  it('NAV_GROUPS의 마지막 4개 그룹이 CATEGORY_GROUPS와 동일해야 한다', () => {
    const lastFour = NAV_GROUPS.slice(2, 6)
    lastFour.forEach((group, i) => {
      expect(group.title).toBe(CATEGORY_GROUPS[i].title)
      expect(group.icon).toBe(CATEGORY_GROUPS[i].icon)
    })
  })
})

describe('isLinkGroup 타입 가드', () => {
  it('links 속성이 있는 그룹을 LinkGroup으로 판별해야 한다', () => {
    const linkGroup: NavGroup = {
      title: '테스트',
      icon: 'test',
      links: [{ to: '/test', label: '테스트', icon: 'test_icon' }],
    }
    expect(isLinkGroup(linkGroup)).toBe(true)
  })

  it('categories 속성이 있는 그룹을 LinkGroup으로 판별하지 않아야 한다', () => {
    const categoryGroup: NavGroup = {
      title: '테스트',
      icon: 'test',
      categories: ['toilet'],
    }
    expect(isLinkGroup(categoryGroup)).toBe(false)
  })
})
