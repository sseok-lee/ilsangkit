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

// ─────────────────────────────────────────────────────────────────────────────
// <loc> 품질 게이트
//
// 사이트맵에는 "200 · 색인가능 · 자기참조 canonical · 비리다이렉트 · 실콘텐츠" URL 만
// 들어가야 한다. 2026-09-04 네이버 서치어드바이저 실측: 리다이렉트 3,193 · 접근불가(4xx/410)
// 523 · soft-404 25 가 전부 우리가 직접 제출한 사이트맵에서 출발했다. 같은 기간 일 수집량은
// 33,000 → 3,000 으로 무너졌다 — 낭비 크롤 한 건도 감당할 수 없는 상태다.
//
// 여기서 거르는 건 "URL 문자열만 보고 규칙으로 판정되는" 클래스뿐이다. URL 별 색인가능성
// 조회(백엔드 왕복)는 하지 않는다 — 66만 URL × 1 쿼리는 사이트맵 생성 자체를 죽인다.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * utils/sitemap.ts 의 SITE_URL 과 반드시 같아야 한다.
 * 여기서 다시 선언하는 이유는 순환 import 회피 — sitemap.ts 가 이 모듈을 import 한다.
 * 두 값의 일치는 테스트(sitemap-quality-gate.test.ts)가 강제한다.
 */
export const SITEMAP_LOC_ORIGIN = 'https://ilsangkit.co.kr'

export type SitemapLocRejectReason =
  /** 우리 origin 의 절대 URL 이 아님 */
  | 'origin'
  /** `?schedule=` `?page=` `?usage=` `?city=` — 쿼리 URL 은 canonical 이 아니거나 noindex 다 */
  | 'query'
  /** fragment 는 크롤러에게 무의미하고 중복만 만든다 */
  | 'fragment'
  /** redirects.ts 가 301 하는 후행 슬래시 */
  | 'trailing-slash'
  /** `/gyeonggi//trash` — trashDistrictSlug 가 '' 를 돌려준 자리. 매칭되는 라우트가 없어 404 */
  | 'empty-segment'
  /** toCitySlug/toDistrictSlug 가 slug 맵을 못 찾아 한글 원문을 그대로 흘린 자리 */
  | 'non-ascii'
  /** 공백 등 percent-encoding 되지 않은 문자 */
  | 'unsafe-char'
  /** `/og` `/og-map` — 프로덕션에서 302(sharp 부재)라 리다이렉트 카운트의 원천 */
  | 'og-endpoint'
  /** REGION_REORG_301 이 jeonnamgwangju 로 301 하는 옛 slug */
  | 'legacy-city-slug'

/**
 * 2026-07-01 전남광주통합특별시 출범으로 폐지된 옛 city slug.
 * deploy.yml 이 `REGION_REORG_301=1` 을 내보내므로 프로덕션에서 두 slug 는 301 이다
 * (server/middleware/redirects.ts 의 resolveRegionReorgRedirect,
 *  server/middleware/real-estate-redirect.ts 의 resolveRegionReorgCityRedirect).
 * 플래그가 꺼져 있더라도 jeonnamgwangju URL 과 같은 행을 보여주는 중복이라 사이트맵에는 부적격.
 */
const LEGACY_JNGJ_CITY_SLUGS = new Set(['gwangju', 'jeonnam'])

/** 프로덕션에서 /og-image.png 로 302 하는 OG 이미지 엔드포인트 */
const OG_ENDPOINT_SEGMENTS = new Set(['og', 'og-map'])

/** RFC 3986 pchar + '/'. encodeURIComponent 출력(%XX, 영숫자, -._~!'()*)은 전부 통과한다. */
const SAFE_PATH_RE = /^[A-Za-z0-9\-._~%!$&'()*+,;=:@/]+$/

/**
 * `<loc>` 로 내보내면 안 되는 URL 이면 사유를, 문제없으면 null 을 반환한다.
 * 순수 함수 — 네트워크·DB 접근 없음.
 */
export function rejectSitemapLoc(loc: string): SitemapLocRejectReason | null {
  if (loc !== SITEMAP_LOC_ORIGIN && !loc.startsWith(`${SITEMAP_LOC_ORIGIN}/`)) return 'origin'

  const rest = loc.slice(SITEMAP_LOC_ORIGIN.length)
  // 쿼리·fragment 는 origin 뒤 전 구간에서 본다 — 경로 중간에 섞여 들어와도 잡아야 한다.
  if (rest.includes('#')) return 'fragment'
  if (rest.includes('?')) return 'query'
  // 홈은 슬래시 유무 둘 다 200 이다 — redirects.ts 의 후행 슬래시 301 도 `path !== '/'` 로 제외한다.
  if (rest === '' || rest === '/') return null

  if (rest.endsWith('/')) return 'trailing-slash'
  // 사이트맵 스펙은 <loc> 을 percent-encoding 된 ASCII 로 요구한다. toCitySlug/toDistrictSlug 는
  // slug 맵 미스 시 한글 원문을 lowercase 해서 그대로 흘리는데, 그 URL 은 스펙 위반이면서
  // 매칭되는 라우트도 없어 404 다.
  if (/[^\x20-\x7E]/.test(rest)) return 'non-ascii'
  if (!SAFE_PATH_RE.test(rest)) return 'unsafe-char'

  const segments = rest.split('/').slice(1)
  if (segments.some((s) => s === '')) return 'empty-segment'

  if (OG_ENDPOINT_SEGMENTS.has(segments[0])) return 'og-endpoint'

  // 지역 형태 `/{city}/...` 와 부동산 형태 `/real-estate/{type|land}/{city}/...` 의 city 자리.
  if (LEGACY_JNGJ_CITY_SLUGS.has(segments[0])) return 'legacy-city-slug'
  if (segments[0] === 'real-estate' && LEGACY_JNGJ_CITY_SLUGS.has(segments[2] ?? '')) {
    return 'legacy-city-slug'
  }

  return null
}
