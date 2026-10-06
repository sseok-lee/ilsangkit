import type { SubscriptionSourceType } from '~/types/subscription'

export type RentGroup = 'apply'
export type RentDataSource = 'integrated'

export interface SubscriptionTypeMeta {
  label: string
  icon: string
  iconImg?: string
  description: string
  sourceType?: SubscriptionSourceType
  rentType?: string
  group?: RentGroup
  dataSource?: RentDataSource
}

export const SALE_TYPES: Record<string, SubscriptionTypeMeta> = {
  apt: {
    label: '아파트',
    icon: 'apartment',
    iconImg: 'apt',
    description: '민영·국민주택 아파트 분양 청약 일정과 정보를 확인하세요.',
    sourceType: 'APT',
  },
  offitel: {
    label: '오피스텔·도시형',
    icon: 'domain',
    iconImg: 'offitel',
    description: '오피스텔, 도시형생활주택, 생활숙박시설 분양 청약 정보를 확인하세요.',
    sourceType: 'OFFITEL',
  },
  remaining: {
    label: '무순위·잔여세대',
    icon: 'home_work',
    iconImg: 'subscription',
    description: '무순위 및 잔여세대 청약 정보를 확인하세요. 청약통장 없이도 신청 가능합니다.',
    sourceType: 'REMAINING',
  },
  optional: {
    label: '임의공급',
    icon: 'redeem',
    iconImg: 'subscription',
    description: '청약 1·2순위 절차 없이 추첨·접수로 공급되는 임의공급 분양 정보입니다. 미분양 처리·특수목적 공급 등에서 활용됩니다.',
    sourceType: 'OPTIONAL',
  },
}

export const RENT_TYPES: Record<string, SubscriptionTypeMeta> = {
  public: {
    label: '공공임대 청약',
    icon: 'home',
    iconImg: 'rent',
    description: '청약홈·마이홈·LH 공공임대 모집공고를 함께 확인하세요. 국민임대, 행복주택, 매입임대 등 공공기관 임대주택의 모집기간과 공급조건을 비교할 수 있습니다.',
    rentType: '임대주택',
    group: 'apply',
    dataSource: 'integrated',
  },
  private: {
    label: '공공지원 민간임대',
    icon: 'bungalow',
    iconImg: 'rent',
    description: '공공지원 민간임대 청약 일정과 정보를 확인하세요. 민간 건설사가 공급하지만 임대 보증금 보호와 전월세 상한이 적용됩니다.',
    sourceType: 'PRIVATE_RENT',
    group: 'apply',
    dataSource: 'integrated',
  },
}

export interface RentGroupMeta {
  group: RentGroup
  heading: string
  description: string
}

export const RENT_GROUP_META: Record<RentGroup, RentGroupMeta> = {
  apply: {
    group: 'apply',
    heading: '임대주택 모집공고',
    description: '청약홈·마이홈·LH 등 여러 공공·민간 임대 모집공고를 모아 보여줍니다. 공고별 신청 자격과 접수 방법은 원문에서 확인하세요.',
  },
}

export const SUBSCRIPTION_HUB_DESCRIPTION =
  '아파트·오피스텔 분양, 무순위·잔여세대, 공공·민간 임대까지 모든 청약 일정과 정보를 한눈에 확인하세요. 청약 접수 상태와 공급 규모를 비교해 내 조건에 맞는 청약을 빠르게 찾아보세요.'

export function rentTypesByGroup(group: RentGroup): Array<[string, SubscriptionTypeMeta]> {
  return Object.entries(RENT_TYPES).filter(([, meta]) => meta.group === group)
}

export function getSourceTypeLabel(sourceType: string): string {
  if (sourceType === 'APT') return '아파트'
  if (sourceType === 'OFFITEL') return '오피스텔'
  if (sourceType === 'REMAINING') return '무순위'
  if (sourceType === 'PRIVATE_RENT') return '공공지원 민간임대'
  if (sourceType === 'PUBLIC_RENT') return '공공임대'
  if (sourceType === 'OPTIONAL') return '임의공급'
  return sourceType
}

// 청약홈/백엔드가 공공임대에 사용하는 rentType 값
export const PUBLIC_RENT_TYPES: readonly string[] = ['임대주택', '분양전환 가능임대', '분양전환 불가임대']

export interface SubscriptionTypeBadge {
  label: string
  classes: string
  kind: 'sale' | 'rent'
}

/**
 * (sourceType, rentType) → 홈 타임라인 타입 뱃지.
 * 분양 4종은 컬러, 임대 2종(공공/민간)은 회색으로 묶고 라벨로 구분.
 */
// NOTE: 색 클래스가 purge 되지 않으려면 tailwind.config content 글롭에 './utils/**' 필요 (다음 Task에서 추가).
export function subscriptionTypeBadge(
  sourceType: string,
  rentType: string | null,
): SubscriptionTypeBadge {
  if (sourceType === 'OFFITEL') return { label: '오피스텔', classes: 'bg-teal-50 text-teal-700', kind: 'sale' }
  // 타임라인 칩용 압축 라벨 (의도적: getSourceTypeLabel '무순위'와 다름)
  if (sourceType === 'REMAINING') return { label: '무순위·잔여', classes: 'bg-orange-50 text-orange-700', kind: 'sale' }
  if (sourceType === 'OPTIONAL') return { label: '임의공급', classes: 'bg-fuchsia-50 text-fuchsia-700', kind: 'sale' }
  if (sourceType === 'PRIVATE_RENT') return { label: '민간임대', classes: 'bg-background-light text-muted', kind: 'rent' }
  if (sourceType === 'PUBLIC_RENT') return { label: '공공임대', classes: 'bg-background-light text-muted', kind: 'rent' }
  if (sourceType === 'APT' && rentType != null && PUBLIC_RENT_TYPES.includes(rentType)) {
    return { label: '공공임대', classes: 'bg-background-light text-muted', kind: 'rent' }
  }
  // APT 분양 (rentType null 또는 분양 rentType)
  return { label: '아파트', classes: 'bg-indigo-50 text-indigo-700', kind: 'sale' }
}

/**
 * 청약 상세 SEO 제목.
 *
 * 같은 단지가 회차별로 여러 번 공고를 낸다(성산 삼정그린코아 웰레스트 16회,
 * 서울은평뉴타운 디에트르 더 퍼스트 29회). 제목이 단지명뿐이면 그 회차들이 전부
 * 같은 제목으로 나간다 — 2026-08 실측으로 5,671건 중 1,405건(24.8%)이 그랬고,
 * 네이버 중복 title 진단에 잡히는 라이브 버킷이었다.
 *
 * 접수 연월을 넣으면 잔여 중복이 63건(-95.5%)까지 떨어진다. 연월일·공급호수까지
 * 넣으면 11~17건이 되지만 제목이 길어져 SERP 에서 잘린다.
 *
 * 중복인 공고에만 붙이지 않고 항상 붙이는 이유: 상세 API 는 자기 레코드만 주므로
 * 같은 이름의 다른 공고가 몇 건인지 프론트가 알 수 없다. 조건부로 하려면 백엔드에
 * 중복 카운트를 실어야 하는데 문제 크기에 비해 과하다.
 */
export function buildSubscriptionSeoTitle(input: {
  houseName?: string | null
  receptionStartDate?: string | Date | null
}): string {
  const houseName = (input.houseName ?? '').trim()
  // 단지명이 없으면 빈 문자열. "청약 일정" 같은 공용 문구를 만들어내면
  // 전체 상세가 같은 제목으로 나가는 상황이 재현된다(2026-07-28 SSR 열화 사고).
  if (!houseName) return ''

  const base = `${houseName} 청약 일정·경쟁률`
  const raw = input.receptionStartDate
  if (!raw) return base

  const d = raw instanceof Date ? raw : new Date(raw)
  if (Number.isNaN(d.getTime())) return base

  // 접수일은 시각 없는 날짜가 UTC 자정으로 직렬화돼 온다. 로컬 타임존으로 읽으면
  // KST 기준 하루 앞으로 밀려 월 경계에서 회차가 어긋난다(2023-07-01 → 6월).
  // 그래서 UTC 필드를 그대로 쓴다.
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1

  return `${houseName} ${year}년 ${month}월 접수 청약 일정·경쟁률`
}
