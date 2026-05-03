/**
 * Category Icons Utility
 * 3D 아이소메트릭 카테고리 아이콘 경로 관리
 */

export type CategoryId = 'toilet' | 'trash' | 'wifi' | 'clothes' | 'parking' | 'aed' | 'library' | 'hospital' | 'pharmacy' | 'park' | 'school' | 'market' | 'childcare' | 'ev-charger' | 'sports'

export const ICON_VERSION = 'v2'

export const CATEGORY_ICONS: Record<CategoryId, string> = {
  toilet: `/icons/category/toilet.webp?${ICON_VERSION}`,
  trash: `/icons/category/trash.webp?${ICON_VERSION}`,
  wifi: `/icons/category/wifi.webp?${ICON_VERSION}`,
  clothes: `/icons/category/clothes.webp?${ICON_VERSION}`,
  parking: `/icons/category/parking.webp?${ICON_VERSION}`,
  aed: `/icons/category/aed.webp?${ICON_VERSION}`,
  library: `/icons/category/library.webp?${ICON_VERSION}`,
  hospital: `/icons/category/hospital.webp?${ICON_VERSION}`,
  pharmacy: `/icons/category/pharmacy.webp?${ICON_VERSION}`,
  park: `/icons/category/park.webp?${ICON_VERSION}`,
  school: `/icons/category/school.webp?${ICON_VERSION}`,
  market: `/icons/category/market.webp?${ICON_VERSION}`,
  childcare: `/icons/category/childcare.webp?${ICON_VERSION}`,
  'ev-charger': `/icons/category/ev-charger.webp?${ICON_VERSION}`,
  sports: `/icons/category/sports.webp?${ICON_VERSION}`,
} as const

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  toilet: '화장실',
  trash: '쓰레기 배출정보',
  wifi: '와이파이',
  clothes: '의류수거함',
  parking: '주차장',
  aed: 'AED',
  library: '도서관',
  hospital: '병원',
  pharmacy: '약국',
  park: '공원',
  school: '학교',
  market: '전통시장',
  childcare: '어린이집',
  'ev-charger': '전기차 충전소',
  sports: '체육시설',
} as const

export const CATEGORY_COLORS: Record<CategoryId, { primary: string; bg: string; bgDark: string }> = {
  toilet: {
    primary: '#8b5cf6',
    bg: 'bg-purple-50',
    bgDark: 'dark:bg-purple-900/20',
  },
  trash: {
    primary: '#10b981',
    bg: 'bg-green-50',
    bgDark: 'dark:bg-green-900/20',
  },
  wifi: {
    primary: '#f59e0b',
    bg: 'bg-orange-50',
    bgDark: 'dark:bg-orange-900/20',
  },
  clothes: {
    primary: '#ec4899',
    bg: 'bg-pink-50',
    bgDark: 'dark:bg-pink-900/20',
  },
  parking: {
    primary: '#0ea5e9',
    bg: 'bg-sky-50',
    bgDark: 'dark:bg-sky-900/20',
  },
  aed: {
    primary: '#ef4444',
    bg: 'bg-red-50',
    bgDark: 'dark:bg-red-900/20',
  },
  library: {
    primary: '#d97706',
    bg: 'bg-amber-50',
    bgDark: 'dark:bg-amber-900/20',
  },
  hospital: {
    primary: '#14b8a6',
    bg: 'bg-teal-50',
    bgDark: 'dark:bg-teal-900/20',
  },
  pharmacy: {
    primary: '#10b981',
    bg: 'bg-emerald-50',
    bgDark: 'dark:bg-emerald-900/20',
  },
  park: {
    primary: '#22c55e',
    bg: 'bg-green-50',
    bgDark: 'dark:bg-green-900/20',
  },
  school: {
    primary: '#6366f1',
    bg: 'bg-indigo-50',
    bgDark: 'dark:bg-indigo-900/20',
  },
  market: {
    primary: '#f97316',
    bg: 'bg-orange-50',
    bgDark: 'dark:bg-orange-900/20',
  },
  childcare: {
    primary: '#ec4899',
    bg: 'bg-pink-50',
    bgDark: 'dark:bg-pink-900/20',
  },
  'ev-charger': {
    primary: '#14b8a6',
    bg: 'bg-teal-50',
    bgDark: 'dark:bg-teal-900/20',
  },
  sports: {
    primary: '#06b6d4',
    bg: 'bg-cyan-50',
    bgDark: 'dark:bg-cyan-900/20',
  },
} as const

/**
 * 카테고리 아이콘 경로 반환
 */
export function getCategoryIcon(categoryId: CategoryId): string {
  return CATEGORY_ICONS[categoryId] || CATEGORY_ICONS.toilet
}

/**
 * 카테고리 라벨 반환
 */
export function getCategoryLabel(categoryId: CategoryId): string {
  return CATEGORY_LABELS[categoryId] || '알 수 없음'
}

/**
 * 카테고리 색상 정보 반환
 */
export function getCategoryColor(categoryId: CategoryId) {
  return CATEGORY_COLORS[categoryId] || CATEGORY_COLORS.toilet
}
