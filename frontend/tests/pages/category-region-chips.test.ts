import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { buildListFetch } from '~/utils/regionChips'

// 시설 목록 페이지(pages/[category]/index.vue)는 `useRoute`/`useRouter` 를 vue-router 패키지에서
// 직접 import 하고(Nuxt 전역 auto-import 우회) 최상위에 `await useAsyncData(...)`(async setup) 를
// 갖고 있어, <Suspense> 없이 mount() 하면 router 주입 경고와 함께 setup 이 끝까지 실행되지
// 않는다(사전 확인됨 — 페이지를 손대지 않은 상태에서도 재현). 그래서 SSR city 필터 결정 로직을
// buildListFetch 순수 함수로 추출해 여기서 직접 단위 테스트하고, 셀렉트 제거/RegionChips 렌더는
// (기존 tests/pages/trash-list-modal.test.ts 와 동일한 패턴으로) 소스 텍스트 검사로 회귀를 잡는다.

describe('buildListFetch — SSR city 필터', () => {
  it('city slug 를 한글 city명으로 변환해 시설 검색 API body 에 반영한다', () => {
    const { url, options } = buildListFetch('toilet', 'seoul', 1)
    expect(url).toBe('/api/facilities/search')
    expect(options.method).toBe('POST')
    expect((options.body as { city?: string }).city).toBe('서울')
    expect((options.body as { category?: string; page?: number; limit?: number }).category).toBe('toilet')
    expect((options.body as { page?: number }).page).toBe(1)
  })

  it('city slug 가 없으면(전국) city 파라미터를 넣지 않는다', () => {
    const { options } = buildListFetch('toilet', '', 1)
    expect((options.body as { city?: string }).city).toBeUndefined()
  })

  it('잘못된 slug 는 fail-open 으로 city 없이 전국 조회한다', () => {
    const { options } = buildListFetch('toilet', 'bogus', 1)
    expect((options.body as { city?: string }).city).toBeUndefined()
  })

  it('trash 카테고리는 waste-schedules 엔드포인트에 city/page 를 params 로 반영한다', () => {
    const { url, options } = buildListFetch('trash', 'busan', 2)
    expect(url).toBe('/api/waste-schedules')
    expect((options.params as { city?: string }).city).toBe('부산')
    expect((options.params as { page?: number }).page).toBe(2)
  })
})

describe('시설 목록 페이지 — 셀렉트 제거 + RegionChips 렌더 (source 검사)', () => {
  const frontendRoot = process.cwd().endsWith('/frontend')
    ? process.cwd()
    : join(process.cwd(), 'frontend')
  const source = readFileSync(resolve(frontendRoot, 'pages/[category]/index.vue'), 'utf8')

  it('시/도·구/군 select 가 제거되었다', () => {
    expect(source).not.toContain('<select')
  })

  it('RegionChips 로 대체되고 활성 slug 를 넘긴다', () => {
    expect(source).toContain('<RegionChips')
    expect(source).toContain(':active-slug="queryCitySlug"')
  })

  it('useAsyncData 가 buildListFetch 를 사용해 SSR 시점에 city/keyword 를 반영한다', () => {
    expect(source).toContain('buildListFetch(categoryParam.value, queryCitySlug.value, initialPage, initialKeyword || undefined)')
  })

  it('"인기 지역" 링크 블록은 유지된다', () => {
    expect(source).toContain('popularRegionLinks')
  })

  it('인-페이지 키워드 인풋을 신설하지 않는다(헤더가 검색 진입로 전담)', () => {
    expect(source).not.toMatch(/<input[^>]*v-model(?:\.trim)?="(searchKeyword|keywordInput|localKeyword)"/)
  })

  it('shouldNoindexFacilityList 로 keyword 유무를 robots 분기에 반영한다', () => {
    expect(source).toContain("import { shouldNoindexFacilityList } from '~/utils/facilityListRobots'")
    expect(source).toContain('shouldNoindexFacilityList({ page: pageQueryParam.value, keyword: queryKeyword.value })')
  })

  it('RegionChips 클릭 시 현재 keyword 를 유지한다(사용자 결정 ②)', () => {
    expect(source).toContain('regionChipHref')
    expect(source).toContain('encodeURIComponent(queryKeyword.value)')
  })
})
