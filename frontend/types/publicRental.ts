// LH myhome 매입/전세임대 단지 카탈로그 타입

export type PublicRentalType = '매입임대' | '전세임대' | string

export interface PublicRentalComplex {
  id: number
  complexCode: string
  complexName: string
  city: string
  district: string
  rentalType: PublicRentalType
  houseType: string | null
  householdCount: number | null
  exclusiveArea: number | null
  depositAmount: number | null   // BigInt → Number (원)
  monthlyRent: number | null      // 원
  conversionDeposit?: number | null // 전환보증금 한도(원)
  landlordAgency: string
  pnu?: string | null
  completionDate?: string | null  // YYYYMMDD
  commonArea?: number | null      // 공용면적 ㎡
  heatingMethod?: string | null
  buildingStyle?: string | null
  hasElevator?: string | null
  parkingCount?: number | null
  complexNameKor?: string | null
  lat?: number | null
  lng?: number | null
  sourceId: string
  // 활성 모집공고 매칭 결과 (PNU 또는 도/구/단지명) — 카드/상세에 "모집중"/"모집예정" 배지 표시용.
  announcementStatus?: 'ongoing' | 'upcoming' | null
  createdAt: string
  updatedAt: string
}

export interface PublicRentalListQuery {
  city?: string
  district?: string
  rentalType?: PublicRentalType
  depositMin?: number
  depositMax?: number
  monthlyRentMin?: number
  monthlyRentMax?: number
  page?: number
  limit?: number
}

export interface PublicRentalPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PublicRentalListResponse {
  items: PublicRentalComplex[]
  pagination: PublicRentalPagination
}
