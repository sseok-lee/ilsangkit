/**
 * SEO 관련 상수 - 사이트 전역에서 사용
 */
import type { FacilityCategory } from '~/types/facility'

export const SITE_NAME = '일상킷'
export const SITE_URL = 'https://ilsangkit.co.kr'
export const SITE_DESCRIPTION = '아파트·빌라·오피스텔 실거래가 조회부터 내 주변 병원·약국·주차장까지, 생활 정보를 한곳에서 확인하세요.'
export const SITE_TAGLINE = '부동산 실거래가·청약·내 주변 생활정보'
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.webp`

export function getCurrentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function getCurrentYear(): number {
  return new Date().getFullYear()
}

export const POPULAR_REGIONS = [
  { citySlug: 'seoul', districtSlug: 'gangnam', label: '강남구' },
  { citySlug: 'seoul', districtSlug: 'songpa', label: '송파구' },
  { citySlug: 'seoul', districtSlug: 'seocho', label: '서초구' },
  { citySlug: 'seoul', districtSlug: 'mapo', label: '마포구' },
  { citySlug: 'seoul', districtSlug: 'yeongdeungpo', label: '영등포구' },
  { citySlug: 'seoul', districtSlug: 'nowon', label: '노원구' },
  { citySlug: 'gyeonggi', districtSlug: 'seongnam', label: '성남시' },
  { citySlug: 'gyeonggi', districtSlug: 'suwon', label: '수원시' },
  { citySlug: 'gyeonggi', districtSlug: 'yongin', label: '용인시' },
  { citySlug: 'busan', districtSlug: 'haeundae', label: '해운대구' },
  { citySlug: 'incheon', districtSlug: 'namdong', label: '남동구' },
  { citySlug: 'daegu', districtSlug: 'suseong', label: '수성구' },
]

/**
 * 지역별 허브 페이지 링크
 */
export const CITY_LINKS = [
  { slug: 'seoul', label: '서울' },
  { slug: 'gyeonggi', label: '경기' },
  { slug: 'incheon', label: '인천' },
  { slug: 'busan', label: '부산' },
  { slug: 'daegu', label: '대구' },
  { slug: 'gwangju', label: '광주' },
  { slug: 'daejeon', label: '대전' },
  { slug: 'ulsan', label: '울산' },
  { slug: 'sejong', label: '세종' },
  { slug: 'gangwon', label: '강원' },
  { slug: 'chungbuk', label: '충북' },
  { slug: 'chungnam', label: '충남' },
  { slug: 'jeonbuk', label: '전북' },
  { slug: 'jeonnam', label: '전남' },
  { slug: 'gyeongbuk', label: '경북' },
  { slug: 'gyeongnam', label: '경남' },
  { slug: 'jeju', label: '제주' },
]

/**
 * 카테고리별 관련 카테고리 매핑 - 상세 페이지 하단 "이 지역 다른 시설" 링크용
 */
export const RELATED_CATEGORIES: Record<string, string[]> = {
  hospital: ['pharmacy', 'aed'],
  pharmacy: ['hospital'],
  school: ['childcare', 'library'],
  childcare: ['school', 'park'],
  park: ['sports', 'childcare'],
  parking: ['ev-charger'],
  'ev-charger': ['parking'],
  toilet: ['parking'],
  clothes: ['trash'],
  trash: ['clothes'],
  market: ['parking'],
  library: ['school'],
  aed: ['hospital'],
  sports: ['park'],
  wifi: [],
  subway: ['parking', 'ev-charger', 'toilet'],
}

/**
 * 카테고리별 CTA 문구 - description 마지막에 삽입
 */
export const CATEGORY_CTA: Record<FacilityCategory, string> = {
  toilet: '가까운 공공화장실 위치와 운영시간을 확인하세요',
  hospital: '병원 진료시간과 진료과목을 확인하세요',
  pharmacy: '약국 운영시간과 위치를 확인하세요',
  parking: '가까운 공영주차장 위치와 요금을 확인하세요',
  wifi: '무료 와이파이 위치와 이용 정보를 확인하세요',
  aed: '자동심장충격기(AED) 위치를 확인하세요',
  library: '공공도서관 운영시간과 이용 정보를 확인하세요',
  clothes: '가까운 의류수거함 위치를 확인하세요',
  trash: '쓰레기 배출 요일과 방법을 확인하세요',
  park: '가까운 공원 위치와 편의시설 정보를 확인하세요',
  school: '주변 학교 위치와 기본 정보를 확인하세요',
  market: '가까운 전통시장 위치와 개장 정보를 확인하세요',
  childcare: '주변 어린이집 위치와 유형, 정원 정보를 확인하세요',
  'ev-charger': '가까운 전기차 충전소 위치와 실시간 충전 상태를 확인하세요',
  sports: '주변 공공체육시설 위치와 시설 정보를 확인하세요',
  subway: '지하철역 위치와 노선·환승 정보를 확인하세요',
}

export const CATEGORY_SEO_TITLE: Record<FacilityCategory, string> = {
  hospital:     '병원 찾기 - 근처 병원 진료과·진료시간을 지도에서 확인',
  pharmacy:     '약국 찾기 - 근처 약국 영업시간·야간약국을 지도에서 확인',
  parking:      '공영주차장 찾기 - 근처 주차장 요금·운영시간을 지도에서 확인',
  toilet:       '공중화장실 찾기 - 근처 화장실 위치·개방시간을 지도에서 확인',
  aed:          '자동심장충격기(AED) 찾기 - 근처 AED 위치를 지도에서 확인',
  library:      '공공도서관 찾기 - 근처 도서관 운영시간·휴관일을 지도에서 확인',
  clothes:      '의류수거함 찾기 - 근처 헌 옷 수거함 위치·배출 방법 안내',
  trash:        '쓰레기 배출 안내 - 지역별 분리수거 요일·방법을 동별로 확인',
  park:         '공원 찾기 - 근처 공원 산책로·운동시설·위치를 지도에서 확인',
  school:       '학교 찾기 - 근처 초중고 위치·설립유형 정보를 지도에서 확인',
  market:       '전통시장 찾기 - 근처 시장 장날·위치·상점 정보를 지도에서 확인',
  childcare:    '어린이집 찾기 - 근처 어린이집 정원·유형·위치를 지도에서 확인',
  'ev-charger': '전기차 충전소 찾기 - 근처 충전기 종류·이용시간을 지도에서 확인',
  sports:       '공공체육시설 찾기 - 근처 체육관·수영장 위치를 지도에서 확인',
  wifi:         '공공 와이파이 찾기 - 근처 무료 와이파이 위치를 지도에서 확인',
  subway:       '지하철역 찾기 - 근처 지하철역 위치·노선·환승 정보를 지도에서 확인',
}

export const CATEGORY_SEO_DESCRIPTION: Record<FacilityCategory, string> = {
  hospital:     '전국 병원의 진료과목·진료시간·위치를 지도에서 확인하세요. 내과·정형외과·피부과 등 진료과별 검색과 현재 운영 중인 병원 필터를 무료로 제공합니다.',
  pharmacy:     '전국 약국의 영업시간·위치를 지도에서 확인하세요. 야간·24시간 운영 약국 필터로 응급 상황에서도 언제든지 빠르게 가까운 약국을 찾을 수 있습니다.',
  parking:      '전국 공영주차장의 요금·운영시간·주차 가능 면수를 지도에서 확인하세요. 무료·유료 구분과 거리순 정렬로 목적지 근처 주차 공간을 쉽게 찾아보세요.',
  toilet:       '전국 공중화장실의 위치·개방시간·남녀 구분 여부를 지도에서 확인하세요. 현재 위치 기준 거리순으로 가장 가까운 화장실을 빠르게 찾을 수 있습니다.',
  aed:          '전국 자동심장충격기(AED) 설치 위치·이용 가능 시간을 지도에서 확인하세요. 심정지 응급 상황에서 가장 가까운 AED를 빠르게 찾을 수 있습니다.',
  library:      '전국 공공도서관의 운영시간·휴관일·위치를 지도에서 확인하세요. 가까운 도서관 이용 안내와 독서 프로그램, 시설 정보를 한눈에 편리하게 살펴보세요.',
  clothes:      '전국 의류수거함의 위치·배출 가능 품목을 지도에서 확인하세요. 현재 위치 기준으로 가까운 헌 옷 수거함을 빠르게 찾아 의류를 올바르게 배출하세요.',
  trash:        '지역별 쓰레기 배출 요일·시간·분리수거 방법을 확인하세요. 음식물·재활용·일반쓰레기 배출일을 놓치지 않도록 내 동네 배출 일정을 미리 조회하세요.',
  park:         '전국 공원의 산책로·운동시설·편의시설·위치를 지도에서 미리 확인하세요. 가까운 도시공원·근린공원을 찾아 산책과 야외 활동 정보를 미리 살펴보세요.',
  school:       '전국 초·중·고등학교의 위치·설립유형·학교 정보를 지도에서 확인하세요. 주거지 인근 학교 정보를 한눈에 파악해 학군 탐색과 입학 준비에 활용해 보세요.',
  market:       '전국 전통시장의 장날·위치·주요 상점 정보를 지도에서 확인하세요. 오일장·상설시장 일정과 상권 정보를 미리 확인하고 방문 계획을 미리 세워보세요.',
  childcare:    '전국 어린이집의 정원·현원·유형·위치를 지도에서 확인하세요. 국공립·민간·가정 어린이집을 구분하고 가까운 어린이집 빈자리 여부를 비교해 보세요.',
  'ev-charger': '전국 전기차 충전소의 충전기 종류·이용시간·위치를 지도에서 확인하세요. 급속·완속 충전기 필터와 운영 상태로 가까운 충전소를 빠르게 찾아보세요.',
  sports:       '전국 공공체육시설의 시설 규모·이용 정보·위치를 지도에서 확인하세요. 가까운 공공 스포츠 시설(체육관·수영장·테니스장 등)을 손쉽게 찾아보세요.',
  wifi:         '전국 공공 와이파이의 위치·SSID·이용 가능 장소를 지도에서 확인하세요. 도서관·공원·버스정류장 등 무료 인터넷 사용 가능 구역을 미리 파악해 보세요.',
  subway:       '전국 지하철역의 위치·노선·환승 정보를 지도에서 확인하세요. 1~9호선·수도권 광역철도·코레일 노선까지 역명과 좌표를 한눈에 검색할 수 있습니다.',
}

export const CATEGORY_SEO_INTENT: Record<FacilityCategory, string> = {
  toilet: '위치·개방시간',
  hospital: '진료과·진료시간',
  pharmacy: '영업시간·야간운영',
  parking: '요금·운영시간',
  wifi: '위치·SSID',
  aed: '설치위치·이용가능시간',
  library: '운영시간·휴관일',
  clothes: '위치·배출안내',
  trash: '배출일·분리수거 안내',
  park: '산책로·운동시설',
  school: '학교정보·설립유형',
  market: '장날·상점정보',
  childcare: '정원·현원',
  'ev-charger': '충전기·이용시간',
  sports: '시설규모·이용정보',
  subway: '위치·노선·환승',
}
