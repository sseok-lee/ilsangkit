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
 * 지역 필터 조건 생성
 */
export function buildRegionFilter(city?: string, district?: string): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (city) {
    // city variants: short(서울) ↔ full(서울특별시) 모두 매칭
    const slug = SHORT_TO_SLUG[city] || FULL_TO_SLUG[city];
    if (slug) {
      const variants = new Set([city, CITY_SLUG_TO_FULL[slug], CITY_SLUG_TO_SHORT[slug]].filter(Boolean));
      filter.city = variants.size > 1 ? { in: [...variants] } : city;
    } else {
      filter.city = city;
    }
  }
  if (district) filter.district = district;
  return filter;
}
