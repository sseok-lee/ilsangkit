import { describe, it, expect } from 'vitest'
import { NON_REGION_CATEGORIES, CATEGORY_GROUPS } from '~/types/facility'

// subway 는 지역×카테고리 페이지(/[city]/[district]/subway)가 없어 해당 URL 은 404 다.
// 따라서 지역 스코프 링크에서는 제외하되, 전역 네비게이션(CATEGORY_GROUPS)에는 남겨
// 허브 /subway 로의 진입 경로는 유지해야 한다.
describe('NON_REGION_CATEGORIES', () => {
  it('subway 를 포함한다 (지역 링크 제외 대상)', () => {
    expect(NON_REGION_CATEGORIES).toContain('subway')
  })

  it('전역 카테고리 그룹(CATEGORY_GROUPS)에는 subway 가 남아있다 (헤더 nav·허브 진입 유지)', () => {
    const allGrouped = CATEGORY_GROUPS.flatMap((g) => g.categories)
    expect(allGrouped).toContain('subway')
  })

  it('지역 페이지가 있는 일반 카테고리는 제외 대상이 아니다', () => {
    for (const c of ['toilet', 'parking', 'hospital', 'pharmacy']) {
      expect(NON_REGION_CATEGORIES).not.toContain(c)
    }
  })
})
