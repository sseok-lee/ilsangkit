// 공공임대 입주자 모집공고 타입

export type AnnouncementSource = 'general' | 'longTerm'
export type AnnouncementStatus = 'ongoing' | 'upcoming' | 'closed' | 'unknown'

export interface PublicRentalAnnouncement {
  id: number
  pblancId: string
  pblancNo: string | null
  pblancNm: string
  source: AnnouncementSource
  suplyInsttNm: string | null
  suplyTyNm: string | null
  brtcNm: string | null
  signguNm: string | null
  hsmpNm: string | null
  pnu: string | null
  rcritPblancDe: string | null
  beginDe: string | null
  endDe: string | null
  totSplyHshldco: number | null
  url: string | null
  status: AnnouncementStatus
  createdAt?: string
  updatedAt?: string
}

export interface PublicRentalAnnouncementDetail extends PublicRentalAnnouncement {
  matchedComplexes: Array<{
    id: number
    complexCode: string
    complexName: string
    complexNameKor: string | null
    city: string
    district: string
    rentalType: string
    houseType: string | null
    householdCount: number | null
    exclusiveArea: number | null
    depositAmount: number | null
    monthlyRent: number | null
  }>
}

export interface PublicRentalAnnouncementListQuery {
  page?: number
  limit?: number
  city?: string
  district?: string
  rentalType?: string
  source?: AnnouncementSource
  status?: AnnouncementStatus
  q?: string
}

export interface PublicRentalAnnouncementListResponse {
  items: PublicRentalAnnouncement[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
