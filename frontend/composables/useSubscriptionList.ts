import { computed, getCurrentInstance, getCurrentScope, nextTick, onMounted, onScopeDispose, readonly, ref, unref, watch } from 'vue'
import type { MaybeRef } from 'vue'
import type { LocationQueryRaw } from 'vue-router'
import type { SubscriptionListResponse } from '~/composables/useSubscription'
import type { Subscription } from '~/types/subscription'
import type { SubscriptionListFilters, SubscriptionListScope } from '~/types/subscriptionList'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { useRegions } from '~/composables/useRegions'
import { useSubscription } from '~/composables/useSubscription'
import {
  normalizeSubscriptionQuery,
  subscriptionApiParams,
  subscriptionListKey,
} from '~/utils/subscriptionListQuery'
import {
  getSubscriptionListKstDay,
  useSubscriptionListRestore,
} from '~/utils/subscriptionListRestore'

const DEFAULT_FILTERS: SubscriptionListFilters = {
  q: '',
  city: '',
  district: '',
  status: 'all',
  sort: 'priority',
}

const HISTORY_KEY = 'ilsangkitSubscriptionEntry'
const RETURN_KEY = 'ilsangkitSubscriptionReturn'
const REGION_LOAD_ERROR = '지역 정보를 불러오지 못했습니다.'
const LIST_LOAD_ERROR = '청약 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'

function errorMessage(error: unknown): string {
  if (isAbortError(error)) return ''
  return LIST_LOAD_ERROR
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function firstQueryString(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

function hasRegionalQuery(query: Record<string, unknown>): boolean {
  return Boolean(firstQueryString(query.city) || firstQueryString(query.district))
}

function scopeSignature(scope: SubscriptionListScope): string {
  return [scope.category, scope.type ?? '', scope.sourceType ?? '', scope.rentType ?? ''].join(':')
}

function comparableQuery(query: Record<string, unknown>): Record<string, string> {
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(query)) {
    const first = firstQueryString(value)
    if (first) next[key] = first
  }
  return next
}

function queriesMatch(left: Record<string, unknown>, right: Record<string, string>): boolean {
  return JSON.stringify(comparableQuery(left)) === JSON.stringify(right)
}

function historyId(): string {
  if (typeof window === 'undefined') return ''

  const currentState = window.history.state && typeof window.history.state === 'object'
    ? window.history.state
    : {}
  const existing = currentState[HISTORY_KEY]
  if (typeof existing === 'string' && existing) return existing

  const nextId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  window.history.replaceState({ ...currentState, [HISTORY_KEY]: nextId }, '')
  return nextId
}

function consumeDetailReturnMarker(): boolean {
  if (!import.meta.client && typeof window === 'undefined') return false
  const currentState = window.history.state && typeof window.history.state === 'object'
    ? window.history.state
    : {}
  if (currentState[RETURN_KEY] !== true) return false

  const nextState = { ...currentState }
  delete nextState[RETURN_KEY]
  window.history.replaceState(nextState, '')
  return true
}

function markDetailReturnHistory(): void {
  if (!import.meta.client && typeof window === 'undefined') return
  const currentState = window.history.state && typeof window.history.state === 'object'
    ? window.history.state
    : {}
  window.history.replaceState({ ...currentState, [RETURN_KEY]: true }, '')
}

export async function useSubscriptionList(scope: MaybeRef<SubscriptionListScope>) {
  const route = useRoute()
  const router = useRouter()
  const nuxtApp = useNuxtApp()
  const regions = useRegions()
  const { getSubscriptionList } = useSubscription()
  const restoreCache = useSubscriptionListRestore()
  let shouldAttemptDetailRestore = consumeDetailReturnMarker()

  const scopeValue = computed(() => unref(scope))
  const filters = ref<SubscriptionListFilters>({ ...DEFAULT_FILTERS })
  const items = ref<Subscription[]>([])
  const total = ref(0)
  const page = ref(1)
  const totalPages = ref(0)
  const pending = ref(false)
  const pendingMore = ref(false)
  const error = ref<string | null>(null)
  const moreError = ref<string | null>(null)
  const keywordError = ref<string | null>(null)
  const regionError = ref<string | null>(null)
  const firstFetchedAt = ref<number | null>(null)
  const currentKey = ref('')

  let generation = 0
  let controller: AbortController | undefined
  let lastAsyncDataKey = ''
  let regionsReady = false
  let disposed = false
  let handledSignature = ''
  let activeSync: { signature: string; promise: Promise<void> } | null = null
  let suppressedWatcherSignature = ''
  let mounted = !getCurrentInstance()
  let pendingResultsStartScroll = false
  let pendingResultsStartScrollGeneration = 0
  let pendingResultsStartScrollKey = ''
  let stopResultsStartScrollHooks: Array<() => void> = []
  let resultsStartScrollFrame = 0
  let resultsStartScrollSecondFrame = 0

  if (!mounted) {
    onMounted(() => {
      mounted = true
      if (!pendingResultsStartScroll) return
      const expectedGeneration = pendingResultsStartScrollGeneration
      const expectedKey = pendingResultsStartScrollKey
      pendingResultsStartScroll = false
      pendingResultsStartScrollGeneration = 0
      pendingResultsStartScrollKey = ''
      queueResultsStartScrollAfterNavigation(expectedGeneration, expectedKey)
    })
  }

  function markDegraded(): void {
    nuxtApp.runWithContext(() => markDegradedResponse())
  }

  function currentSignature(): string {
    return `${scopeSignature(scopeValue.value)}|${JSON.stringify(route.query)}`
  }

  async function loadRegionDictionary(): Promise<boolean> {
    const loadedRegions = await nuxtApp.runWithContext(() => regions.loadRegions(hasRegionalQuery(route.query)))
    regionsReady = loadedRegions.length > 0 || regions.isLoaded.value
    return regionsReady
  }

  function normalizeFromRouteQuery(query: typeof route.query) {
    const normalized = normalizeSubscriptionQuery(
      query,
      scopeValue.value,
      regionsReady ? regions.citiesWithDistricts.value : [],
    )
    if (!regionsReady && hasRegionalQuery(query)) {
      normalized.filters.city = firstQueryString(query.city)
      normalized.filters.district = firstQueryString(query.district)
    }
    return normalized
  }

  function applyReplaceResult(result: SubscriptionListResponse, fetchedAt = Date.now()): void {
    items.value = result.items
    total.value = result.total
    page.value = result.page
    totalPages.value = result.totalPages
    firstFetchedAt.value = fetchedAt
    error.value = null
    moreError.value = null
  }

  function scrollToResultsStart(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    const target = document.querySelector<HTMLElement>('#subscription-results')
    if (target) {
      target.scrollIntoView({ block: 'start' })
      return
    }
    window.scrollTo({ top: 0 })
  }

  function stopQueuedResultsStartScrollHooks(): void {
    for (const stopHook of stopResultsStartScrollHooks) stopHook()
    stopResultsStartScrollHooks = []
  }

  function cancelQueuedResultsStartScroll(): void {
    stopQueuedResultsStartScrollHooks()
    pendingResultsStartScroll = false
    pendingResultsStartScrollGeneration = 0
    pendingResultsStartScrollKey = ''
    if (typeof window === 'undefined') return
    if (resultsStartScrollFrame) window.cancelAnimationFrame(resultsStartScrollFrame)
    if (resultsStartScrollSecondFrame) window.cancelAnimationFrame(resultsStartScrollSecondFrame)
    resultsStartScrollFrame = 0
    resultsStartScrollSecondFrame = 0
  }

  function queueResultsStartScrollFrames(expectedGeneration: number, expectedKey: string): void {
    if (typeof window === 'undefined') return
    if (resultsStartScrollFrame) window.cancelAnimationFrame(resultsStartScrollFrame)
    if (resultsStartScrollSecondFrame) window.cancelAnimationFrame(resultsStartScrollSecondFrame)
    resultsStartScrollFrame = window.requestAnimationFrame(() => {
      resultsStartScrollFrame = 0
      resultsStartScrollSecondFrame = window.requestAnimationFrame(() => {
        resultsStartScrollSecondFrame = 0
        if (generation !== expectedGeneration || currentKey.value !== expectedKey) return
        scrollToResultsStart()
      })
    })
  }

  function queueResultsStartScrollAfterNavigation(expectedGeneration: number, expectedKey: string): void {
    stopQueuedResultsStartScrollHooks()
    queueResultsStartScrollFrames(expectedGeneration, expectedKey)

    let ranAfterNavigation = false
    const runAfterNavigation = () => {
      if (ranAfterNavigation) return
      ranAfterNavigation = true
      stopQueuedResultsStartScrollHooks()
      queueResultsStartScrollFrames(expectedGeneration, expectedKey)
    }
    if (typeof nuxtApp.hook !== 'function') return
    stopResultsStartScrollHooks = [
      nuxtApp.hook('page:loading:end', runAfterNavigation),
      nuxtApp.hook('page:transition:finish', runAfterNavigation),
    ]
  }

  async function scrollToResultsStartAfterRender(expectedGeneration: number, expectedKey: string): Promise<void> {
    await nextTick()
    if (generation !== expectedGeneration || currentKey.value !== expectedKey) return
    if (!mounted) {
      pendingResultsStartScroll = true
      pendingResultsStartScrollGeneration = expectedGeneration
      pendingResultsStartScrollKey = expectedKey
      return
    }
    queueResultsStartScrollAfterNavigation(expectedGeneration, expectedKey)
  }

  async function requestAppendPage(targetPage: number): Promise<void> {
    controller?.abort()
    controller = new AbortController()
    const epoch = ++generation

    pendingMore.value = true
    moreError.value = null

    try {
      const result = await getSubscriptionList(
        subscriptionApiParams(scopeValue.value, filters.value, targetPage),
        { signal: controller.signal },
      )
      if (epoch !== generation) return

      const nextItems = new Map(items.value.map(item => [item.id, item]))
      for (const item of result.items) nextItems.set(item.id, item)
      items.value = [...nextItems.values()]
      page.value = result.page
      total.value = result.total
      totalPages.value = result.totalPages
      moreError.value = null
    } catch (err) {
      if (epoch !== generation) return
      if (isAbortError(err)) return
      moreError.value = errorMessage(err)
    } finally {
      if (epoch === generation) {
        pendingMore.value = false
      }
    }
  }

  async function runFirstPage(): Promise<void> {
    const key = subscriptionListKey(scopeValue.value, filters.value)
    const asyncDataKey = `subscription-list:${key}`
    if (lastAsyncDataKey && lastAsyncDataKey !== asyncDataKey) {
      clearNuxtData(lastAsyncDataKey)
    }
    lastAsyncDataKey = asyncDataKey
    currentKey.value = key
    cancelQueuedResultsStartScroll()

    const detailRestoreAttempt = shouldAttemptDetailRestore
    shouldAttemptDetailRestore = false
    const restored = detailRestoreAttempt ? restoreCache?.restore(key, historyId()) : null
    if (restored) {
      items.value = restored.items
      total.value = restored.total
      page.value = restored.page
      totalPages.value = restored.totalPages
      firstFetchedAt.value = restored.firstFetchedAt
      await nextTick()
      window.scrollTo({ top: restored.scrollY })
      return
    }
    if (detailRestoreAttempt) {
      clearNuxtData(asyncDataKey)
    }

    controller?.abort()
    controller = new AbortController()
    const epoch = ++generation
    pending.value = true
    pendingMore.value = false
    error.value = null
    moreError.value = null

    async function requestFreshFirstPage(): Promise<SubscriptionListResponse | null> {
      if (keywordError.value || regionError.value) return null
      try {
        return await getSubscriptionList(
          subscriptionApiParams(scopeValue.value, filters.value, 1),
          { signal: controller!.signal },
        )
      } catch (err) {
        if (epoch === generation && !isAbortError(err)) {
          error.value = errorMessage(err)
        }
        return null
      }
    }

    // Revisited keys can retain a disposed instance's async-data handler.
    // Keep SSR payload hydration, but use this instance's request for client navigation.
    if (typeof window !== 'undefined' && !nuxtApp.isHydrating) {
      const result = await requestFreshFirstPage()
      if (epoch !== generation) return
      if (result) {
        applyReplaceResult(result)
      } else if (error.value) {
        markDegraded()
      }
      if (detailRestoreAttempt) {
        await scrollToResultsStartAfterRender(epoch, key)
      }
      if (epoch === generation) {
        pending.value = false
      }
      return
    }

    await nuxtApp.runWithContext(async () => {
      const { data } = await useAsyncData<SubscriptionListResponse | null>(asyncDataKey, requestFreshFirstPage)
      if (epoch !== generation) return
      if (data.value) {
        applyReplaceResult(data.value)
        if (detailRestoreAttempt) {
          await scrollToResultsStartAfterRender(epoch, key)
        }
      } else if (error.value) {
        markDegraded()
      } else if (detailRestoreAttempt) {
        await scrollToResultsStartAfterRender(epoch, key)
      }
    })

    if (epoch === generation) {
      pending.value = false
    }
  }

  async function doSyncFromRoute(signature: string, options: { force?: boolean; reloadRegions?: boolean }): Promise<void> {
    if (disposed) return
    if (!options.force && signature === handledSignature && !regionError.value) return

    if (options.reloadRegions || !regionsReady) {
      await loadRegionDictionary()
      if (disposed) return
    }

    const normalized = normalizeFromRouteQuery(route.query)
    filters.value = normalized.filters
    keywordError.value = normalized.keywordError

    if (hasRegionalQuery(route.query) && !regionsReady) {
      regionError.value = REGION_LOAD_ERROR
      handledSignature = signature
      markDegraded()
      return
    }

    regionError.value = null
    if (!keywordError.value && queriesMatch(route.query, normalized.query) === false) {
      suppressedWatcherSignature = `${scopeSignature(scopeValue.value)}|${JSON.stringify(normalized.query)}`
      await router.replace({ query: normalized.query as LocationQueryRaw })
      if (disposed) return
    }
    const nextKey = subscriptionListKey(scopeValue.value, normalized.filters)
    handledSignature = signature
    if (!options.force && nextKey === currentKey.value && !error.value) return
    if (keywordError.value) return
    await runFirstPage()
  }

  function syncFromRoute(options: { force?: boolean; reloadRegions?: boolean } = {}): Promise<void> {
    const signature = currentSignature()
    if (!options.force && activeSync?.signature === signature) return activeSync.promise

    const promise = doSyncFromRoute(signature, options).finally(() => {
      if (activeSync?.promise === promise) activeSync = null
    })
    activeSync = { signature, promise }
    return promise
  }

  const routeWatcherStop = watch(currentSignature, () => {
    if (currentSignature() === suppressedWatcherSignature) {
      suppressedWatcherSignature = ''
      return
    }
    void syncFromRoute()
  })

  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true
      generation += 1
      controller?.abort()
      cancelQueuedResultsStartScroll()
      pending.value = false
      pendingMore.value = false
      routeWatcherStop?.()
    })
  }

  await syncFromRoute({ force: true, reloadRegions: true })

  async function applyFilters(patch: Partial<SubscriptionListFilters>): Promise<void> {
    if (hasRegionalQuery(route.query) && !regionsReady) {
      regionError.value = REGION_LOAD_ERROR
      markDegraded()
      return
    }
    const normalized = normalizeSubscriptionQuery(
      { ...filters.value, ...patch },
      scopeValue.value,
      regionsReady ? regions.citiesWithDistricts.value : [],
    )
    const nextKey = subscriptionListKey(scopeValue.value, normalized.filters)
    if (nextKey === currentKey.value) return

    suppressedWatcherSignature = `${scopeSignature(scopeValue.value)}|${JSON.stringify(normalized.query)}`
    await router.push({ query: normalized.query as LocationQueryRaw })
    await syncFromRoute()
  }

  async function resetFilters(): Promise<void> {
    await applyFilters({ ...DEFAULT_FILTERS })
  }

  async function loadMore(): Promise<void> {
    if (pending.value || pendingMore.value || page.value >= totalPages.value) return
    await requestAppendPage(page.value + 1)
  }

  async function retry(): Promise<void> {
    await syncFromRoute({ force: true, reloadRegions: true })
  }

  function saveForDetail(): void {
    if (!restoreCache || !firstFetchedAt.value) return
    markDetailReturnHistory()
    restoreCache.save({
      key: currentKey.value,
      historyId: historyId(),
      items: items.value,
      total: total.value,
      page: page.value,
      totalPages: totalPages.value,
      scrollY: import.meta.client ? window.scrollY : 0,
      firstFetchedAt: firstFetchedAt.value,
      kstDay: getSubscriptionListKstDay(firstFetchedAt.value),
    })
  }

  return {
    filters: readonly(filters),
    items: readonly(items),
    total: readonly(total),
    page: readonly(page),
    totalPages: readonly(totalPages),
    pending: readonly(pending),
    pendingMore: readonly(pendingMore),
    error: readonly(error),
    moreError: readonly(moreError),
    keywordError: readonly(keywordError),
    regionError: readonly(regionError),
    firstFetchedAt: readonly(firstFetchedAt),
    applyFilters,
    resetFilters,
    loadMore,
    retry,
    saveForDetail,
  }
}
