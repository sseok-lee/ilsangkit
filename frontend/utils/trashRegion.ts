import { CITY_NAME_TO_SLUG, generateSlug } from '~/composables/useRegions'

/**
 * 쓰레기 배출 개별 레코드(한글 시/구명)를 구·군 단위 집계 페이지 경로로 변환한다.
 * 기존 trash 상세의 지역 링크와 동일한 슬러그 규칙. citySlug 미해결 시 null.
 */
export function buildTrashRegionPath(city: string, district: string): string | null {
  const shortCity = city.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
  const citySlug = CITY_NAME_TO_SLUG[city] || CITY_NAME_TO_SLUG[shortCity]
  if (!citySlug) return null
  return `/${citySlug}/${generateSlug(district)}/trash`
}
