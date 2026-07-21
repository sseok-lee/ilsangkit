/**
 * 2026-07-01 전남광주통합특별시 출범 대응: 광주광역시 + 전라남도 통합에 따라
 * 시설/부동산 sync·URL 로직이 city명을 일관된 신명으로 정규화하기 위한 공통 유틸.
 *
 * 목표값: city='전남광주통합특별시', bjdCode 접두 '12'.
 *
 * ⚠️ 경기도 광주시(bjdCode 41)는 전남광주통합특별시와 무관 — city='경기'/'경기도'인 경우는
 * 절대 매핑하지 않는다. city가 '광주시' 그 자체로 들어온 모호한 케이스는 district가
 * 광주광역시 5개 자치구(GWANGJU_5GU) 중 하나일 때만 통합시로 매핑한다.
 */

/** 정규화 목표 city 값. */
export const JNGJ_CITY = '전남광주통합특별시';

/** 광주광역시 5개 자치구. */
export const GWANGJU_5GU: Set<string> = new Set(['동구', '서구', '남구', '북구', '광산구']);

/** 전남광주통합특별시 산하 27개 시군구 (광주 5구 + 전남 22시군). */
export const JNGJ_DISTRICTS: Set<string> = new Set([
  // 광주 5구
  ...GWANGJU_5GU,
  // 전남 22시군
  '목포시', '여수시', '순천시', '나주시', '광양시',
  '담양군', '곡성군', '구례군', '고흥군', '보성군',
  '화순군', '장흥군', '강진군', '해남군', '영암군',
  '무안군', '함평군', '영광군', '장성군', '완도군',
  '진도군', '신안군',
]);

/** city 필드에 그대로 들어올 수 있는 광주/전남 구명(옛/신 혼용). */
const JNGJ_CITY_VARIANTS = ['전라남도', '전남광주', '전남', '광주광역시', '광주'];

/** city 필드에 "{변종}{district}"가 concat되어 들어온 경우 strip 대상 접두어(신명 포함). */
const CONCAT_PREFIXES = [JNGJ_CITY, ...JNGJ_CITY_VARIANTS];

/**
 * 광주/전남 지역명을 전남광주통합특별시로 정규화한다.
 * - city+district가 이미 분리된 정상 입력, city 필드에 구명이 concat된 오염 입력(신/구명 모두)을
 *   전부 처리한다.
 * - 경기도 광주시는 city가 '경기'/'경기도'일 때는 물론, city가 '광주시' 그 자체로 들어온
 *   모호한 케이스도 district가 광주 5구가 아니면 손대지 않는다.
 * - 매칭되지 않는 지역은 입력을 그대로(trim만 적용) 반환한다.
 */
export function normalizeRegionName(city: string, district: string = ''): { city: string; district: string } {
  const trimmedCity = city.trim();
  const trimmedDistrict = district.trim();

  // 1) concat 분리: city 필드에 "{변종 접두}{district}"가 합쳐져 들어온 경우
  for (const prefix of CONCAT_PREFIXES) {
    if (trimmedCity.length > prefix.length && trimmedCity.startsWith(prefix)) {
      const tail = trimmedCity.slice(prefix.length);
      if (JNGJ_DISTRICTS.has(tail)) {
        return { city: JNGJ_CITY, district: tail };
      }
    }
  }

  // 2) 정규 변종 매칭 (city/district가 이미 분리된 입력)
  if (trimmedCity === JNGJ_CITY || JNGJ_CITY_VARIANTS.includes(trimmedCity)) {
    return { city: JNGJ_CITY, district: trimmedDistrict };
  }

  // 3) '광주시'는 경기도 광주시와 표기가 겹침 — district가 광주 5구일 때만 통합시로 매핑
  if (trimmedCity === '광주시' && GWANGJU_5GU.has(trimmedDistrict)) {
    return { city: JNGJ_CITY, district: trimmedDistrict };
  }

  // 4) passthrough (경기도/경기+광주시, 무관 지역 등)
  return { city: trimmedCity, district: trimmedDistrict };
}
