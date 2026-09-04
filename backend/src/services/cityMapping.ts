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
 * 구·군 표기 변형 — 정식명('남양주시') ↔ 접미사 없는 표기('남양주').
 *
 * WasteSchedule 은 원본 공공데이터의 표기를 그대로 저장하는데 경기도 남양주·동두천 두 곳만
 * 접미사 없이 들어온다(실측 2026-09-04 프로덕션: Region 에 없는 WasteSchedule.district 는
 * 이 둘과 세종의 '없음' 뿐). 지역 허브는 slug 를 Region 정식명으로 되돌려 조회하므로
 * 정확 일치로는 그 두 지역이 0건이 되고, 허브가 "등록된 배출 일정이 없습니다" 인 채
 * 200 + noindex 로 나간다.
 *
 * 접미사를 떼어도 같은 시/도 안에서 두 구·군이 하나로 뭉치는 사례는 없다
 * (실측: Region 전수 대상 충돌 0건).
 *
 * ⚠️ 그래도 전역 기본값으로 켜지 않는다. 표기가 실제로 갈라진 것은 WasteSchedule 뿐이고,
 * 나머지 테이블은 정식명으로 일관돼 있어 전역으로 넓히면 얻는 것 없이 매칭만 느슨해진다.
 */
export function districtVariantList(district: string): string[] {
  const stem = district.replace(/[시군구]$/, '');
  return stem && stem !== district ? [district, stem] : [district];
}

/**
 * 지역 필터 조건 생성
 *
 * @param options.districtVariants 구·군을 접미사 유무 양쪽으로 매칭한다.
 *        표기가 갈라진 WasteSchedule 전용 — districtVariantList 주석 참고.
 */
export function buildRegionFilter(
  city?: string,
  district?: string,
  options: { districtVariants?: boolean } = {}
): Record<string, unknown> {
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
  if (district) {
    const variants = options.districtVariants ? districtVariantList(district) : [district];
    filter.district = variants.length > 1 ? { in: variants } : district;
  }
  return filter;
}
