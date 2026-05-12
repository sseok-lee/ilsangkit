import { getOperatingStatus, type OperatingStatus } from '~/utils/facilityStatus'
import { formatOperatingHours } from '~/utils/formatOperatingHours'
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
  const d = facility.details as Record<string, unknown> | undefined
  const extras = (facility as unknown as { extras?: Record<string, unknown> }).extras
  const candidates: unknown[] = [
    d?.phoneNumber,   // toilet, wifi, clothes, library, park, school, market
    d?.phone,         // parking, hospital, pharmacy
    d?.telno,         // hospital (legacy alias)
    d?.crtelno,       // childcare
    d?.clerkTel,      // AED
    d?.busiCall,      // ev-charger
    extras?.phoneNumber, // school (when surfaced via extras)
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return null
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
    const sanitized = phone.replace(/[^0-9+\-]/g, '')
    if (sanitized) {
      actions.push({ type: 'phone', label: '전화', href: `tel:${sanitized}` })
    }
  }
  actions.push({ type: 'share', label: '공유' })
  return actions
}

export interface HeroStat {
  label: string
  value: string
  color?: string
}

const MAX_STATS = 3

/**
 * Builds the hero stats grid (max 3 entries) for a facility.
 * Per-category labels mirror the current page logic. Phone fields are
 * intentionally omitted — phone now lives in the CTA row via buildHeroActions.
 */
export function buildHeroStats(facility: FacilityDetail): HeroStat[] {
  const cat = facility.category
  const d = (facility as unknown as { details?: Record<string, any> }).details ?? {}
  const items: HeroStat[] = []

  const is24h = d.operatingHours === '24시간' || d.is24Hour === true
  const showOperatingTopline = !['hospital', 'pharmacy', 'aed', 'library', 'parking'].includes(cat)

  if (is24h) {
    items.push({ label: '운영', value: '24시간' })
  } else if (d.operatingHours && showOperatingTopline) {
    items.push({ label: '운영시간', value: formatOperatingHours(d.operatingHours).split('\n')[0] })
  }

  if (cat === 'hospital') {
    if (d.clCdNm) items.push({ label: '종별', value: d.clCdNm })
    if (d.drTotCnt) items.push({ label: '의사', value: `${d.drTotCnt}명` })
    if (d.parkQty != null) items.push({ label: '주차', value: d.parkQty > 0 ? `${d.parkQty}대` : '불가' })
  } else if (cat === 'parking') {
    if (d.capacity) items.push({ label: '주차면수', value: `${d.capacity}면` })
    if (d.feeType) items.push({ label: '요금', value: d.feeType })
    if (d.lotType) items.push({ label: '구분', value: d.lotType })
  } else if (cat === 'library') {
    if (d.seatCount) items.push({ label: '좌석', value: `${Number(d.seatCount).toLocaleString()}석` })
    if (d.bookCount) items.push({ label: '장서', value: `${Number(d.bookCount).toLocaleString()}권` })
  } else if (cat === 'aed') {
    const trim = (s: string) => s.replace(/^[-\s]+|[-\s]+$/g, '').trim()
    if (d.buildPlace) {
      const v = trim(d.buildPlace)
      if (v) items.push({ label: '설치위치', value: v })
    }
    if (d.org) {
      const v = trim(d.org)
      if (v) items.push({ label: '관리기관', value: v })
    }
  } else if (cat === 'childcare') {
    if (d.crcapat) items.push({ label: '정원', value: `${d.crcapat}명` })
    if (d.crchcnt != null) items.push({ label: '현원', value: `${d.crchcnt}명` })
  } else if (cat === 'park') {
    if (d.parkType) items.push({ label: '공원유형', value: d.parkType })
    if (d.area != null) items.push({ label: '면적', value: `${Number(d.area).toLocaleString()}㎡` })
  } else if (cat === 'market') {
    if (d.marketType) items.push({ label: '시장유형', value: d.marketType })
    if (d.storeCount != null) items.push({ label: '점포수', value: `${d.storeCount}개` })
  } else if (cat === 'school') {
    if (d.schoolLevel) items.push({ label: '학교급', value: d.schoolLevel })
    if (d.foundationType) items.push({ label: '설립형태', value: d.foundationType })
    if (d.coeducationType) items.push({ label: '남녀공학', value: d.coeducationType })
  } else if (cat === 'sports') {
    if (d.faciGbNm) items.push({ label: '시설구분', value: d.faciGbNm })
    if (d.ftypeNm) items.push({ label: '유형', value: d.ftypeNm })
  } else if (cat === 'toilet') {
    const openTimeRaw = (d.openTime || '').toString().trim()
    if (openTimeRaw === '상시' && !is24h) {
      items.push({ label: '개방', value: '상시' })
    }
    if (d.hasCCTV) items.push({ label: 'CCTV', value: '있음' })
    if (d.hasDisabledToilet) items.push({ label: '장애인', value: '가능' })
    if (d.hasDiaperChangingTable) items.push({ label: '기저귀대', value: '있음' })
  } else if (cat === 'wifi') {
    if (d.ssid) items.push({ label: 'SSID', value: d.ssid })
  } else if (cat === 'ev-charger') {
    const chargers = (d.chargers || []) as Array<{ chgerType?: string }>
    if (chargers.length > 0) {
      const fast = chargers.filter(c => c.chgerType === '01' || c.chgerType === '03').length
      const slow = chargers.length - fast
      items.push({ label: '충전기', value: `${chargers.length}대` })
      if (fast > 0 || slow > 0) items.push({ label: '구성', value: `급속 ${fast} · 완속 ${slow}` })
    }
  }

  return items.slice(0, MAX_STATS)
}
