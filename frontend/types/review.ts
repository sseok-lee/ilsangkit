import type { FacilityCategory } from './facility'

// 리뷰 기본 정보
export interface Review {
  id: number
  nickname: string
  content: string
  createdAt: string
  updatedAt: string
}

// 최근 리뷰 (홈페이지용 - 시설 정보 포함)
export interface ReviewWithFacility {
  id: number
  facilityCategory: string
  facilityId: string
  facilityName: string
  nickname: string
  content: string
  createdAt: string
}

// 리뷰 작성 페이로드
export interface CreateReviewPayload {
  facilityCategory: string
  facilityId: string
  nickname: string
  password: string
  content: string
}

// 리뷰 수정 페이로드
export interface UpdateReviewPayload {
  password: string
  content?: string
  nickname?: string
}

// 리뷰 삭제 페이로드
export interface DeleteReviewPayload {
  password: string
}

// 리뷰 목록 응답
export interface ReviewListResponse {
  items: Review[]
  total: number
  page: number
  totalPages: number
}
