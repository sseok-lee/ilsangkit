import { computed, readonly } from 'vue'
import type { Subscription } from '~/types/subscription'
import type { SubscriptionListResponse } from '~/composables/useSubscription'
import { useSubscription } from '~/composables/useSubscription'
import { markDegradedResponse } from '~/composables/useDegradedResponse'

export interface SubscriptionHubPanel {
  items: Subscription[]
  total: number | null
  error: boolean
}

interface SubscriptionHubResult {
  sale: SubscriptionHubPanel
  publicRent: SubscriptionHubPanel
  upcoming: SubscriptionHubPanel
}

export const hubRequests = [
  { category: 'sale', status: 'ongoing', sort: 'deadline', page: 1, limit: 4 },
  { category: 'rent', rentType: '임대주택', status: 'ongoing', sort: 'deadline', page: 1, limit: 4 },
  { status: 'upcoming', sort: 'startSoon', page: 1, limit: 4 },
] as const

function emptyPanel(error = false): SubscriptionHubPanel {
  return {
    items: [],
    total: error ? null : 0,
    error,
  }
}

function panelFromSettled(result: PromiseSettledResult<SubscriptionListResponse>): SubscriptionHubPanel {
  if (result.status === 'rejected') return emptyPanel(true)
  return {
    items: result.value.items,
    total: result.value.total,
    error: false,
  }
}

function defaultHub(): SubscriptionHubResult {
  return {
    sale: emptyPanel(),
    publicRent: emptyPanel(),
    upcoming: emptyPanel(),
  }
}

export async function useSubscriptionHub() {
  const nuxtApp = import.meta.server ? useNuxtApp() : null
  const { getSubscriptionList } = useSubscription()

  const asyncState = await useAsyncData<SubscriptionHubResult>('subscription-hub-v2', async () => {
    const results = await Promise.allSettled(
      hubRequests.map(params => getSubscriptionList(params)),
    )

    return {
      sale: panelFromSettled(results[0]),
      publicRent: panelFromSettled(results[1]),
      upcoming: panelFromSettled(results[2]),
    }
  })

  const hub = computed(() => asyncState.data.value ?? defaultHub())
  const sale = computed(() => hub.value.sale)
  const publicRent = computed(() => hub.value.publicRent)
  const upcoming = computed(() => hub.value.upcoming)
  const hasPartialFailure = computed(() =>
    sale.value.error || publicRent.value.error || upcoming.value.error
  )

  if (import.meta.server && hasPartialFailure.value) {
    nuxtApp?.runWithContext(() => markDegradedResponse())
  }

  return {
    sale: readonly(sale),
    publicRent: readonly(publicRent),
    upcoming: readonly(upcoming),
    pending: readonly(asyncState.pending),
    refresh: asyncState.refresh,
  }
}
