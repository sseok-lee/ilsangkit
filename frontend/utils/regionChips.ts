import { CITY_SLUG_MAP } from '~/shared/regionSlugs'
import { normalizeWasteAreaCity } from '~/utils/wasteAreaQuery'
import { toCitySlugByDistrict } from '~/utils/realEstateUrl'

export interface SidoChip {
  slug: string
  label: string
}

/**
 * 목록 페이지 지역 칩용 시/도 목록(광역 16). 레거시 gwangju/jeonnam 은 제외하고
 * 전남광주통합특별시(jeonnamgwangju)를 포함한다. Object.keys(REGIONS)를 쓰면
 * 레거시 광주/전남이 섞이므로 명시적 상수로 둔다.
 */
export const SIDO_CHIPS: SidoChip[] = [
  { slug: 'seoul', label: '서울' },
  { slug: 'busan', label: '부산' },
  { slug: 'daegu', label: '대구' },
  { slug: 'incheon', label: '인천' },
  { slug: 'daejeon', label: '대전' },
  { slug: 'ulsan', label: '울산' },
  { slug: 'sejong', label: '세종' },
  { slug: 'gyeonggi', label: '경기' },
  { slug: 'gangwon', label: '강원' },
  { slug: 'chungbuk', label: '충북' },
  { slug: 'chungnam', label: '충남' },
  { slug: 'jeonbuk', label: '전북' },
  { slug: 'gyeongbuk', label: '경북' },
  { slug: 'gyeongnam', label: '경남' },
  { slug: 'jeju', label: '제주' },
  { slug: 'jeonnamgwangju', label: '전남·광주' },
]

/**
 * 시·도 대표 좌표(시·도청 소재지 근처). 지도 시·도 칩이 전국 집계에서 좌표를 못 찾을 때
 * (그 유형에 최근 거래가 없는 시·도, 집계 일시 실패) 쓰는 폴백이다 — 없으면 '이 지역 목록'은
 * 그 시·도를 가리키는데 지도는 제자리에서 확대만 돼 둘이 어긋난다.
 */
export const SIDO_CENTERS: Record<string, { lat: number; lng: number }> = {
  seoul: { lat: 37.5665, lng: 126.978 },
  busan: { lat: 35.1796, lng: 129.0756 },
  daegu: { lat: 35.8714, lng: 128.6014 },
  incheon: { lat: 37.4563, lng: 126.7052 },
  daejeon: { lat: 36.3504, lng: 127.3845 },
  ulsan: { lat: 35.5384, lng: 129.3114 },
  sejong: { lat: 36.48, lng: 127.289 },
  gyeonggi: { lat: 37.275, lng: 127.0095 },
  gangwon: { lat: 37.8813, lng: 127.7298 },
  chungbuk: { lat: 36.6357, lng: 127.4917 },
  chungnam: { lat: 36.6588, lng: 126.6728 },
  jeonbuk: { lat: 35.8242, lng: 127.148 },
  gyeongbuk: { lat: 36.576, lng: 128.5056 },
  gyeongnam: { lat: 35.2383, lng: 128.6925 },
  jeju: { lat: 33.4996, lng: 126.5312 },
  jeonnamgwangju: { lat: 35.1595, lng: 126.8526 },
}

/**
 * 시·도 표시 이름. 지도 API 의 name 은 DB city 원값이라 대부분 축약형('서울')이지만 통합시는
 * 풀네임('전남광주통합특별시')이고, 다른 경로에서는 '서울특별시'·'경기도' 같은 정식명도 온다.
 * slug 로 정규화한 뒤 칩 라벨('서울', '전남·광주')로 맞춘다 — 지도 핀·위치 경로가 목록과 같은
 * 이름을 쓰게. 칩에 없는 값(레거시 광주/전남 등)은 받은 그대로 둔다.
 */
export function cityDisplayName(name: string): string {
  const slug = toCitySlugByDistrict(name, '')
  return SIDO_CHIPS.find((c) => c.slug === slug || c.label === name)?.label ?? name
}

/**
 * 지역 칩 slug → 시설 검색 API 용 한글 city명.
 * 매칭 실패(잘못된 slug/빈값)면 undefined 를 반환해 호출부가 city 없이 전국을 조회하도록 한다(fail-open).
 */
export function resolveCityParam(slug: string | undefined): string | undefined {
  if (!slug) return undefined
  return CITY_SLUG_MAP[slug] || undefined
}

export interface ListFetchRequest {
  url: string
  options: { method?: 'POST'; params?: Record<string, unknown>; body?: Record<string, unknown> }
}

/**
 * 시설 목록/배출 일정 목록 페이지의 SSR 데이터 로더가 실제로 호출할 `{ url, options }` 를
 * 순수 함수로 계산한다. `pages/[category]/index.vue` 의 `useAsyncData` 핸들러가 그대로 사용하며,
 * 페이지 컴포넌트를 mount 하지 않고도(라우터 주입·Suspense 문제 없이) city 필터 로직을
 * 단위 테스트할 수 있게 분리한 것이 유일한 목적이다.
 * citySlug 가 없거나 잘못된 slug 면(fail-open) city 파라미터 없이 전국을 조회한다.
 * keyword 는 헤더 검색(Task 2: `/{category}?keyword=`)이 넘겨주는 검색어 — 선택 인자라
 * 기존 3-인자 호출부와 하위 호환된다. 앞뒤 공백은 trim, 빈 문자열이면 파라미터 자체를 생략한다.
 */
export function buildListFetch(category: string, citySlug: string | undefined, page: number, keyword?: string): ListFetchRequest {
  const cityKorean = resolveCityParam(citySlug)
  const kw = keyword?.trim()
  if (category === 'trash') {
    const config = useRuntimeConfig()
    if (config.public.wasteAreaDiscoveryEnabled === true) {
      return {
        url: '/api/waste-areas',
        options: {
          params: {
            page,
            limit: 20,
            ...(cityKorean ? { city: normalizeWasteAreaCity(cityKorean) } : {}),
            ...(kw ? { keyword: kw } : {}),
          },
        },
      }
    }
    return {
      url: '/api/waste-schedules',
      options: { params: { page, limit: 20, ...(cityKorean ? { city: cityKorean } : {}), ...(kw ? { keyword: kw } : {}) } },
    }
  }
  return {
    url: '/api/facilities/search',
    options: { method: 'POST', body: { category, page, limit: 20, ...(cityKorean ? { city: cityKorean } : {}), ...(kw ? { keyword: kw } : {}) } },
  }
}
