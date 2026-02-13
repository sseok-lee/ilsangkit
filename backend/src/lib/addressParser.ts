// 주소 파싱 유틸리티
// syncWifi, syncKiosk, syncAed 등에서 중복되던 주소 파싱 로직 통합

/**
 * 시/도 정규화 맵
 * 공공데이터의 다양한 시/도 표기를 2글자 약칭으로 정규화
 */
export const CITY_NORMALIZATION_MAP: Record<string, string> = {
  서울특별시: '서울',
  서울시: '서울',
  서울: '서울',
  부산광역시: '부산',
  부산시: '부산',
  부산: '부산',
  대구광역시: '대구',
  대구시: '대구',
  대구: '대구',
  인천광역시: '인천',
  인천시: '인천',
  인천: '인천',
  광주광역시: '광주',
  광주시: '광주',
  광주: '광주',
  대전광역시: '대전',
  대전시: '대전',
  대전: '대전',
  울산광역시: '울산',
  울산시: '울산',
  울산: '울산',
  세종특별자치시: '세종',
  세종시: '세종',
  세종: '세종',
  경기도: '경기',
  경기: '경기',
  강원특별자치도: '강원',
  강원도: '강원',
  강원: '강원',
  충청북도: '충북',
  충북: '충북',
  충청남도: '충남',
  충남: '충남',
  전북특별자치도: '전북',
  전라북도: '전북',
  전북: '전북',
  전라남도: '전남',
  전남: '전남',
  경상북도: '경북',
  경북: '경북',
  경상남도: '경남',
  경남: '경남',
  제주특별자치도: '제주',
  제주도: '제주',
  제주: '제주',
};

/**
 * 시/도명 정규화 (정규화 맵 기반)
 * @example normalizeCity('서울특별시') → '서울'
 * @example normalizeCity('경기도') → '경기'
 */
export function normalizeCity(rawCity: string): string {
  return CITY_NORMALIZATION_MAP[rawCity] || rawCity;
}

// 시/도 패턴 (정규식용)
const CITY_PATTERN =
  '서울특별시|서울시|서울|부산광역시|부산시|부산|대구광역시|대구시|대구|인천광역시|인천시|인천|광주광역시|광주시|광주|대전광역시|대전시|대전|울산광역시|울산시|울산|세종특별자치시|세종시|세종|경기도|경기|강원특별자치도|강원도|강원|충청북도|충북|충청남도|충남|전북특별자치도|전라북도|전북|전라남도|전남|경상북도|경북|경상남도|경남|제주특별자치도|제주도|제주';

const ADDRESS_REGEX = new RegExp(
  `^(${CITY_PATTERN})\\s+(\\S+[구군시])`
);

/**
 * 주소 문자열에서 시/도, 구/군 추출 (정규식 기반)
 * 세종시 특별 처리 포함
 *
 * @returns { city, district } 또는 null (파싱 실패 시)
 */
export function parseAddress(
  address: string
): { city: string; district: string } | null {
  if (!address || address.trim() === '') {
    return null;
  }

  const trimmedAddress = address.trim();

  // 세종시 특별 처리 (구/군이 없음)
  if (
    trimmedAddress.includes('세종특별자치시') ||
    trimmedAddress.includes('세종시') ||
    trimmedAddress.startsWith('세종')
  ) {
    return { city: '세종', district: '세종시' };
  }

  const match = trimmedAddress.match(ADDRESS_REGEX);
  if (!match) {
    return null;
  }

  const rawCity = match[1];
  const district = match[2];
  const city = CITY_NORMALIZATION_MAP[rawCity] || rawCity;

  return { city, district };
}

/**
 * 주소에서 시/도, 구/군 추출 (공백 분리 기반, 간단 버전)
 * API 데이터에서 이미 정제된 주소가 제공되는 경우 사용
 *
 * @returns { city, district } (빈 문자열 가능)
 */
export function extractCityDistrict(address: string): { city: string; district: string } {
  const parts = address.trim().split(/\s+/);
  return {
    city: parts[0] || '',
    district: parts[1] || '',
  };
}
