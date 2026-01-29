// 시설 카테고리
export type FacilityCategory = 'toilet' | 'wifi' | 'clothes' | 'kiosk'

// 시설 정보
export interface Facility {
  id: string
  name: string
  category: FacilityCategory
  address: string
  lat: number
  lng: number
  distance?: number
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
