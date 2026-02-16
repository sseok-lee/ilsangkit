/**
 * Category Icons Utility
 * 3D 아이소메트릭 카테고리 아이콘 경로 관리
 */

export type CategoryId = 'toilet' | 'trash' | 'wifi' | 'clothes' | 'kiosk' | 'parking' | 'aed' | 'library' | 'hospital' | 'pharmacy'

export const CATEGORY_ICONS: Record<CategoryId, string> = {
  toilet: '/icons/category/toilet.webp',
  trash: '/icons/category/trash.webp',
  wifi: '/icons/category/wifi.webp',
  clothes: '/icons/category/clothes.webp',
  kiosk: '/icons/category/kiosk.webp',
  parking: '/icons/category/parking.webp',
  aed: '/icons/category/aed.webp',
  library: '/icons/category/library.webp',
  hospital: '/icons/category/hospital.webp',
  pharmacy: '/icons/category/pharmacy.webp',
} as const

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  toilet: '화장실',
  trash: '쓰레기',
  wifi: '와이파이',
  clothes: '의류수거함',
  kiosk: '발급기',
  parking: '주차장',
  aed: 'AED',
  library: '도서관',
  hospital: '병원',
  pharmacy: '약국',
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
  kiosk: {
    primary: '#6366f1',
    bg: 'bg-indigo-50',
    bgDark: 'dark:bg-indigo-900/20',
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
