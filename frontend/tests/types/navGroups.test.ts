import { describe, it, expect } from 'vitest'
import {
  NAV_GROUPS,
  NAV_LINK_GROUPS,
  CATEGORY_GROUPS,
  isLinkGroup,
  type NavGroup,
  type LinkGroup,
  type CategoryGroup,
} from '../../types/facility'

describe('NAV_GROUPS', () => {
  it('7개 그룹을 포함해야 한다', () => {
    expect(NAV_GROUPS).toHaveLength(7)
  })

  it('첫 번째 그룹이 LinkGroup이어야 한다', () => {
    const firstGroup = NAV_GROUPS[0]
    expect(isLinkGroup(firstGroup)).toBe(true)
  })

  it('부동산 그룹에 5개 링크가 있어야 한다', () => {
    const firstGroup = NAV_GROUPS[0] as LinkGroup
    expect(firstGroup.links).toHaveLength(5)
  })

  it('부동산 그룹의 제목이 "부동산"이어야 한다', () => {
    const firstGroup = NAV_GROUPS[0] as LinkGroup
    expect(firstGroup.title).toBe('부동산')
  })

  it('부동산 그룹의 링크 경로가 올바르게 정의되어야 한다', () => {
    const firstGroup = NAV_GROUPS[0] as LinkGroup
    const links = firstGroup.links.map(({ to, label }) => ({ to, label }))
    const expectedLinks = [
      { to: '/real-estate', label: '실거래가 지도' },
      { to: '/real-estate/apt-sale', label: '아파트' },
      { to: '/real-estate/villa-sale', label: '빌라' },
      { to: '/real-estate/offitel-sale', label: '오피스텔' },
      { to: '/real-estate/land', label: '토지' },
    ]
    expect(links).toEqual(expectedLinks)
  })

  it('청약·임대 그룹은 청약홈 단독 + 분양·임대 청약 2개 섹션 링크를 포함한다', () => {
    const subscriptionGroup = NAV_GROUPS[1] as LinkGroup
    expect(subscriptionGroup.title).toBe('청약·임대')
    const links = subscriptionGroup.links.map(({ to, label }) => ({ to, label }))
    expect(links).toEqual([
      // 청약홈 (top, no section — 분양·임대 모두 아우르는 hub)
      { to: '/subscription', label: '청약홈' },
      // 분양 sub-types
      { to: '/subscription/sale/apt', label: '아파트 분양' },
      { to: '/subscription/sale/offitel', label: '오피스텔·도시형' },
      { to: '/subscription/sale/remaining', label: '무순위·잔여세대' },
      { to: '/subscription/sale/optional', label: '임의공급' },
      // 임대 청약 (청약통장)
      { to: '/subscription/rent/public', label: '공공임대 청약' },
      { to: '/subscription/rent/private', label: '공공지원 민간임대' },
    ])
  })

  it('청약·임대 그룹 첫 링크(청약홈)는 섹션이 없고 나머지는 2개 섹션으로 나뉜다', () => {
    const subscriptionGroup = NAV_GROUPS[1] as LinkGroup
    const sections = subscriptionGroup.links.map(l => l.section)
    expect(sections).toEqual([
      undefined,                                    // 청약홈
      '분양', '분양', '분양', '분양',
      '임대 청약', '임대 청약',
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
    // icon 은 CategoryGroup 에만 있다 — LinkGroup(부동산·청약·공매)은 GNB 텍스트온리라
    // 아이콘 필드를 갖지 않는다. 여기 4개는 전부 CategoryGroup 이므로 좁혀서 비교한다.
    const lastFour = NAV_GROUPS.slice(3, 7) as CategoryGroup[]
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
      links: [{ to: '/test', label: '테스트' }],
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

describe('NAV_LINK_GROUPS', () => {
  it('링크 그룹 3개(부동산, 청약·임대, 공매)를 포함한다', () => {
    expect(NAV_LINK_GROUPS).toHaveLength(3)
    expect(NAV_LINK_GROUPS.every((g) => isLinkGroup(g))).toBe(true)
  })

  it('첫째는 부동산, 둘째는 청약·임대, 셋째는 공매여야 한다', () => {
    expect(NAV_LINK_GROUPS[0].title).toBe('부동산')
    expect(NAV_LINK_GROUPS[1].title).toBe('청약·임대')
    expect(NAV_LINK_GROUPS[2].title).toBe('공매')
  })

  it('공매 그룹은 7개 링크를 포함한다', () => {
    expect(NAV_LINK_GROUPS[2].links).toHaveLength(7)
  })

  it('NAV_GROUPS의 앞 3개가 NAV_LINK_GROUPS와 동일해야 한다', () => {
    expect(NAV_GROUPS.slice(0, 3)).toEqual([...NAV_LINK_GROUPS])
  })
})

// 하단 유형 카드를 제거한 뒤로 /real-estate/land 의 내부 링크는 이 GNB 항목 하나뿐이다.
// 이걸 지우면 토지 허브와 그 아래 시/도·구군·동 페이지 전체가 내부 링크 0이 된다.
describe('GNB 토지 링크 존치', () => {
  it('부동산 드롭다운에 /real-estate/land 가 있다', () => {
    const realEstate = NAV_LINK_GROUPS.find((g) => g.title === '부동산')
    expect(realEstate).toBeDefined()
    expect(realEstate!.links.map((l) => l.to)).toContain('/real-estate/land')
  })
})
