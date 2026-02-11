// 시설 카테고리 (Prisma enum 대응)
export type FacilityCategory = 'toilet' | 'trash' | 'wifi' | 'clothes' | 'kiosk' | 'parking'

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
  details: ToiletDetails | WifiDetails | ClothesDetails | KioskDetails | ParkingDetails
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
  availableDocuments?: string[]
}

export interface ParkingDetails {
  parkingType?: string | null
  lotType?: string | null
  capacity?: number
  baseFee?: number | null
  baseTime?: number | null
  additionalFee?: number | null
  additionalTime?: number | null
  dailyMaxFee?: number | null
  monthlyFee?: number | null
  operatingHours?: string | null
  phone?: string | null
  paymentMethod?: string | null
  remarks?: string | null
  hasDisabledParking?: boolean
}

// 검색 파라미터
// NOTE: 사용자 GPS 좌표(lat/lng)는 위치정보사업 신고 의무 회피를 위해
// 서버로 전송하지 않음. 거리 계산/정렬/영역 필터는 클라이언트에서 수행.
export interface SearchParams {
  keyword?: string
  category?: FacilityCategory
  city?: string
  district?: string
  page?: number
  limit?: number
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
  trash: {
    label: '쓰레기배출',
    icon: '🗑️',
    color: 'red',
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
  parking: {
    label: '공영주차장',
    icon: '🅿️',
    color: 'sky',
  },
}

// ============================================
// API 공통 타입
// ============================================

/**
 * 페이지네이션 요청 파라미터
 */
export interface PaginationParams {
  page?: number
  limit?: number
}

/**
 * 페이지네이션 응답
 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

/**
 * API 에러 상세
 */
export interface ApiErrorDetail {
  code: string
  message: string
  details?: unknown
}

/**
 * 헬스체크 응답
 */
export interface HealthCheckResponse {
  status: 'ok' | 'error'
  timestamp: string
  uptime: number
}

// ============================================
// 카테고리 타입
// ============================================

/**
 * 카테고리 정보
 */
export interface CategoryInfo {
  id: string
  name: string
  icon: string
  description: string | null
  sortOrder: number
  isActive: boolean
}

/**
 * 카테고리별 시설 수
 */
export interface CategoryCount {
  category: string
  count: number
}

// ============================================
// 지역 타입
// ============================================

/**
 * 지역 정보
 */
export interface RegionInfo {
  id: number
  bjdCode: string
  city: string
  district: string
  slug: string
  lat: number
  lng: number
}

/**
 * 시/도 정보
 */
export interface CityInfo {
  city: string
  districtCount: number
}

/**
 * 구/군 정보
 */
export interface DistrictInfo {
  district: string
  slug: string
  lat: number
  lng: number
}

// ============================================
// 쓰레기 배출 관련 타입
// ============================================

export interface TrashDetails {
  trashType?: string | null
  collectionDays?: string[] | null
  collectionStartTime?: string | null
  collectionEndTime?: string | null
  disposalMethod?: string | null
  notes?: string | null
}
