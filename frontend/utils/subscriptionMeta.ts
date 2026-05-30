import type { SubscriptionSourceType } from '~/types/subscription'

export type RentGroup = 'apply'
export type RentDataSource = 'applyhome'

export interface SubscriptionTypeMeta {
  label: string
  icon: string
  iconImg?: string
  description: string
  sourceType?: SubscriptionSourceType
  rentType?: string
  group?: RentGroup
  dataSource?: RentDataSource
  rentalTypeCode?: string
}

export type LhRentalTypeKey = 'buy-lease' | 'charter'

export interface LhRentalTypeMeta {
  label: string
  icon: string
  iconImg?: string
  description: string
  rentalTypeCode: '매입임대' | '전세임대'
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

// "공공임대 청약" / "공공지원 민간임대" — 헤더 메뉴의 /public-rental(공공임대 입주, 자격 기반 수시 신청)와
// 어휘 충돌을 피하려 페이지 컨텍스트에 맞게 명확히 구분.
export const RENT_TYPES: Record<string, SubscriptionTypeMeta> = {
  public: {
    label: '공공임대 청약',
    icon: 'home',
    iconImg: 'rent',
    description: '청약통장으로 신청하는 공공임대 청약 일정과 정보를 확인하세요. LH·SH·GH 등 공공기관이 공급하는 임대주택으로 시세보다 저렴하게 거주할 수 있습니다.',
    sourceType: 'APT',
    rentType: '임대주택',
    group: 'apply',
    dataSource: 'applyhome',
  },
  private: {
    label: '공공지원 민간임대',
    icon: 'bungalow',
    iconImg: 'rent',
    description: '공공지원 민간임대 청약 일정과 정보를 확인하세요. 민간 건설사가 공급하지만 임대 보증금 보호와 전월세 상한이 적용됩니다.',
    sourceType: 'PRIVATE_RENT',
    group: 'apply',
    dataSource: 'applyhome',
  },
}

export const LH_RENTAL_TYPES: Record<LhRentalTypeKey, LhRentalTypeMeta> = {
  'buy-lease': {
    label: '매입임대',
    icon: 'apartment',
    iconImg: 'rent',
    description: '공공기관이 기존 주택을 매입해 시세보다 저렴하게 재임대하는 매입임대 매물입니다. 청약통장 없이 소득·자산 기준 충족 시 수시 신청 가능합니다.',
    rentalTypeCode: '매입임대',
  },
  charter: {
    label: '전세임대',
    icon: 'key',
    iconImg: 'rent',
    description: '공공기관이 전세보증금을 대신 지원하는 전세임대 매물입니다. 월세 부담 없이 기존 주택에 거주할 수 있으며 소득 기준 충족 시 신청 가능합니다.',
    rentalTypeCode: '전세임대',
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
    heading: '청약홈 임대 청약',
    description: '청약홈에서 접수하는 공공·민간 임대 청약입니다. 청약통장이 필요할 수 있으며 소득·자산 요건에 따라 신청 가능합니다.',
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
  if (sourceType === 'OPTIONAL') return '임의공급'
  return sourceType
}

// 청약홈 API가 '임대주택' 대신 반환하는 실제 공공임대 rentType 값 (백엔드와 동일)
export const PUBLIC_RENT_TYPES = ['분양전환 가능임대', '분양전환 불가임대']

export interface SubscriptionTypeBadge {
  label: string
  classes: string
  kind: 'sale' | 'rent'
}

/**
 * (sourceType, rentType) → 홈 타임라인 타입 뱃지.
 * 분양 4종은 컬러, 임대 2종(공공/민간)은 회색으로 묶고 라벨로 구분.
 * 색 클래스 문자열은 tailwind content 글롭에 utils 가 포함돼야 purge 되지 않음(별도 Task).
 */
export function subscriptionTypeBadge(
  sourceType: string,
  rentType: string | null,
): SubscriptionTypeBadge {
  if (sourceType === 'OFFITEL') return { label: '오피스텔', classes: 'bg-teal-50 text-teal-700', kind: 'sale' }
  if (sourceType === 'REMAINING') return { label: '무순위·잔여', classes: 'bg-orange-50 text-orange-700', kind: 'sale' }
  if (sourceType === 'OPTIONAL') return { label: '임의공급', classes: 'bg-fuchsia-50 text-fuchsia-700', kind: 'sale' }
  if (sourceType === 'PRIVATE_RENT') return { label: '민간임대', classes: 'bg-slate-100 text-slate-600', kind: 'rent' }
  if (sourceType === 'APT' && rentType != null && PUBLIC_RENT_TYPES.includes(rentType)) {
    return { label: '공공임대', classes: 'bg-slate-100 text-slate-600', kind: 'rent' }
  }
  // APT 분양 (rentType null 또는 분양 rentType)
  return { label: '아파트', classes: 'bg-indigo-50 text-indigo-700', kind: 'sale' }
}
