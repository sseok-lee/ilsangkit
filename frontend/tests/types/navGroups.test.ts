import { describe, it, expect } from 'vitest'
import {
  NAV_GROUPS,
  CATEGORY_GROUPS,
  isLinkGroup,
  type NavGroup,
  type LinkGroup,
} from '../../types/facility'

describe('NAV_GROUPS', () => {
  it('4개 그룹을 포함해야 한다', () => {
    expect(NAV_GROUPS).toHaveLength(4)
  })

  it('4번째 그룹이 LinkGroup이어야 한다', () => {
    const fourthGroup = NAV_GROUPS[3]
    expect(isLinkGroup(fourthGroup)).toBe(true)
  })

  it('부동산 그룹에 3개 링크가 있어야 한다', () => {
    const fourthGroup = NAV_GROUPS[3] as LinkGroup
    expect(fourthGroup.links).toHaveLength(3)
  })

  it('부동산 그룹의 제목이 "부동산"이어야 한다', () => {
    const fourthGroup = NAV_GROUPS[3] as LinkGroup
    expect(fourthGroup.title).toBe('부동산')
  })

  it('부동산 그룹의 링크 경로가 올바르게 정의되어야 한다', () => {
    const fourthGroup = NAV_GROUPS[3] as LinkGroup
    const expectedLinks = [
      { to: '/real-estate/apt', label: '아파트' },
      { to: '/real-estate/villa', label: '빌라' },
      { to: '/real-estate/offitel', label: '오피스텔' },
    ]
    expect(fourthGroup.links).toEqual(expectedLinks)
  })
})

describe('CATEGORY_GROUPS 하위 호환', () => {
  it('CATEGORY_GROUPS는 3개 그룹을 유지해야 한다', () => {
    expect(CATEGORY_GROUPS).toHaveLength(3)
  })

  it('CATEGORY_GROUPS의 첫 번째 그룹은 생활 편의여야 한다', () => {
    expect(CATEGORY_GROUPS[0].title).toBe('생활 편의')
  })

  it('CATEGORY_GROUPS의 두 번째 그룹은 건강/안전이어야 한다', () => {
    expect(CATEGORY_GROUPS[1].title).toBe('건강/안전')
  })

  it('CATEGORY_GROUPS의 세 번째 그룹은 문화/환경이어야 한다', () => {
    expect(CATEGORY_GROUPS[2].title).toBe('문화/환경')
  })

  it('NAV_GROUPS의 처음 3개 그룹이 CATEGORY_GROUPS와 동일해야 한다', () => {
    const firstThree = NAV_GROUPS.slice(0, 3)
    firstThree.forEach((group, i) => {
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
