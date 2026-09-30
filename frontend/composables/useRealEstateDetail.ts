import { getCurrentInstance, onUnmounted, readonly, ref, watch } from 'vue'
import type { Ref, WatchStopHandle } from 'vue'
import type {
  DealMode,
  DetailOverview,
  DetailPage,
  DetailQuery,
  DetailSnapshot,
  PeriodMonths,
} from '~/types/housingRedesign'
import type { RealEstateType, RentTransaction, SaleTransaction } from '~/types/realEstate'

type DetailRow = SaleTransaction | RentTransaction

interface ApiResponse<T> {
  success: boolean
  data: T
}

interface DetailContext {
  type: RealEstateType
  bjdCode: string
  buildingName: string
  buildingKey?: string
  initialMode?: DealMode
}

const EMPTY_TABLE: DetailPage<DetailRow> = {
  items: [],
  total: 0,
  page: 1,
  totalPages: 0,
}

type DetailRequestQuery = Pick<DetailQuery, 'mode' | 'months' | 'area' | 'deposit'>

interface HydratableAsyncState<T> {
  data: T | null
  failed: boolean
}

const SSR_FAILURE_MARKER = { ssr: true, failed: true } as const

function toHydratableState<T>(data: T | null, failure: unknown): HydratableAsyncState<T> {
  return { data, failed: !!failure }
}

function isHydratableState<T>(value: unknown): value is HydratableAsyncState<T> {
  return !!value && typeof value === 'object' && 'data' in value && 'failed' in value
}

function defaultMode(type: RealEstateType, initialMode?: DealMode): DealMode {
  if (type.endsWith('-rent') && (initialMode === 'jeonse' || initialMode === 'wolse')) {
    return initialMode
  }
  return type.endsWith('-sale') ? 'sale' : 'jeonse'
}

function routeTypeForMode(type: RealEstateType, mode: DealMode): RealEstateType {
  const propertyType = type.replace(/-(?:sale|rent)$/, '')
  return `${propertyType}-${mode === 'sale' ? 'sale' : 'rent'}` as RealEstateType
}

function defaultQuery(type: RealEstateType, initialMode?: DealMode): DetailRequestQuery {
  return {
    mode: defaultMode(type, initialMode),
    months: 0,
    area: undefined,
    deposit: undefined,
  }
}

function buildQuery(context: DetailContext, filters: DetailRequestQuery) {
  const query: Record<string, string | number> = {
    bjdCode: context.bjdCode,
    buildingName: context.buildingName,
    mode: filters.mode,
    months: filters.months,
  }
  if (filters.area != null) query.area = filters.area
  if (filters.deposit != null) query.deposit = filters.deposit
  if (context.buildingKey) query.buildingKey = context.buildingKey
  return query
}

function asyncKey(prefix: string, context: DetailContext, suffix?: string): string {
  return [
    prefix,
    context.type,
    context.bjdCode,
    context.buildingName,
    ...(context.buildingKey ? [context.buildingKey] : []),
    ...(suffix ? [suffix] : []),
  ].join(':')
}

function isPageQueryable(
  snapshot: DetailSnapshot<DetailRow> | null
): snapshot is DetailSnapshot<DetailRow> {
  if (!snapshot?.filters.area) return false
  if (snapshot.filters.mode === 'wolse' && snapshot.filters.deposit == null) return false
  return true
}

export async function useRealEstateDetail(context: Ref<DetailContext>) {
  const apiBase = useApiBase()
  const overview = ref<DetailOverview | null>(null)
  const snapshot = ref<DetailSnapshot<DetailRow> | null>(null)
  const table = ref<DetailPage<DetailRow>>({ ...EMPTY_TABLE })
  const pending = ref(false)
  const tablePending = ref(false)
  const error = ref<unknown>(null)
  const overviewError = ref<unknown>(null)
  const tableError = ref<unknown>(null)
  const announcement = ref<string | null>(null)
  let requestedQuery = defaultQuery(context.value.type, context.value.initialMode)

  let detailRevision = 0
  let overviewRevision = 0
  let pageRevision = 0
  let disposed = false
  let stopContextWatch: WatchStopHandle | null = null

  async function loadOverview(): Promise<void> {
    const ticket = ++overviewRevision
    overviewError.value = null
    try {
      const ctx = context.value
      const response = await $fetch<ApiResponse<DetailOverview>>(
        `${apiBase}/api/real-estate/${ctx.type}/detail-overview`,
        {
          query: {
            bjdCode: ctx.bjdCode,
            buildingName: ctx.buildingName,
            ...(ctx.buildingKey ? { buildingKey: ctx.buildingKey } : {}),
          },
        }
      )
      if (disposed || ticket !== overviewRevision) return
      overview.value = response.data
    } catch (cause) {
      if (disposed || ticket !== overviewRevision) return
      overview.value = null
      overviewError.value = cause
    }
  }

  async function applyQuery(
    nextQuery: DetailRequestQuery,
    options: { fallbackAnnouncement?: string } = {}
  ): Promise<boolean> {
    const ticket = ++detailRevision
    pageRevision++
    tablePending.value = false
    pending.value = true
    error.value = null
    tableError.value = null
    announcement.value = null
    const ctx = context.value
    const routeType = routeTypeForMode(ctx.type, nextQuery.mode)

    try {
      const response = await $fetch<ApiResponse<DetailSnapshot<DetailRow>>>(
        `${apiBase}/api/real-estate/${routeType}/detail`,
        { query: buildQuery(ctx, nextQuery) }
      )
      if (disposed || ticket !== detailRevision) return false
      requestedQuery = {
        mode: response.data.filters.mode,
        months: response.data.filters.months,
        area: response.data.filters.area ?? undefined,
        deposit: response.data.filters.deposit ?? undefined,
      }
      snapshot.value = response.data
      table.value = response.data.table
      if (response.data.adjustment === 'deposit-reset') {
        announcement.value = '선택 가능한 보증금으로 조정되었습니다'
      } else if (response.data.adjustment === 'area-reset') {
        announcement.value = '선택 가능한 면적으로 조정되었습니다'
      } else if (options.fallbackAnnouncement) {
        announcement.value = options.fallbackAnnouncement
      }
      return true
    } catch (cause) {
      if (disposed || ticket !== detailRevision) return false
      error.value = cause
      return false
    } finally {
      if (!disposed && ticket === detailRevision) {
        pending.value = false
      }
    }
  }

  async function refresh(): Promise<void> {
    await applyQuery(requestedQuery)
  }

  async function refreshOverview(): Promise<void> {
    await loadOverview()
  }

  async function setFilters(
    patch: Partial<Pick<DetailQuery, 'mode' | 'months' | 'area' | 'deposit'>>
  ): Promise<void> {
    const previousQuery = requestedQuery
    const mode = patch.mode ?? previousQuery.mode
    const modeChanged =
      Object.prototype.hasOwnProperty.call(patch, 'mode') && patch.mode !== previousQuery.mode
    const shouldAnnounceDepositReset =
      modeChanged && mode !== 'wolse' && previousQuery.deposit != null
    const nextQuery: DetailRequestQuery = {
      mode,
      months: (patch.months ?? previousQuery.months) as PeriodMonths,
      area: Object.prototype.hasOwnProperty.call(patch, 'area') ? patch.area : previousQuery.area,
      deposit: Object.prototype.hasOwnProperty.call(patch, 'deposit')
        ? patch.deposit
        : previousQuery.deposit,
    }
    if (modeChanged && mode !== 'wolse') {
      nextQuery.deposit = undefined
    }
    requestedQuery = nextQuery
    await applyQuery(nextQuery, {
      fallbackAnnouncement: shouldAnnounceDepositReset
        ? '거래 유형 변경으로 보증금 선택을 초기화했습니다'
        : undefined,
    })
  }

  async function goToPage(page: number): Promise<void> {
    const currentSnapshot = snapshot.value
    if (!isPageQueryable(currentSnapshot)) return
    const revisionAtStart = detailRevision
    const ticket = ++pageRevision
    tablePending.value = true
    tableError.value = null
    const ctx = context.value
    const filters = currentSnapshot.filters
    const routeType = routeTypeForMode(ctx.type, filters.mode)
    const query = {
      bjdCode: filters.bjdCode,
      buildingName: filters.buildingName,
      mode: filters.mode,
      months: filters.months,
      area: filters.area,
      page,
      ...(ctx.buildingKey ? { buildingKey: ctx.buildingKey } : {}),
      ...(filters.deposit != null ? { deposit: filters.deposit } : {}),
    }

    try {
      const response = await $fetch<ApiResponse<DetailPage<DetailRow>>>(
        `${apiBase}/api/real-estate/${routeType}/detail-page`,
        { query }
      )
      if (disposed || ticket !== pageRevision || revisionAtStart !== detailRevision) return
      if (response.data.total !== currentSnapshot.table.total) {
        tablePending.value = false
        const refreshed = await applyQuery(requestedQuery)
        if (refreshed) announcement.value = '거래 정보가 갱신되었습니다'
        return
      }
      table.value = response.data
    } catch (cause) {
      if (disposed || ticket !== pageRevision || revisionAtStart !== detailRevision) return
      tableError.value = cause
    } finally {
      if (!disposed && ticket === pageRevision && revisionAtStart === detailRevision) {
        tablePending.value = false
      }
    }
  }

  stopContextWatch = watch(
    [
      () => context.value.type,
      () => context.value.bjdCode,
      () => context.value.buildingName,
      () => context.value.buildingKey,
      () => context.value.initialMode,
    ],
    async () => {
      requestedQuery = defaultQuery(context.value.type, context.value.initialMode)
      await Promise.all([loadOverview(), applyQuery(requestedQuery)])
    }
  )

  if (getCurrentInstance()) {
    onUnmounted(() => {
      disposed = true
      stopContextWatch?.()
      detailRevision++
      overviewRevision++
      pageRevision++
      pending.value = false
      tablePending.value = false
    })
  }

  const overviewAsyncPromise = useAsyncData<HydratableAsyncState<DetailOverview>>(
    asyncKey('real-estate-detail-overview', context.value),
    async () => {
      await loadOverview()
      return toHydratableState(overview.value, overviewError.value)
    },
    { default: () => ({ data: null, failed: false }) }
  )

  const detailAsyncPromise = useAsyncData<HydratableAsyncState<DetailSnapshot<DetailRow>>>(
    asyncKey('real-estate-detail', context.value, requestedQuery.mode),
    async () => {
      await applyQuery(requestedQuery)
      return toHydratableState(snapshot.value, error.value)
    },
    { default: () => ({ data: null, failed: false }) }
  )

  const [overviewAsync, detailAsync] = await Promise.all([overviewAsyncPromise, detailAsyncPromise])

  const overviewState = isHydratableState<DetailOverview>(overviewAsync.data.value)
    ? overviewAsync.data.value
    : toHydratableState(overviewAsync.data.value as DetailOverview | null, null)
  if (overviewState.data) {
    overview.value = overviewState.data
  }
  if (overviewState.failed && !overview.value) {
    overviewError.value = SSR_FAILURE_MARKER
  }

  const detailState = isHydratableState<DetailSnapshot<DetailRow>>(detailAsync.data.value)
    ? detailAsync.data.value
    : toHydratableState(detailAsync.data.value as DetailSnapshot<DetailRow> | null, null)
  if (detailState.data) {
    snapshot.value = detailState.data
    table.value = detailState.data.table
    requestedQuery = {
      mode: detailState.data.filters.mode,
      months: detailState.data.filters.months,
      area: detailState.data.filters.area ?? undefined,
      deposit: detailState.data.filters.deposit ?? undefined,
    }
  }
  if (detailState.failed && !snapshot.value) {
    error.value = SSR_FAILURE_MARKER
  }

  return {
    overview: readonly(overview),
    snapshot: readonly(snapshot),
    table: readonly(table),
    pending: readonly(pending),
    tablePending: readonly(tablePending),
    error: readonly(error),
    overviewError: readonly(overviewError),
    tableError: readonly(tableError),
    announcement: readonly(announcement),
    setFilters,
    goToPage,
    refresh,
    refreshOverview,
  }
}
