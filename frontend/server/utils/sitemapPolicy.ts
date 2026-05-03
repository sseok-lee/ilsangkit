// 사이트맵 정책 — index와 동적 chunk handler가 공유하는 단일 소스.
// "인덱스에 올리는 카테고리"와 "카테고리별 URL 상한"을 한 곳에서 결정해서
// index가 광고하는 청크 수와 실제 /sitemap/{slug}-{n}.xml 응답이 달라지는 것을 막는다.

export const SITEMAP_FACILITY_CATEGORIES = [
  'toilet',
  'clothes',
  'parking',
  'library',
  'hospital',
  'pharmacy',
  'park',
  'school',
  'market',
  'childcare',
  'ev-charger',
  'sports',
  'aed',
] as const

export type SitemapFacilityCategory = (typeof SITEMAP_FACILITY_CATEGORIES)[number]

// 크롤 예산 절감을 위한 카테고리별 URL 상한. 여기 키에 해당하는 카테고리는
// index와 chunk handler 모두 동일한 limit 으로 데이터를 조회한다.
export const SITEMAP_FACILITY_CATEGORY_LIMITS: Partial<Record<SitemapFacilityCategory, number>> = {
  'ev-charger': 20000,
  childcare: 15000,
  aed: 15000,
  sports: 10000,
  clothes: 10000,
}

export function isSitemapFacilityCategory(category: string): category is SitemapFacilityCategory {
  return (SITEMAP_FACILITY_CATEGORIES as readonly string[]).includes(category)
}

export function getSitemapFacilityLimit(category: string): number | undefined {
  if (!isSitemapFacilityCategory(category)) return undefined
  return SITEMAP_FACILITY_CATEGORY_LIMITS[category]
}
