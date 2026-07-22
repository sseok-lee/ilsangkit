import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { buildFacilitySearchLog } from '~/utils/searchLog'

// [category]/index.vue 는 vue-router 직접 import + 최상위 async setup(useAsyncData) 을 갖고 있어
// <Suspense> 없이 mount() 하면 setup 이 끝까지 실행되지 않는다(category-region-chips.test.ts 에서
// 이미 확인됨). 그래서 로깅 payload 조립은 buildFacilitySearchLog 순수 함수로 추출해 여기서
// 단위 테스트하고, 페이지가 그 결과를 logSearch 에 그대로 넘기는지는(중복 로깅/트리거 시점 포함)
// 소스텍스트 검사로 회귀를 잡는다(동일 파일의 기존 패턴).

describe('buildFacilitySearchLog — 시설 카테고리 검색 로깅 payload', () => {
  it('keyword/resultCount/category/city 를 SearchLog 스키마로 조립한다', () => {
    const payload = buildFacilitySearchLog({
      keyword: '역삼',
      resultCount: 12,
      cityName: '서울',
      category: 'toilet',
    })
    expect(payload).toEqual({ keyword: '역삼', resultCount: 12, category: 'toilet', city: '서울' })
  })

  it('cityName 이 없으면(전국 검색) city 를 undefined 로 둔다', () => {
    const payload = buildFacilitySearchLog({ keyword: '역삼', resultCount: 3, category: 'toilet' })
    expect(payload.city).toBeUndefined()
  })

  it('resultCount 가 falsy(0) 여도 그대로 0 을 유지한다(누락 아님)', () => {
    const payload = buildFacilitySearchLog({ keyword: '없는검색어', resultCount: 0, category: 'pharmacy' })
    expect(payload.resultCount).toBe(0)
  })

  it('trash 등 임의 category 문자열도 그대로 전달한다', () => {
    const payload = buildFacilitySearchLog({ keyword: '역삼', resultCount: 5, category: 'trash' })
    expect(payload.category).toBe('trash')
  })
})

describe('시설 카테고리 페이지 — keyword 검색 결과 확정 시 logSearch 호출 (source 검사)', () => {
  const frontendRoot = process.cwd().endsWith('/frontend')
    ? process.cwd()
    : join(process.cwd(), 'frontend')
  const source = readFileSync(resolve(frontendRoot, 'pages/[category]/index.vue'), 'utf8')

  it('useSearchSuggest().logSearch 를 재사용한다(중복 API 신설 금지)', () => {
    expect(source).toContain("import { useSearchSuggest } from '~/composables/useSearchSuggest'")
    expect(source).toContain('const { logSearch } = useSearchSuggest()')
    expect(source).toContain("import { buildFacilitySearchLog } from '~/utils/searchLog'")
  })

  it('non-trash: loading true→false 전이(검색 완료) 시점에만 로깅하고 trash 는 제외한다', () => {
    expect(source).toContain('watch(loading, (now, prev) => {')
    expect(source).toContain("if (prev && !now && queryKeyword.value && categoryParam.value !== 'trash') {")
  })

  it('trash: loadWasteSchedules 완료 시점(결과 확정)에 category=\'trash\' 로 로깅한다', () => {
    expect(source).toContain("category: 'trash',")
  })

  it('헤더 검색이 직접 진입시키는 SSR/CSR 최초 도착(useAsyncData 로 이미 결과 보유) 시에도 로깅한다', () => {
    // performSearch()/loadWasteSchedules() 를 타지 않는 케이스이므로 onMounted 의 별도 분기가 필요.
    expect(source).toMatch(/else if \(queryKeyword\.value\) \{[\s\S]*?logSearch\(buildFacilitySearchLog\(/)
  })

  it('매 키 입력마다가 아니라 buildFacilitySearchLog 호출은 항상 queryKeyword.value 가드를 동반한다', () => {
    const callSites = source.split('logSearch(buildFacilitySearchLog(').length - 1
    const guardedSites = (source.match(/queryKeyword\.value/g) || []).length
    expect(callSites).toBeGreaterThanOrEqual(3) // onMounted 초기 도착 + watch(loading) + loadWasteSchedules
    expect(guardedSites).toBeGreaterThan(callSites) // 각 호출 지점이 queryKeyword 가드로 감싸여 있음
  })
})
