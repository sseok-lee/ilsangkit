import { CATEGORY_META, FACILITY_CATEGORIES, type FacilityCategory } from '~/types/facility'

export type SearchScope =
  | { kind: 'facility'; category: FacilityCategory; citySlug?: string }
  | { kind: 'realestate' }

// 시설 스코프로 인정하는 카테고리(15). subway 는 역(station) 그룹 단위라
// 컨텍스추얼 키워드 검색 대상이 아니다(스펙 §8) → realestate 기본으로 떨어뜨린다.
const FACILITY_SCOPE_CATEGORIES: ReadonlySet<string> = new Set(
  FACILITY_CATEGORIES.filter((c) => c !== 'subway'),
)

interface RouteLike {
  path?: string
  params?: Record<string, unknown>
  query?: Record<string, unknown>
}

function contextCitySlug(route: RouteLike): string | undefined {
  const p = route?.params?.city
  if (typeof p === 'string' && p) return p
  const q = route?.query?.city
  if (typeof q === 'string' && q) return q
  return undefined
}

/**
 * 라우트 컨텍스트로 검색 스코프를 판별하는 순수 함수(라우터/DB/Vue 비의존).
 * 1) params.category 가 15개 시설 카테고리 중 하나 → facility (/[category], /[category]/[id], /[city]/[district]/[category])
 * 2) path 첫 세그먼트가 시설 카테고리 → facility (/trash/[id] 처럼 category 파라미터가 없는 전용 상세 라우트 보정)
 * 3) 그 외 → realestate (fail-safe)
 */
export function resolveSearchScope(route: RouteLike): SearchScope {
  const paramCategory = route?.params?.category
  if (typeof paramCategory === 'string' && FACILITY_SCOPE_CATEGORIES.has(paramCategory)) {
    return { kind: 'facility', category: paramCategory as FacilityCategory, citySlug: contextCitySlug(route) }
  }
  const firstSeg = (typeof route?.path === 'string' ? route.path : '').split('/').filter(Boolean)[0]
  if (firstSeg && FACILITY_SCOPE_CATEGORIES.has(firstSeg)) {
    return { kind: 'facility', category: firstSeg as FacilityCategory, citySlug: contextCitySlug(route) }
  }
  return { kind: 'realestate' }
}

/** 헤더/히어로 제출 목적지 URL. */
export function buildSearchDestination(scope: SearchScope, keyword: string): string {
  const q = encodeURIComponent(keyword.trim())
  if (scope.kind === 'facility') {
    const city = scope.citySlug ? `&city=${encodeURIComponent(scope.citySlug)}` : ''
    return `/${scope.category}?keyword=${q}${city}`
  }
  return `/search?keyword=${q}`
}

/** 자동완성 API 의 scope 파라미터 문자열. */
export function scopeSuggestParam(scope: SearchScope): string {
  return scope.kind === 'facility' ? `facility:${scope.category}` : 'realestate'
}

/** 검색 인풋 placeholder. */
export function scopePlaceholder(scope: SearchScope): string {
  if (scope.kind === 'facility') {
    return `${CATEGORY_META[scope.category]?.shortLabel ?? scope.category} 이름·지역 검색`
  }
  return '아파트·단지·지역 검색'
}
