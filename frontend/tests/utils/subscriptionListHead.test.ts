import { describe, expect, it } from 'vitest'
import { SITE_URL } from '~/utils/seoConstants'
import { isSubscriptionListQueryFiltered, subscriptionListHead } from '~/utils/subscriptionListHead'

describe('subscriptionListHead', () => {
  it('suppresses canonical only on filtered listings', () => {
    const filtered = subscriptionListHead('/subscription/rent', true)
    expect(filtered.meta).toContainEqual({ name: 'robots', content: 'noindex, follow' })
    expect(filtered.link).toEqual([])
    expect(subscriptionListHead('/subscription/rent', false).link)
      .toContainEqual({ rel: 'canonical', href: `${SITE_URL}/subscription/rent`, key: 'canonical' })
  })

  it('normalizes trailing slashes for canonical URLs', () => {
    expect(subscriptionListHead('/subscription/sale/apt/', false).link).toEqual([
      { rel: 'canonical', href: `${SITE_URL}/subscription/sale/apt`, key: 'canonical' },
    ])
  })
})


describe('isSubscriptionListQueryFiltered', () => {
  it('treats default-valued and invalid normalizable queries as unfiltered', () => {
    expect(isSubscriptionListQueryFiltered({ status: 'all' }, { category: 'sale' })).toBe(false)
    expect(isSubscriptionListQueryFiltered({ sort: 'priority' }, { category: 'rent' })).toBe(false)
    expect(isSubscriptionListQueryFiltered({ status: 'unknown' }, { category: 'sale' })).toBe(false)
    expect(isSubscriptionListQueryFiltered({ status: 'unknown' }, { category: 'rent', type: 'private', sourceType: 'PRIVATE_RENT' })).toBe(false)
    expect(isSubscriptionListQueryFiltered({ status: 'nonsense', sort: 'bad' }, { category: 'sale' })).toBe(false)
  })

  it('keeps real filters, oversized keywords, and unverified regions filtered', () => {
    expect(isSubscriptionListQueryFiltered({ status: 'ongoing' }, { category: 'sale' })).toBe(true)
    expect(isSubscriptionListQueryFiltered({ sort: 'deadline' }, { category: 'rent' })).toBe(true)
    expect(isSubscriptionListQueryFiltered({ status: 'unknown' }, { category: 'rent', type: 'public', rentType: '임대주택' })).toBe(true)
    expect(isSubscriptionListQueryFiltered({ q: '가'.repeat(101) }, { category: 'sale' })).toBe(true)
    expect(isSubscriptionListQueryFiltered({ city: '서울특별시' }, { category: 'sale' })).toBe(true)
  })
})
