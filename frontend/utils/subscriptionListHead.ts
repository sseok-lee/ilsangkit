import type { CityData } from '~/composables/useRegions'
import type { SubscriptionListScope } from '~/types/subscriptionList'
import { SITE_URL } from '~/utils/seoConstants'
import { normalizeSubscriptionQuery } from '~/utils/subscriptionListQuery'

type QueryInput = Record<string, string | null | (string | null | undefined)[] | undefined>

function firstQueryValue(value: QueryInput[string]): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

export function isSubscriptionListQueryFiltered(
  query: QueryInput,
  scope: SubscriptionListScope,
  cities: CityData[] = [],
): boolean {
  const normalized = normalizeSubscriptionQuery(query, scope, cities)
  if (normalized.keywordError) return true
  if (Object.keys(normalized.query).length > 0) return true

  // Region filters must not broaden to an indexable base listing when the page
  // cannot verify the region dictionary yet or the supplied region is invalid.
  return Boolean(firstQueryValue(query.city) || firstQueryValue(query.district))
}

export function subscriptionListHead(
  path: string,
  filtered: boolean,
): { meta: Array<{ name: string; content: string }>; link: Array<{ rel: string; href: string; key: string }> } {
  const normalizedPath = path.length > 1 ? path.replace(/\/+$/, '') : path
  if (filtered) {
    return {
      meta: [{ name: 'robots', content: 'noindex, follow' }],
      link: [],
    }
  }

  return {
    meta: [{ name: 'robots', content: 'index, follow' }],
    link: [{ rel: 'canonical', href: `${SITE_URL}${normalizedPath}`, key: 'canonical' }],
  }
}
