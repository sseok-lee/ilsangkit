import type { Subscription, SubscriptionSourceType } from '~/types/subscription'

export type SubscriptionStatus = Subscription['status']
export type SubscriptionApiSort = 'announcement' | 'deadline' | 'startSoon' | 'priority' | 'recent'
export type SubscriptionListSort = 'priority' | 'deadline' | 'recent'

export interface SubscriptionListScope {
  category: 'sale' | 'rent'
  type?: string
  sourceType?: SubscriptionSourceType
  rentType?: string
}

export interface SubscriptionListFilters {
  q: string
  city: string
  district: string
  status: SubscriptionStatus | 'all'
  sort: SubscriptionListSort
}

export interface SubscriptionListSnapshot {
  key: string
  historyId: string
  items: Subscription[]
  total: number
  page: number
  totalPages: number
  scrollY: number
  firstFetchedAt: number
  kstDay: string
}
