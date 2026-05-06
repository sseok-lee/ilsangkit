// 사이트맵 정책 — index와 동적 chunk handler가 공유하는 단일 소스.
// "인덱스에 올리는 카테고리"와 "카테고리별 URL 상한"을 한 곳에서 결정해서
// index가 광고하는 청크 수와 실제 /sitemap/{slug}-{n}.xml 응답이 달라지는 것을 막는다.
//
// 2026-05 초기 색인 안정화 정책:
// - 대형/저품질 우려 카테고리는 임시로 sitemap 노출을 제한한다.
// - wifi는 중복·저가치 URL 방지를 위해 sitemap에서 제외하고 HTML noindex로 처리한다.
//   robots.txt로 차단하면 Googlebot이 noindex를 볼 수 없어 Search Console 노이즈가 생긴다.
// - AED는 응급 검색 의도가 강해 초기 제한 중에도 sitemap 색인 대상에 포함한다.
// - Search Console에서 주요 카테고리 색인 안정화 후 wifi 포함, 상세 noindex 해제,
//   URL 상한 완화/제거, 테스트/검증 스크립트 기대값 갱신을 같은 배포에서 처리한다.

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

// 초기 색인 안정화와 크롤 예산 절감을 위한 카테고리별 URL 상한.
// 여기 키에 해당하는 카테고리는 index와 chunk handler 모두 동일한 limit 으로 데이터를 조회한다.
// 영구 정책이 아니므로 제한 해제 시 이 객체와 관련 sitemap 테스트/검증 스크립트를 함께 수정한다.
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
