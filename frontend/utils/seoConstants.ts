/**
 * SEO 관련 상수 - 사이트 전역에서 사용
 */
import type { FacilityCategory } from '~/types/facility'

export const SITE_NAME = '일상킷'
export const SITE_URL = 'https://ilsangkit.co.kr'
export const SITE_DESCRIPTION = '아파트·빌라·오피스텔 실거래가 조회부터 내 주변 병원·약국·주차장까지, 생활 정보를 한곳에서 확인하세요.'
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
  'ev-charger': '가까운 전기차 충전소 위치와 충전기 타입을 확인하세요',
  sports: '주변 공공체육시설 위치와 시설 정보를 확인하세요',
}
