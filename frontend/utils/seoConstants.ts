/**
 * SEO 관련 상수 - 사이트 전역에서 사용
 */
export const SITE_NAME = '일상킷'
export const SITE_URL = 'https://ilsangkit.co.kr'
export const SITE_DESCRIPTION = '아파트·빌라·오피스텔 실거래가 조회부터 내 주변 병원·약국·주차장까지, 생활 정보를 한곳에서 확인하세요.'
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`

/**
 * 카테고리별 CTA 문구 - description 마지막에 삽입
 */
import type { FacilityCategory } from '~/types/facility'

export const CATEGORY_CTA: Record<FacilityCategory, string> = {
  toilet: '가까운 공공화장실 위치와 운영시간을 확인하세요',
  hospital: '병원 진료시간과 진료과목을 확인하세요',
  pharmacy: '약국 운영시간과 위치를 확인하세요',
  parking: '가까운 공영주차장 위치와 요금을 확인하세요',
  wifi: '무료 와이파이 위치와 이용 정보를 확인하세요',
  kiosk: '무인민원발급기 위치와 운영시간을 확인하세요',
  aed: '자동심장충격기(AED) 위치를 확인하세요',
  library: '공공도서관 운영시간과 이용 정보를 확인하세요',
  clothes: '가까운 의류수거함 위치를 확인하세요',
  trash: '쓰레기 배출 요일과 방법을 확인하세요',
}
