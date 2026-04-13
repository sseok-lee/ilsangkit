import type { SubscriptionSourceType } from '~/types/subscription'

export interface SubscriptionTypeMeta {
  label: string
  icon: string
  iconImg?: string
  description: string
  sourceType?: SubscriptionSourceType
  rentType?: string
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
  },
  private: {
    label: '민간임대',
    icon: 'bungalow',
    iconImg: 'rent',
    description: '공공지원 민간임대 청약 일정과 정보를 확인하세요.',
    sourceType: 'PRIVATE_RENT',
  },
}

export function getSourceTypeLabel(sourceType: string): string {
  if (sourceType === 'APT') return '아파트'
  if (sourceType === 'OFFITEL') return '오피스텔'
  if (sourceType === 'REMAINING') return '무순위'
  if (sourceType === 'PRIVATE_RENT') return '민간임대'
  return sourceType
}
