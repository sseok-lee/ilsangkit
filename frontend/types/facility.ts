// 시설 카테고리 (Prisma enum 대응)
export type FacilityCategory = 'toilet' | 'trash' | 'wifi' | 'clothes' | 'kiosk' | 'parking' | 'aed' | 'library' | 'hospital' | 'pharmacy'

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
  extras?: Record<string, unknown>
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
  details: ToiletDetails | WifiDetails | ClothesDetails | KioskDetails | ParkingDetails | AedDetails | LibraryDetails | HospitalDetails | PharmacyDetails
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
  phoneNumber?: string | null
  installDate?: string | null
  ownershipType?: string | null
  sewageTreatment?: string | null
  hasEmergencyBell?: boolean
  emergencyBellLocation?: string | null
  hasCCTV?: boolean
  hasDiaperChangingTable?: boolean
  diaperChangingLocation?: string | null
  maleDisabledToilets?: number
  maleDisabledUrinals?: number
  maleChildToilets?: number
  maleChildUrinals?: number
  femaleDisabledToilets?: number
  femaleChildToilets?: number
  remodelingDate?: string | null
  facilityType?: string | null
  legalBasis?: string | null
  govCode?: string | null
  dataDate?: string | null
}

export interface WifiDetails {
  ssid?: string | null
  installDate?: string | null
  serviceProvider?: string | null
  installLocation?: string | null
  managementAgency?: string | null
  phoneNumber?: string | null
  installLocationDetail?: string | null
  govCode?: string | null
  dataDate?: string | null
}

export interface ClothesDetails {
  managementAgency?: string | null
  phoneNumber?: string | null
  dataDate?: string | null
  detailLocation?: string | null
  providerCode?: string | null
  providerName?: string | null
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
  govCode?: string | null
  installPosition?: string | null
  dataDate?: string | null
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
  zoneClass?: string | null
  alternateParking?: string | null
  operatingDays?: string | null
  feeType?: string | null
  dailyMaxFeeHours?: string | null
  managingOrg?: string | null
  dataDate?: string | null
  providerCode?: string | null
  providerName?: string | null
}

export interface AedDetails {
  buildPlace?: string | null
  org?: string | null
  clerkTel?: string | null
  mfg?: string | null
  model?: string | null
  monSttTme?: string | null
  monEndTme?: string | null
  tueSttTme?: string | null
  tueEndTme?: string | null
  wedSttTme?: string | null
  wedEndTme?: string | null
  thuSttTme?: string | null
  thuEndTme?: string | null
  friSttTme?: string | null
  friEndTme?: string | null
  satSttTme?: string | null
  satEndTme?: string | null
  sunSttTme?: string | null
  sunEndTme?: string | null
  holSttTme?: string | null
  holEndTme?: string | null
  dataDate?: string | null
}

export interface LibraryDetails {
  libraryType?: string | null
  closedDays?: string | null
  weekdayOpenTime?: string | null
  weekdayCloseTime?: string | null
  saturdayOpenTime?: string | null
  saturdayCloseTime?: string | null
  holidayOpenTime?: string | null
  holidayCloseTime?: string | null
  seatCount?: number
  bookCount?: number
  serialCount?: number
  nonBookCount?: number
  loanableBooks?: number
  loanableDays?: number
  phoneNumber?: string | null
  homepageUrl?: string | null
  operatingOrg?: string | null
  lotArea?: string | null
  buildingArea?: string | null
  dataDate?: string | null
  providerCode?: string | null
  providerName?: string | null
}

export interface HospitalDetails {
  phone?: string | null
  homepage?: string | null
  postNo?: string | null
  estbDd?: string | null
  ykiho?: string | null
  clCd?: string | null
  clCdNm?: string | null
  sidoCd?: string | null
  sgguCd?: string | null
  emdongNm?: string | null
  drTotCnt?: number | null
  mdeptSdrCnt?: number | null
  mdeptGdrCnt?: number | null
  mdeptIntnCnt?: number | null
  mdeptResdntCnt?: number | null
  detySdrCnt?: number | null
  detyGdrCnt?: number | null
  detyIntnCnt?: number | null
  detyResdntCnt?: number | null
  cmdcSdrCnt?: number | null
  cmdcGdrCnt?: number | null
  cmdcIntnCnt?: number | null
  cmdcResdntCnt?: number | null
  pnursCnt?: number | null
  dataDate?: string | null
}

export interface PharmacyDetails {
  phone?: string | null
  dutyTel3?: string | null
  hpid?: string | null
  postCdn1?: string | null
  postCdn2?: string | null
  dutyTime1s?: string | null
  dutyTime1c?: string | null
  dutyTime2s?: string | null
  dutyTime2c?: string | null
  dutyTime3s?: string | null
  dutyTime3c?: string | null
  dutyTime4s?: string | null
  dutyTime4c?: string | null
  dutyTime5s?: string | null
  dutyTime5c?: string | null
  dutyTime6s?: string | null
  dutyTime6c?: string | null
  dutyTime7s?: string | null
  dutyTime7c?: string | null
  dutyTime8s?: string | null
  dutyTime8c?: string | null
  dutyMapimg?: string | null
  dutyInf?: string | null
  dutyEtc?: string | null
  dataDate?: string | null
}

// 카테고리 그룹 (헤더, 홈페이지 등에서 공유)
export interface CategoryGroup {
  title: string
  icon: string
  categories: FacilityCategory[]
}

export const CATEGORY_GROUPS: readonly CategoryGroup[] = [
  {
    title: '생활 편의',
    icon: 'home',
    categories: ['toilet', 'wifi', 'parking', 'kiosk'],
  },
  {
    title: '건강/안전',
    icon: 'health_and_safety',
    categories: ['hospital', 'pharmacy', 'aed'],
  },
  {
    title: '문화/환경',
    icon: 'eco',
    categories: ['library', 'clothes', 'trash'],
  },
] as const

// 검색 파라미터
export interface SearchParams {
  keyword?: string
  category?: FacilityCategory
  lat?: number
  lng?: number
  radius?: number
  swLat?: number
  swLng?: number
  neLat?: number
  neLng?: number
  city?: string
  district?: string
  page?: number
  limit?: number
  grouped?: boolean
  sort?: string
}

// 검색 응답
export interface SearchResponse {
  items: Facility[]
  total: number
  page: number
  totalPages: number
}

// 그룹별 검색 응답
export interface GroupedCategory {
  category: FacilityCategory
  label: string
  count: number
  items: Facility[]
}

export interface GroupedSearchResponse {
  categories: GroupedCategory[]
  totalCount: number
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
  shortLabel: string
  icon: string
  color: string
}

export const CATEGORY_META: Record<FacilityCategory, CategoryMeta> = {
  toilet: {
    label: '공공화장실',
    shortLabel: '화장실',
    icon: 'wc',
    color: 'blue',
  },
  trash: {
    label: '쓰레기배출',
    shortLabel: '쓰레기',
    icon: 'delete',
    color: 'red',
  },
  wifi: {
    label: '무료와이파이',
    shortLabel: '와이파이',
    icon: 'wifi',
    color: 'green',
  },
  clothes: {
    label: '의류수거함',
    shortLabel: '의류수거함',
    icon: 'checkroom',
    color: 'purple',
  },
  kiosk: {
    label: '무인민원발급기',
    shortLabel: '발급기',
    icon: 'print',
    color: 'orange',
  },
  parking: {
    label: '공영주차장',
    shortLabel: '주차장',
    icon: 'local_parking',
    color: 'sky',
  },
  aed: {
    label: '자동심장충격기',
    shortLabel: 'AED',
    icon: 'favorite',
    color: 'red',
  },
  library: {
    label: '공공도서관',
    shortLabel: '도서관',
    icon: 'local_library',
    color: 'amber',
  },
  hospital: {
    label: '병원',
    shortLabel: '병원',
    icon: 'local_hospital',
    color: 'teal',
  },
  pharmacy: {
    label: '약국',
    shortLabel: '약국',
    icon: 'local_pharmacy',
    color: 'emerald',
  },
}

// 카테고리별 공공데이터포털 URL 매핑
export const CATEGORY_DATA_PORTAL_URL: Record<FacilityCategory, string> = {
  toilet: 'https://www.data.go.kr/data/15012892/standard.do',
  trash: 'https://www.data.go.kr/data/15155080/openapi.do',
  wifi: 'https://www.data.go.kr/data/15013116/standard.do',
  clothes: 'https://www.data.go.kr/data/15139214/standard.do',
  kiosk: 'https://www.data.go.kr/data/15154774/openapi.do',
  parking: 'https://www.data.go.kr/data/15012896/standard.do',
  aed: 'https://www.data.go.kr/data/15000652/openapi.do',
  library: 'https://www.data.go.kr/data/15013109/standard.do',
  hospital: 'https://www.data.go.kr/data/15001698/openapi.do',
  pharmacy: 'https://www.data.go.kr/data/15000576/openapi.do',
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

// Vue 템플릿용 - 모든 상세 타입의 프로퍼티를 optional로 통합
// 런타임 안전성은 템플릿의 v-if 카테고리 가드가 보장
export type FacilityDetailsAll = ToiletDetails & WifiDetails & ClothesDetails & KioskDetails & ParkingDetails & AedDetails & LibraryDetails & HospitalDetails & PharmacyDetails & TrashDetails
