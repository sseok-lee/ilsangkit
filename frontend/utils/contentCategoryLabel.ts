import { CATEGORY_META } from '~/types/facility'
import { REAL_ESTATE_META } from '~/utils/realEstateMeta'

// 삭제된/구 콘텐츠 카테고리 slug. CATEGORY_META·REAL_ESTATE_META 어디에도 없어
// 매핑 없이는 raw slug가 그대로 노출된다.
const LEGACY_CONTENT_LABELS: Record<string, string> = {
  'public-rental': '매입임대',
  sale: '분양',
  rent: '임대',
}

/**
 * 콘텐츠(가이드·기사) 카테고리 slug → 한글 라벨.
 * article/guide 4개 페이지(목록·상세)가 공유하는 단일 소스.
 * 미지정 slug는 raw 노출 대신 안전 폴백('생활정보')을 반환한다.
 */
export function getContentCategoryLabel(category: string): string {
  if (category === 'apt-sale' || category === 'apt-rent') return '부동산'
  if (category === 'subscription') return '청약/임대'
  const facilityLabel = CATEGORY_META[category as keyof typeof CATEGORY_META]?.label
  if (facilityLabel) return facilityLabel
  const camelKey = category.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  const reLabel = REAL_ESTATE_META[camelKey as keyof typeof REAL_ESTATE_META]?.label
  if (reLabel) return reLabel
  if (LEGACY_CONTENT_LABELS[category]) return LEGACY_CONTENT_LABELS[category]
  return '생활정보'
}
