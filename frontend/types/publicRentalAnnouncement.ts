// 공공임대 입주자 모집공고 타입

export type AnnouncementSource = 'general' | 'longTerm'
export type AnnouncementStatus = 'ongoing' | 'upcoming' | 'closed' | 'unknown'

// 목록 카드 — pblancId 기준 dedupe + aggregate
export interface PublicRentalAnnouncementListItem {
  pblancId: string
  pblancNm: string
  source: AnnouncementSource
  suplyInsttNm: string | null
  suplyTyNm: string | null
  houseTyNm: string | null
  brtcNm: string | null
  signguNm: string | null
  hsmpNm: string | null
  rcritPblancDe: string | null
  beginDe: string | null
  endDe: string | null
  totalSupply: number | null
  variantCount: number
  status: AnnouncementStatus
  pcUrl: string | null
  url: string | null
}

export interface PublicRentalAnnouncementVariant {
  houseSn: number
  hsmpNm: string | null
  pnu: string | null
  fullAdres: string | null
  suplyTyNm: string | null
  houseTyNm: string | null
  sumSuplyCo: number | null
  totHshldCo: number | null
  rentGtn: number | null
  enty: number | null
  prtpay: number | null
  surlus: number | null
  mtRntchrg: number | null
  heatMthdNm: string | null
}

export interface PublicRentalAnnouncementDetail {
  pblancId: string
  pblancNm: string
  source: AnnouncementSource
  sttusNm: string | null
  suplyInsttNm: string | null
  suplyTyNm: string | null
  houseTyNm: string | null
  brtcNm: string | null
  signguNm: string | null
  hsmpNm: string | null
  fullAdres: string | null
  rcritPblancDe: string | null
  beginDe: string | null
  endDe: string | null
  przwnerDe: string | null
  refrnc: string | null
  url: string | null
  pcUrl: string | null
  mobileUrl: string | null
  status: AnnouncementStatus
  updatedAt?: string
  variants: PublicRentalAnnouncementVariant[]
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
  items: PublicRentalAnnouncementListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
