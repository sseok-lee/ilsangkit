import { getOperatingStatus, type OperatingStatus } from '~/utils/facilityStatus'
import type { FacilityCategory, FacilityDetail } from '~/types/facility'

const CATEGORIES_WITHOUT_STATUS_BADGE = new Set<FacilityCategory>([
  'wifi',
  'clothes',
  'parking',
  'ev-charger',
  'subway',
])

/**
 * Returns operating status for the hero badge, or null for categories without
 * meaningful open/closed semantics (wifi, clothes, parking, ev-charger, subway).
 * For hospital, mirrors `details.trmt*` into `extras` so getOperatingStatus
 * (which reads from `extras` for the hospital branch) can find the times.
 */
export function buildHeroBadge(facility: FacilityDetail): OperatingStatus {
  if (CATEGORIES_WITHOUT_STATUS_BADGE.has(facility.category)) return null

  // getOperatingStatus reads `extras.trmt*Start/End` for hospital, but FacilityDetail
  // keeps those fields in `details`. Mirror the data so the hospital branch finds them.
  const normalized = facility.category === 'hospital'
    ? { ...facility, extras: facility.details }
    : facility

  return getOperatingStatus(normalized as unknown as Record<string, unknown>)
}

// PageHero가 export하는 타입과 동일한 형태를 로컬에 재선언.
// Vitest+Nuxt에서 SFC 타입 import 회피용. 컴파일 시 호환성은 page.vue에서 동시 import로 검증됨.
export interface HeroActionMenuItem {
  label: string
  href: string
  iconSrc?: string
}

export interface HeroAction {
  type: 'directions' | 'phone' | 'share'
  label: string
  href?: string
  primary?: boolean
  menu?: HeroActionMenuItem[]
}

export interface HeroActionContext {
  kakaoMapUrl: string
  naverMapUrl: string
}

function pickPhone(facility: FacilityDetail): string | null {
  const phone = (facility as unknown as { phone?: string | null }).phone
  if (!phone || !phone.trim()) return null
  return phone.trim()
}

/**
 * Builds the action button list for the hero CTA row.
 * - Directions is always present (primary) with a kakao+naver dropdown menu.
 * - Phone is inserted between directions and share only when facility.phone is non-empty.
 * - Share is always present and emits a click event (no href/menu).
 */
export function buildHeroActions(
  facility: FacilityDetail,
  ctx: HeroActionContext,
): HeroAction[] {
  const actions: HeroAction[] = [
    {
      type: 'directions',
      label: '길찾기',
      primary: true,
      menu: [
        { label: '카카오맵으로 길찾기', href: ctx.kakaoMapUrl, iconSrc: '/images/icons/kakaomap.svg' },
        { label: '네이버맵으로 길찾기', href: ctx.naverMapUrl, iconSrc: '/images/icons/navermap.svg' },
      ],
    },
  ]
  const phone = pickPhone(facility)
  if (phone) {
    actions.push({ type: 'phone', label: '전화', href: `tel:${phone}` })
  }
  actions.push({ type: 'share', label: '공유' })
  return actions
}
