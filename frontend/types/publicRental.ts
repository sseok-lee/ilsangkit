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
  landlordAgency: string
  sourceId: string
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
