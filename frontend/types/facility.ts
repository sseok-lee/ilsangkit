// 시설 카테고리
export type FacilityCategory = 'toilet' | 'wifi' | 'clothes' | 'kiosk'

// 시설 기본 정보 (목록용)
export interface Facility {
  id: string
  name: string
  category: FacilityCategory
  address: string | null
  roadAddress: string | null
  lat: number
  lng: number
  city: string
  district: string
  distance?: number
}

// 시설 상세 정보
export interface FacilityDetail {
  id: string
  category: FacilityCategory
  name: string
  address: string | null
  roadAddress: string | null
  lat: number
  lng: number
  city: string
  district: string
  bjdCode: string | null
  details: ToiletDetails | WifiDetails | ClothesDetails | KioskDetails
  sourceId: string
  sourceUrl: string | null
  viewCount: number
  createdAt: string
  updatedAt: string
  syncedAt: string
}

// 카테고리별 상세 정보
export interface ToiletDetails {
  operatingHours?: string | null
  maleToilets?: number
  maleUrinals?: number
  femaleToilets?: number
  hasDisabledToilet?: boolean
  openTime?: string | null
  managingOrg?: string | null
}

export interface WifiDetails {
  ssid?: string | null
  installDate?: string | null
  serviceProvider?: string | null
  installLocation?: string | null
  managementAgency?: string | null
  phoneNumber?: string | null
}

export interface ClothesDetails {
  managementAgency?: string | null
  phoneNumber?: string | null
  dataDate?: string | null
  detailLocation?: string | null
}

export interface KioskDetails {
  detailLocation?: string | null
  operationAgency?: string | null
  weekdayOperatingHours?: string | null
  saturdayOperatingHours?: string | null
  holidayOperatingHours?: string | null
  blindKeypad?: boolean
  voiceGuide?: boolean
  brailleOutput?: boolean
  wheelchairAccessible?: boolean
}

// 검색 파라미터
export interface SearchParams {
  keyword?: string
  category?: FacilityCategory
  lat?: number
  lng?: number
  radius?: number
  city?: string
  district?: string
  page?: number
  limit?: number
  sort?: 'distance' | 'name'
}

// 검색 응답
export interface SearchResponse {
  items: Facility[]
  total: number
  page: number
  totalPages: number
}

// API 응답
export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
  }
}

// 카테고리 메타데이터
export interface CategoryMeta {
  label: string
  icon: string
  color: string
}

export const CATEGORY_META: Record<FacilityCategory, CategoryMeta> = {
  toilet: {
    label: '공공화장실',
    icon: '🚻',
    color: 'blue',
  },
  wifi: {
    label: '무료와이파이',
    icon: '📶',
    color: 'green',
  },
  clothes: {
    label: '의류수거함',
    icon: '👕',
    color: 'purple',
  },
  kiosk: {
    label: '무인민원발급기',
    icon: '🖨️',
    color: 'orange',
  },
}
