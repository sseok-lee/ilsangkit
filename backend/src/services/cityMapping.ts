/**
 * 도시 slug ↔ 한글명 매핑 및 지역 필터 빌더
 */

export const CITY_SLUG_TO_FULL: Record<string, string> = {
  seoul: '서울특별시',
  busan: '부산광역시',
  daegu: '대구광역시',
  incheon: '인천광역시',
  gwangju: '광주광역시',
  daejeon: '대전광역시',
  ulsan: '울산광역시',
  sejong: '세종특별자치시',
  gyeonggi: '경기도',
  gangwon: '강원특별자치도',
  chungbuk: '충청북도',
  chungnam: '충청남도',
  jeonbuk: '전북특별자치도',
  jeonnam: '전라남도',
  gyeongbuk: '경상북도',
  gyeongnam: '경상남도',
  jeju: '제주특별자치도',
  // 2026-07-01 전남광주통합특별시(bjdCode 접두 '12'). flat 27 시군구 단일 slug.
  // 축약명이 없어 SHORT도 full과 동일. gwangju/jeonnam 엔트리는 유지(제거는 정규화 Phase C1 담당).
  jeonnamgwangju: '전남광주통합특별시',
};

export const CITY_SLUG_TO_SHORT: Record<string, string> = {
  seoul: '서울',
  busan: '부산',
  daegu: '대구',
  incheon: '인천',
  gwangju: '광주',
  daejeon: '대전',
  ulsan: '울산',
  sejong: '세종',
  gyeonggi: '경기',
  gangwon: '강원',
  chungbuk: '충북',
  chungnam: '충남',
  jeonbuk: '전북',
  jeonnam: '전남',
  gyeongbuk: '경북',
  gyeongnam: '경남',
  jeju: '제주',
  // 2026-07-01 전남광주통합특별시: 축약명이 없어 full과 동일 문자열을 사용.
  jeonnamgwangju: '전남광주통합특별시',
};

// 역매핑: short name(서울) → slug, full name(서울특별시) → slug
export const SHORT_TO_SLUG = Object.fromEntries(
  Object.entries(CITY_SLUG_TO_SHORT).map(([slug, name]) => [name, slug])
);

export const FULL_TO_SLUG = Object.fromEntries(
  Object.entries(CITY_SLUG_TO_FULL).map(([slug, name]) => [name, slug])
);

/**
 * 2026-07-01 전남광주통합특별시(bjdCode 접두 '12') 하위 광주 5개 자치구 코드.
 * (구) 통합시 데이터를 gwangju/jeonnam으로 split하던 집합.
 * ⚠️ 정규화 flat 전환(A5)으로 더 이상 참조하지 않음 — 상수 자체 제거는 Phase C1 담당.
 */
export const GWANGJU_GU_BJD = new Set(['12210', '12240', '12270', '12300', '12330']);

/**
 * bjdCode + city명 → 사이트 안정 citySlug + 표시 라벨(short).
 * 2026-07-01 통합: 신설명 '전남광주통합특별시'(코드12)는 flat 27 시군구 단일 slug(jeonnamgwangju).
 * 이름이 곧 slug를 결정하므로 bjdCode split(gwangju/jeonnam)은 폐지 — city명 기반으로 일원화.
 * (bjdCode는 시그니처 호환을 위해 유지하나 미참조.)
 */
export function resolveCitySlug(_bjdCode: string, city: string): { citySlug: string; cityLabel: string } {
  const slug = SHORT_TO_SLUG[city] || FULL_TO_SLUG[city] || '';
  return { citySlug: slug, cityLabel: CITY_SLUG_TO_SHORT[slug] || city };
}

/** 2026-07-01 통합 신설명. 광주/전남 질의가 정규화된 신명 데이터도 함께 매칭하도록 추가하는 변형. */
const JNGJ_MERGED_CITY = '전남광주통합특별시';

/**
 * city의 축약/정식 variant 집합을 만든다. buildRegionFilter/cityVariantList 공유 규칙.
 * 2026 통합: slug가 '광주'/'전남'이면 신설명(전남광주통합특별시)도 변형에 추가한다 —
 * 정규화가 옛명을 신명으로 수렴시키는 전환기 동안 옛/신 데이터를 모두 매칭하기 위함.
 * ⚠️ **A5~C1 전환기 한정**: district 없는 city-hub(도(道) 허브) 질의에도 통합명이 들어가
 *   광주 5구 + 전남 22시군(27개)을 함께 끌어오는 오버매칭이 발생한다. 데이터가 신명으로
 *   완전 수렴하기 전까지 감수하며, C1에서 gwangju/jeonnam 경로가 제거되면 무효화된다.
 * city가 신설명 자체('전남광주통합특별시')면 slug=jeonnamgwangju라 추가분 없이 그대로.
 */
function cityVariantSet(city: string, slug: string): Set<string> {
  const variants = new Set([city, CITY_SLUG_TO_FULL[slug], CITY_SLUG_TO_SHORT[slug]].filter(Boolean));
  if (slug === 'gwangju' || slug === 'jeonnam') {
    variants.add(JNGJ_MERGED_CITY);
  }
  return variants;
}

/**
 * city의 축약/정식 variant 목록 (raw SQL `IN (?)` 용).
 * buildRegionFilter와 동일 로직 — Prisma where가 아닌 배열 형태가 필요할 때 사용.
 */
export function cityVariantList(city?: string): string[] {
  if (!city) return [];
  const slug = SHORT_TO_SLUG[city] || FULL_TO_SLUG[city];
  if (!slug) return [city];
  return [...cityVariantSet(city, slug)] as string[];
}

/**
 * 지역 필터 조건 생성
 */
export function buildRegionFilter(city?: string, district?: string): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (city) {
    // city variants: short(서울) ↔ full(서울특별시) 모두 매칭 + 2026 통합명(공유 규칙)
    const slug = SHORT_TO_SLUG[city] || FULL_TO_SLUG[city];
    if (slug) {
      const variants = cityVariantSet(city, slug);
      filter.city = variants.size > 1 ? { in: [...variants] } : city;
    } else {
      filter.city = city;
    }
  }
  if (district) filter.district = district;
  return filter;
}
