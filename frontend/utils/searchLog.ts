export interface FacilitySearchLogInput {
  keyword: string
  resultCount: number
  cityName?: string
  category: string
}

export interface FacilitySearchLogPayload {
  keyword: string
  resultCount: number
  category: string
  city?: string
}

/**
 * 시설 카테고리(`[category]/index.vue`) keyword 검색 결과를 `useSearchSuggest().logSearch`
 * 페이로드로 변환하는 순수 함수. 검색 로깅이 `/search`(부동산) 한 곳에만 치우치던 편향을
 * 해소하기 위해(§3 D6) 시설 카테고리 keyword 검색도 동일한 SearchLog 스키마(keyword/resultCount/
 * category/city)로 기록한다. resultCount 는 음수/NaN 방지를 위해 `|| 0` 로 보정한다.
 */
export function buildFacilitySearchLog({
  keyword,
  resultCount,
  cityName,
  category,
}: FacilitySearchLogInput): FacilitySearchLogPayload {
  return {
    keyword,
    resultCount: resultCount || 0,
    category,
    city: cityName || undefined,
  }
}
