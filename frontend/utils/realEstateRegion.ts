/**
 * 부동산 건물 상세의 "요청 지역 ≠ 실제 지역" 판정과 통합 대상 URL 계산.
 *
 * ## 배경 — 중복 title 22.5만 건의 기계적 원인
 *
 * `/real-estate/{type}/{citySlug}/{districtSlug}/{건물명}` 에서 city/district 는 사실상
 * 검증되지 않는다. `DISTRICT_SLUG_MAP` 이 전국 구·군 이름으로 평평하게 키를 잡고 있어
 * `seoul/chuncheon` 도, `busan/gangnam` 도 slug 검증을 통과한다
 * (pages/.../[buildingName].vue 의 city·district 검증은 서로를 보지 않는다).
 *
 * 그 위에서 백엔드 `getBuildingInfo` 는 bjdCode 를 "힌트"로만 쓴다. 요청 지역에 그 이름의
 * 건물이 없으면 이름만으로 **전국에서 거래가 가장 많은** bjdCode 를 다시 고른다
 * (backend/src/services/realEstateService.ts). 원래는 stale summary 로 bjdCode 가 어긋났을 때
 * 상세가 비어 false noindex 가 되는 걸 막으려는 장치였는데, 지역 경계를 넘어서까지 회수한다.
 *
 * 결과를 프로덕션에서 실측했다(2026-09-04):
 *
 *     /real-estate/villa-sale/seoul/gangnam/현대   → 200, index, "현대 빌라 매매 실거래가·시세 | 제주 서귀포시"
 *     /real-estate/villa-sale/busan/haeundae/현대  → 200, index, "현대 빌라 매매 실거래가·시세 | 제주 서귀포시"
 *     /real-estate/villa-sale/daegu/suseong/현대   → 200, index, "현대 빌라 매매 실거래가·시세 | 제주 서귀포시"
 *
 * 세 URL 모두 self-canonical 이다. 즉 흔한 건물명 하나가 (구·군 250개 × 타입 6개) 만큼의
 * 완전 동일 문서를 발행한다. 네이버는 canonical 이 아니라 크롤한 문서 단위로 중복을 세므로
 * 이 구조가 그대로 중복 title/description 지표가 된다.
 *
 * ## 처방 — 404 가 아니라 301
 *
 * 이미 색인된 URL 을 대량으로 404 로 전환하지 않는다. 대신 **실제 지역의 URL 로 301** 해서
 * 같은 검색 의도의 문서들을 하나로 합친다. 도착지는 정상 200·indexable 문서다.
 *
 * 리다이렉트 루프 방지: 목적지 경로가 현재 경로와 같으면 리다이렉트하지 않고, slug 로
 * 되돌릴 수 없는 지역명(매핑에 없는 값)이면 리다이렉트 대신 noindex 로 떨어진다.
 * 후자는 `toCitySlug`/`toDistrictSlug` 가 매핑 실패 시 한글을 그대로 소문자화해 돌려주기
 * 때문이다 — 그대로 301 하면 어느 라우트에도 맞지 않는 URL 로 보내게 된다.
 */
import { CITY_SLUG_MAP, CITY_FULL_NAME_TO_SLUG, CITY_SLUGS, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { toRealEstateUrl, type RealEstateUrlType } from './realEstateUrl'

/** 시/도 문자열(풀네임·축약형 모두)을 slug 로. 매핑에 없으면 null. */
export function resolveCitySlugStrict(city: string | null | undefined): string | null {
  if (!city) return null
  const trimmed = city.trim()
  return CITY_FULL_NAME_TO_SLUG[trimmed] ?? CITY_SLUGS[trimmed] ?? null
}

/** 구·군 문자열을 slug 로. 매핑에 없으면 null. */
export function resolveDistrictSlugStrict(district: string | null | undefined): string | null {
  if (!district) return null
  return DISTRICT_SLUG_MAP[district.trim()] ?? null
}

/**
 * 서버 미들웨어가 스스로 다시 301 하는 목적지 — 여기로 리다이렉트하면 무한 루프가 된다.
 *
 * 두 개의 행정구역 개편 301 이 살아 있다.
 *  1. `REGION_REORG_301=1` : `/real-estate/{type}/{gwangju|jeonnam}/…`
 *     → `/real-estate/{type}/jeonnamgwangju/…` (server/middleware/real-estate-redirect.ts
 *       resolveRegionReorgCityRedirect). 이건 slug 만 바꾸면 되므로 아래에서 정규화로 흡수한다.
 *  2. `INCHEON_REORG_301=1` : `/real-estate/{type}/incheon/{seo|jung|dong}/…`
 *     → 신설구 URL (같은 파일 resolveIncheonReorgRedirect). 이건 1:N 분리라 목적지를 정하려면
 *       국토부 현행 귀속 조회가 필요하다 — 클라이언트에서 계산할 수 없다.
 *
 * 그래서 (1)은 정규화하고 (2)는 "리다이렉트하지 않는다"로 처리한다. 리다이렉트를 포기한
 * 문서는 호출부의 noindex 경로가 받는다 — 잘못된 곳으로 보내거나 루프를 만드는 것보다 낫다.
 *
 * 실측 시점(2026-09-04) 로컬 DB 에는 legacy 광주/전남 행이 0건이고 인천도 신설구만 남아 있어
 * 지금 당장 발동하지는 않는다. 그래도 두는 이유는 결과가 무한 리다이렉트라서다 — sync 가
 * 원본 표기를 되돌리면(경계월 재유입 전례 있음) 즉시 라이브 장애가 된다.
 */
const LEGACY_JNGJ_CITY_SLUGS = new Set(['gwangju', 'jeonnam'])
const MERGED_JNGJ_CITY_SLUG = 'jeonnamgwangju'
const INCHEON_DISSOLVED_DISTRICT_SLUGS = new Set(['seo', 'jung', 'dong'])

/**
 * 지역 일치 비교용 city slug 정규화.
 *
 * DB 가 아직 '광주광역시'/'전라남도' 로 적힌 행을 들고 있어도, 통합 후 정규 URL 은
 * `jeonnamgwangju` 다. 정규화하지 않으면 정상 URL(`/jeonnamgwangju/…`)이 "지역 불일치"로
 * 판정돼 legacy slug 로 301 되고, 그 목적지를 미들웨어가 다시 301 해서 루프가 된다.
 */
function normalizeCitySlugForRegionMatch(slug: string): string {
  return LEGACY_JNGJ_CITY_SLUGS.has(slug) ? MERGED_JNGJ_CITY_SLUG : slug
}

/** 목적지가 서버 미들웨어의 301 대상이면 true — 그 경로로는 보내지 않는다. */
function isServerRedirectedTarget(citySlug: string, districtSlug: string): boolean {
  if (LEGACY_JNGJ_CITY_SLUGS.has(citySlug)) return true
  if (citySlug === 'incheon' && INCHEON_DISSOLVED_DISTRICT_SLUGS.has(districtSlug)) return true
  return false
}

export interface RegionMismatchInput {
  /** URL 의 city slug */
  requestedCitySlug: string
  /** URL 의 district slug */
  requestedDistrictSlug: string
  /** 백엔드가 실제로 찾아준 건물의 시/도 (DB 값, 풀네임일 수 있음) */
  actualCity: string | null | undefined
  /** 백엔드가 실제로 찾아준 건물의 구·군 */
  actualDistrict: string | null | undefined
}

/**
 * 요청 URL 의 지역과 실제 건물의 지역이 다른가.
 *
 * 실제 지역을 slug 로 되돌릴 수 없으면 "다르다고 단정하지 않는다"(false) — 판정 근거가
 * 없는 상태에서 301 을 만들지 않기 위해서다. 그 경우는 호출부의 noindex 경로가 받는다.
 */
export function isRegionMismatch(input: RegionMismatchInput): boolean {
  const actualCitySlug = resolveCitySlugStrict(input.actualCity)
  const actualDistrictSlug = resolveDistrictSlugStrict(input.actualDistrict)
  if (!actualCitySlug || !actualDistrictSlug) return false
  return (
    normalizeCitySlugForRegionMatch(actualCitySlug)
      !== normalizeCitySlugForRegionMatch(input.requestedCitySlug)
    || actualDistrictSlug !== input.requestedDistrictSlug
  )
}

export interface CanonicalRealEstatePathInput {
  type: RealEstateUrlType
  buildingName: string
  actualCity: string | null | undefined
  actualDistrict: string | null | undefined
}

/**
 * 실제 지역 기준의 정규 URL 경로. slug 로 되돌릴 수 없으면 null(→ 301 하지 않는다).
 *
 * 반환값은 `toRealEstateUrl` 이 만든 경로 그대로여서, 도착 페이지가 같은 함수로 계산하는
 * canonical 과 문자열까지 일치한다.
 */
export function buildCanonicalRealEstatePath(input: CanonicalRealEstatePathInput): string | null {
  const citySlug = resolveCitySlugStrict(input.actualCity)
  const districtSlug = resolveDistrictSlugStrict(input.actualDistrict)
  if (!citySlug || !districtSlug) return null

  const cityName = CITY_SLUG_MAP[citySlug]
  if (!cityName) return null

  return toRealEstateUrl({
    type: input.type,
    city: cityName,
    district: input.actualDistrict!.trim(),
    buildingName: input.buildingName,
  })
}

export interface RegionRedirectInput extends CanonicalRealEstatePathInput {
  requestedCitySlug: string
  requestedDistrictSlug: string
  /** 현재 요청 경로(쿼리 제외). 목적지와 같으면 리다이렉트하지 않는다. */
  currentPath: string
}

/**
 * 지역 불일치 문서를 합칠 301 목적지. 리다이렉트가 필요 없거나 안전하지 않으면 null.
 *
 * null 을 돌려주는 경우는 셋이다.
 * 1. 지역이 일치한다(정상 문서).
 * 2. 실제 지역을 slug 로 되돌릴 수 없다(잘못된 목적지로 보낼 위험).
 * 3. 계산된 목적지가 현재 경로와 같다(루프 방지).
 */
export function resolveRegionRedirectPath(input: RegionRedirectInput): string | null {
  if (!isRegionMismatch(input)) return null

  const target = buildCanonicalRealEstatePath(input)
  if (!target) return null
  if (target === input.currentPath) return null

  // 목적지가 미들웨어의 301 대상이면 보내지 않는다 — 위 LEGACY_JNGJ_CITY_SLUGS 주석 참조.
  const [, , , targetCitySlug, targetDistrictSlug] = target.split('/')
  if (isServerRedirectedTarget(targetCitySlug ?? '', targetDistrictSlug ?? '')) return null

  return target
}
