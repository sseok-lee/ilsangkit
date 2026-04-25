import type { SubscriptionSourceType } from '~/types/subscription'

export type RentGroup = 'apply' | 'lh-announcement'
export type RentDataSource = 'applyhome' | 'lh-announcement'

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
}

export const RENT_TYPES: Record<string, SubscriptionTypeMeta> = {
  public: {
    label: '공공임대',
    icon: 'home',
    iconImg: 'rent',
    description: '공공주택 임대 청약 일정과 정보를 확인하세요.',
    sourceType: 'APT',
    rentType: '임대주택',
    group: 'apply',
    dataSource: 'applyhome',
  },
  private: {
    label: '민간임대',
    icon: 'bungalow',
    iconImg: 'rent',
    description: '공공지원 민간임대 청약 일정과 정보를 확인하세요.',
    sourceType: 'PRIVATE_RENT',
    group: 'apply',
    dataSource: 'applyhome',
  },
  'lh-announcement': {
    label: 'LH 분양/임대 공고',
    icon: 'campaign',
    iconImg: 'rent',
    description: 'LH 가 직접 공급하는 공공분양·공공임대 공고입니다. 청약홈과 별개 공고입니다.',
    group: 'lh-announcement',
    dataSource: 'lh-announcement',
  },
}

export const LH_RENTAL_TYPES: Record<LhRentalTypeKey, LhRentalTypeMeta> = {
  'buy-lease': {
    label: 'LH 매입임대',
    icon: 'apartment',
    iconImg: 'rent',
    description: 'LH 가 기존 주택을 매입해 시세보다 저렴하게 재임대하는 매입임대 매물입니다.',
    rentalTypeCode: '매입임대',
  },
  charter: {
    label: 'LH 전세임대',
    icon: 'key',
    iconImg: 'rent',
    description: 'LH 가 전세보증금을 대신 지원하는 전세임대 매물입니다. 월세 부담이 없습니다.',
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
    description: '청약홈에서 접수하는 공공·민간 임대 청약입니다. 청약통장이 필요할 수 있습니다.',
  },
  'lh-announcement': {
    group: 'lh-announcement',
    heading: 'LH 청약공고',
    description: 'LH 가 직접 공급하는 분양·임대 공고입니다. 청약홈과 별개로 LH 청약센터에서 접수합니다.',
  },
}

export function rentTypesByGroup(group: RentGroup): Array<[string, SubscriptionTypeMeta]> {
  return Object.entries(RENT_TYPES).filter(([, meta]) => meta.group === group)
}

export function getSourceTypeLabel(sourceType: string): string {
  if (sourceType === 'APT') return '아파트'
  if (sourceType === 'OFFITEL') return '오피스텔'
  if (sourceType === 'REMAINING') return '무순위'
  if (sourceType === 'PRIVATE_RENT') return '민간임대'
  return sourceType
}
