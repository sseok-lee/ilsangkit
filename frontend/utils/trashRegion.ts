import { CITY_NAME_TO_SLUG, generateSlug } from '~/composables/useRegions'
import { CITY_FULL_NAME_TO_SLUG } from '~/shared/regionSlugs'

/**
 * 쓰레기 배출 개별 레코드(한글 시/구명)를 구·군 단위 집계 페이지 경로로 변환한다.
 * 정식 풀네임(충청북도 등)은 CITY_FULL_NAME_TO_SLUG로, 단축형은 CITY_NAME_TO_SLUG로,
 * 그 외는 접미사 제거 후 단축형으로 폴백. citySlug 미해결 시 null.
 */
export function buildTrashRegionPath(city: string, district: string): string | null {
  const shortCity = city.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
  const citySlug = CITY_FULL_NAME_TO_SLUG[city] || CITY_NAME_TO_SLUG[city] || CITY_NAME_TO_SLUG[shortCity]
  if (!citySlug) return null
  return `/${citySlug}/${generateSlug(district)}/trash`
}
