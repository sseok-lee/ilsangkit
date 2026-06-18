// 주소 파싱 유틸리티
// syncWifi, syncAed 등에서 중복되던 주소 파싱 로직 통합

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

/**
 * district 정규화.
 * 일부 공공 API(특히 단축형 광역시: 대구/부산/인천/광주/대전/울산)가 시군구명에
 * 시명을 붙여 "대구동구"처럼 내려주는 문제를 보정한다.
 *
 * 신뢰 가능한 address가 있으면 그걸 파싱해 district를 도출하므로, "부산진구"처럼
 * 시명으로 시작하는 실제 구도 안전하게 보존된다(단순 접두사 제거는 부산진구→진구로
 * 망가지므로 쓰지 않는다). address가 없거나 파싱 실패 시 raw 값을 그대로 둔다.
 *
 * @example normalizeDistrict('대구동구', '대구광역시 동구 안심로 58') → '동구'
 * @example normalizeDistrict('부산진구', '부산광역시 부산진구 가야대로') → '부산진구'
 * @example normalizeDistrict('동구',     '부산광역시 동구 중앙대로 206') → '동구'
 */
// 시/도 풀네임 접미사 — district 후보로 잘못 잡히면(예: "울산광역시 울산광역시 남구"
// 처럼 시명이 중복된 주소) 거부하기 위함. 시군구는 구/군/시로 끝나되 시/도명은 아니어야 함.
const SIDO_SUFFIX_RE = /(특별시|광역시|특별자치시|특별자치도|도)$/;

function isValidDistrictToken(d?: string): boolean {
  return !!d && /[구군시]$/.test(d) && !SIDO_SUFFIX_RE.test(d);
}

export function normalizeDistrict(rawDistrict: string, address?: string | null): string {
  const raw = (rawDistrict || '').trim();
  if (address && address.trim()) {
    const parsed = parseAddress(address);
    if (isValidDistrictToken(parsed?.district)) return parsed!.district;
    const ext = extractCityDistrict(address);
    if (isValidDistrictToken(ext.district)) return ext.district;
  }
  return raw;
}
