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
 * 통합시 데이터를 기존 gwangju slug로 되돌리는 집합. 그 외 '12###'는 jeonnam.
 */
export const GWANGJU_GU_BJD = new Set(['12210', '12240', '12270', '12300', '12330']);

/**
 * bjdCode + city명 → 사이트 안정 citySlug + 표시 라벨(short).
 * 통합시(코드12)는 이름이 하나라 bjdCode로 광주/전남 disambiguate.
 * bjdCode가 없으면(테스트/구데이터) city명 기반으로 폴백.
 */
export function resolveCitySlug(bjdCode: string, city: string): { citySlug: string; cityLabel: string } {
  if (bjdCode && bjdCode.startsWith('12')) {
    return GWANGJU_GU_BJD.has(bjdCode)
      ? { citySlug: 'gwangju', cityLabel: '광주' }
      : { citySlug: 'jeonnam', cityLabel: '전남' };
  }
  const slug = SHORT_TO_SLUG[city] || FULL_TO_SLUG[city] || '';
  return { citySlug: slug, cityLabel: CITY_SLUG_TO_SHORT[slug] || city };
}

/**
 * city의 축약/정식 variant 목록 (raw SQL `IN (?)` 용).
 * buildRegionFilter와 동일 로직 — Prisma where가 아닌 배열 형태가 필요할 때 사용.
 */
export function cityVariantList(city?: string): string[] {
  if (!city) return [];
  const slug = SHORT_TO_SLUG[city] || FULL_TO_SLUG[city];
  if (!slug) return [city];
  return [...new Set([city, CITY_SLUG_TO_FULL[slug], CITY_SLUG_TO_SHORT[slug]].filter(Boolean))] as string[];
}

/**
 * 지역 필터 조건 생성
 */
export function buildRegionFilter(city?: string, district?: string): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (city) {
    // city variants: short(서울) ↔ full(서울특별시) 모두 매칭
    const slug = SHORT_TO_SLUG[city] || FULL_TO_SLUG[city];
    if (slug) {
      const variants = new Set([city, CITY_SLUG_TO_FULL[slug], CITY_SLUG_TO_SHORT[slug]].filter(Boolean));
      // 2026 통합: 광주/전남 데이터가 신설명(전남광주통합특별시·코드12)으로 유입됨.
      // district 지정 시에만 통합명을 변형에 추가 — 구명이 광주/전남 간 겹치지 않아 안전.
      // (district 없는 city-hub 질의에 넣으면 27구 전체를 끌어와 오버매칭 → 제외.)
      if ((slug === 'gwangju' || slug === 'jeonnam') && district) {
        variants.add('전남광주통합특별시');
      }
      filter.city = variants.size > 1 ? { in: [...variants] } : city;
    } else {
      filter.city = city;
    }
  }
  if (district) filter.district = district;
  return filter;
}
