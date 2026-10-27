import { ref, computed, readonly } from 'vue'
import type { Ref } from 'vue'
import {
  KOREA_BOUNDS, MAP_TYPES, isBuildingItem,
  type Granularity, type MapBounds, type MapItem, type MapResponse,
} from '~/types/realEstateMap'
import {
  EMPTY_MAP_FILTER, mapFilterParams, sanitizeMapFilter, type MapFilterState, type RentPriceKind,
} from '~/utils/mapFilters'

const DEBOUNCE_MS = 250

/** 지도를 한국 밖으로 끌면 백엔드 Zod 가 422 를 낸다. 요청 전에 잘라 보낸다. */
export function clampBounds(b: MapBounds): MapBounds {
  const c = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  return {
    swLat: c(b.swLat, KOREA_BOUNDS.LAT_MIN, KOREA_BOUNDS.LAT_MAX),
    neLat: c(b.neLat, KOREA_BOUNDS.LAT_MIN, KOREA_BOUNDS.LAT_MAX),
    swLng: c(b.swLng, KOREA_BOUNDS.LNG_MIN, KOREA_BOUNDS.LNG_MAX),
    neLng: c(b.neLng, KOREA_BOUNDS.LNG_MIN, KOREA_BOUNDS.LNG_MAX),
  }
}

export interface MapHashState {
  type?: string
  level?: number
  lat?: number
  lng?: number
  /** 면적·가격 필터(구간 id 문자열 그대로). 유형에 맞는지는 sanitizeMapFilter 가 거른다. */
  area?: string
  price?: string
  priceKind?: RentPriceKind
}

export function parseMapHash(hash: string): MapHashState {
  const raw = hash.replace(/^#/, '')
  if (!raw) return {}
  const p = new URLSearchParams(raw)
  const out: MapHashState = {}
  const t = p.get('type')
  if (t && (MAP_TYPES as string[]).includes(t)) out.type = t
  for (const k of ['level', 'lat', 'lng'] as const) {
    const v = p.get(k)
    if (v !== null && v !== '' && Number.isFinite(Number(v))) out[k] = Number(v)
  }
  const area = p.get('area')
  const price = p.get('price')
  const pk = p.get('pk')
  if (area) out.area = area
  if (price) out.price = price
  if (pk === 'jeonse' || pk === 'wolse') out.priceKind = pk
  return out
}

function hashFilter(h: MapHashState): Partial<MapFilterState> {
  return { area: h.area ?? null, price: h.price ?? null, priceKind: h.priceKind ?? null }
}

/**
 * 지도 상태는 **해시**에 담는다. 쿼리스트링에 담으면 lat/lng 가 연속값이라
 * Nitro swr('/real-estate/**': swr 300) 캐시 키가 무한히 갈라진다.
 * 2026-08-02 에 같은 계열로 프론트가 힙 한계에 도달해 하루 12~24회 SIGABRT 크래시했다.
 * 해시는 서버로 전송되지 않아 캐시 키에 영향이 없고 canonical 도 갈라지지 않는다.
 */
export function buildMapHash(s: { type: string; level: number; lat: number; lng: number; filter?: MapFilterState }): string {
  // 필터는 고른 것만 붙인다 — 필터 없는 해시는 예전과 글자까지 같다.
  const f = s.filter
  const extra = (f?.area ? `&area=${f.area}` : '')
    + (f?.price ? `&price=${f.price}` : '')
    + (f?.price && f.priceKind ? `&pk=${f.priceKind}` : '')
  return `#type=${s.type}&level=${s.level}&lat=${s.lat}&lng=${s.lng}${extra}`
}

/**
 * 해시도 저장된 위치도 없을 때의 첫 화면 — 서울 구·군 단위.
 *
 * level 은 백엔드 resolveGranularity 의 구·군 밴드(9~10) 안이다. 데스크톱은 9 — 지도 영역
 * (약 1,080×740px)에 서울 25개 구가 다 들어오고 확대 쪽 경계(8)와 한 칸 떨어져 있다. 모바일은
 * 지도 폭이 390px 안팎이라 9 에서는 서울 동서가 다 안 보여 10 으로 한 칸 더 축소한다. 10 은
 * city 에서 확대해 들어올 때(prev=city) 히스테리시스로 city 가 유지되는 칸이지만, 첫 화면은
 * SSR 이 구·군 집계를 주고 prev=district 로 요청하므로 구·군으로 해석된다.
 */
export const DEFAULT_MAP_VIEW = {
  type: 'apt-sale',
  lat: 37.5665,
  lng: 126.978,
  desktopLevel: 9,
  mobileLevel: 10,
} as const

/** SSR 첫 화면 집계 범위(서울 시계). /real-estate 페이지의 useAsyncData 가 쓴다. */
export const SEOUL_BOUNDS: MapBounds = { swLat: 37.41, swLng: 126.76, neLat: 37.72, neLng: 127.19 }

const SAVED_MAP_STATE_KEY = 'ilsangkit:real-estate-map:last'

export interface MapViewState {
  type: string
  level: number
  lat: number
  lng: number
  /** 마지막 필터. 없으면 필터 없음. 유형에 안 맞는 값은 읽을 때 버린다. */
  filter?: MapFilterState
}

/**
 * 저장된 지도 위치 검증. 유형이 6종이 아니거나, level 이 1~14 정수가 아니거나, 좌표가 한국
 * 범위 밖이면 null — 깨진 값으로 시작하면 지도가 바다로 튀거나 백엔드가 422 를 낸다.
 */
export function parseSavedMapState(raw: string | null): MapViewState | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<MapViewState>
    if (typeof v.type !== 'string' || !(MAP_TYPES as string[]).includes(v.type)) return null
    if (typeof v.level !== 'number' || !Number.isInteger(v.level) || v.level < 1 || v.level > 14) return null
    if (typeof v.lat !== 'number' || typeof v.lng !== 'number') return null
    if (!(v.lat >= KOREA_BOUNDS.LAT_MIN && v.lat <= KOREA_BOUNDS.LAT_MAX)) return null
    if (!(v.lng >= KOREA_BOUNDS.LNG_MIN && v.lng <= KOREA_BOUNDS.LNG_MAX)) return null
    const out: MapViewState = { type: v.type, level: v.level, lat: v.lat, lng: v.lng }
    const f = sanitizeMapFilter(v.type, v.filter)
    if (f.area || f.price) out.filter = f
    return out
  } catch {
    return null
  }
}

/** 마지막 지도 위치 읽기. 사생활 모드·저장소 차단이면 null. */
export function readSavedMapState(): MapViewState | null {
  if (import.meta.server || typeof window === 'undefined') return null
  try {
    return parseSavedMapState(window.localStorage.getItem(SAVED_MAP_STATE_KEY))
  } catch {
    return null
  }
}

/** 마지막 지도 위치 저장. 실패해도 조용히 넘어간다 — 다음 방문에 서울로 시작할 뿐이다. */
export function saveMapState(state: MapViewState): void {
  if (import.meta.server || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SAVED_MAP_STATE_KEY, JSON.stringify(state))
  } catch {
    // 저장소 차단·용량 초과
  }
}

/**
 * 첫 화면 위치 결정: 해시 > 저장된 마지막 위치 > 서울 구·군 단위.
 * 필터도 같은 쪽에서 가져온다(해시가 있으면 해시의 필터만, 없으면 저장된 필터).
 *
 * 해시는 공유 링크라 항상 이긴다. 해시에 일부 필드만 있으면 빠진 필드는 기본값(서울)으로 채운다
 * — 저장값과 섞지 않는다(남이 보낸 링크에 내 마지막 유형이 섞이면 안 된다). type 이 null 이면
 * 지금 유형을 그대로 둔다.
 */
export function resolveInitialMapState(
  hash: MapHashState,
  saved: MapViewState | null,
  opts: { desktop: boolean },
): {
  type: string | null; level: number; lat: number; lng: number
  filter: Partial<MapFilterState>; source: 'hash' | 'saved' | 'default'
} {
  const defaultLevel = opts.desktop ? DEFAULT_MAP_VIEW.desktopLevel : DEFAULT_MAP_VIEW.mobileLevel
  const hasHash = hash.type != null || hash.level != null || (hash.lat != null && hash.lng != null)
    || hash.area != null || hash.price != null
  if (hasHash) {
    const center = hash.lat != null && hash.lng != null ? { lat: hash.lat, lng: hash.lng } : DEFAULT_MAP_VIEW
    return {
      type: hash.type ?? null, level: hash.level ?? defaultLevel, lat: center.lat, lng: center.lng,
      filter: hashFilter(hash), source: 'hash',
    }
  }
  if (saved) {
    const { filter, ...view } = saved
    return { ...view, filter: filter ?? { ...EMPTY_MAP_FILTER }, source: 'saved' }
  }
  return {
    type: null, level: defaultLevel, lat: DEFAULT_MAP_VIEW.lat, lng: DEFAULT_MAP_VIEW.lng,
    filter: { ...EMPTY_MAP_FILTER }, source: 'default',
  }
}

/**
 * 목록·오버레이의 Vue :key. 건물은 같은 구에 같은 이름이 있을 수 있으므로
 * 백엔드가 제공하는 주소 단위 buildingKey 로 구분한다. 지역 항목은 같은 구 안의 동들이
 * name(시/도)·district(구·군)가 모두 같으므로 dong 까지 넣어야 고유해진다.
 */
export function itemKey(item: MapItem): string {
  return isBuildingItem(item)
    ? item.buildingKey ?? `${item.buildingName}|${item.bjdCode}`
    : `${item.name}|${item.district ?? ''}|${item.dong ?? ''}`
}

export function useRealEstateMap(initial: {
  type: string
  items: MapItem[]
  granularity: Granularity
  /** 첫 level. 없으면 전국(13). SSR 집계의 level 과 맞춰야 첫 요청의 prev 히스테리시스가 맞는다. */
  level?: number
}) {
  const apiBase = useApiBase()

  const type = ref(initial.type)
  const level = ref(initial.level ?? 13)
  const granularity = ref<Granularity>(initial.granularity)
  const items = ref<MapItem[]>(initial.items) as Ref<MapItem[]>
  const total = ref(initial.items.length)
  const exact = ref(true)
  const pending = ref(false)
  const error = ref<string | null>(null)
  const hoveredKey = ref<string | null>(null)
  /** 단지 단계 면적·가격 필터. 서버는 집계 단계에서 무시한다. */
  const filter = ref<MapFilterState>({ ...EMPTY_MAP_FILTER })

  // 빠르게 드래그하면 나중 요청이 먼저 도착한다. 시퀀스로 stale 응답을 버린다.
  let seq = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastBounds: MapBounds = { swLat: 33, swLng: 124, neLat: 39, neLng: 132 }
  let lastLevel = level.value

  function clearTimer(): void {
    if (!timer) return
    clearTimeout(timer)
    timer = null
  }

  async function fetchNow(bounds: MapBounds, lvl: number, token?: number): Promise<void> {
    const mySeq = token ?? ++seq
    lastBounds = bounds
    lastLevel = lvl
    pending.value = true
    const b = clampBounds(bounds)
    try {
      const res = await $fetch<MapResponse>(`${apiBase}/api/real-estate/${type.value}/map`, {
        params: {
          level: lvl,
          swLat: b.swLat, swLng: b.swLng, neLat: b.neLat, neLng: b.neLng,
          // 현재 표시 단위를 함께 보낸다. 서버는 무상태라 이걸 받아야 히스테리시스가 걸린다.
          // 없으면 경계(10↔11, 7↔8)에서 좌측 목록과 마커가 왕복하며 깜빡인다.
          prev: granularity.value,
          // 고른 필터만 붙는다. 필터가 없으면 예전 요청과 같은 URL 이다.
          ...mapFilterParams(filter.value),
        },
      })
      if (mySeq !== seq) return // stale
      items.value = res.data.items
      granularity.value = res.data.granularity
      total.value = res.data.total
      exact.value = res.data.exact
      error.value = null
    } catch (e) {
      // 화면을 비우지 않는다. 직전 결과를 유지한다.
      if (mySeq !== seq) return
      const apiError = e as { data?: { error?: { code?: string; message?: string } } }
      error.value = apiError?.data?.error?.code === 'MAP_FILTERS_PREPARING'
        ? apiError.data.error.message ?? '면적·가격 필터를 준비 중입니다.'
        : e instanceof Error ? e.message : '지도 데이터를 불러오지 못했습니다.'
    } finally {
      if (mySeq === seq) pending.value = false
    }
  }

  function onMapIdle(bounds: MapBounds, lvl: number): void {
    level.value = lvl
    lastBounds = bounds
    lastLevel = lvl
    clearTimer()
    const mySeq = ++seq
    pending.value = true
    timer = setTimeout(() => {
      timer = null
      void fetchNow(bounds, lvl, mySeq)
    }, DEBOUNCE_MS)
  }

  /**
   * opts.fetch=false 는 유형만 바꾸고 조회는 지도 첫 idle 에 맡긴다 — 저장된 위치로 시작할 때
   * 아직 실제 bounds 를 모르는 상태에서 전국 bbox 로 (단지 단계면 무거운) 조회를 보내지 않기 위해서다.
   */
  function setType(next: string, bounds: MapBounds, opts: { fetch?: boolean } = {}): void {
    const changedType = next !== type.value
    type.value = next
    // 유형에 안 맞는 가격 필터(매매 구간 ↔ 전월세 구간)는 버린다. 면적은 공통이라 유지된다.
    filter.value = sanitizeMapFilter(next, filter.value)
    if (changedType) {
      items.value = []
      total.value = 0
      exact.value = true
      error.value = null
    }
    clearTimer()
    if (opts.fetch === false) return
    void fetchNow(bounds, level.value)
  }

  /**
   * 필터 변경. 서버가 필터를 단지 단계에서만 쓰므로 집계 단계에서는 다시 조회하지 않는다 —
   * 결과가 같다. 확대해 단지 단계에 들어가는 순간의 idle 조회가 필터를 싣는다.
   */
  function setFilter(next: Partial<MapFilterState>, bounds: MapBounds = lastBounds, opts: { fetch?: boolean } = {}): void {
    const sanitized = sanitizeMapFilter(type.value, next)
    if (sanitized.area === filter.value.area && sanitized.price === filter.value.price && sanitized.priceKind === filter.value.priceKind) return
    filter.value = sanitized
    if (opts.fetch === false || granularity.value !== 'building') return
    clearTimer()
    void fetchNow(bounds, level.value)
  }

  async function retry(): Promise<void> {
    clearTimer()
    await fetchNow(lastBounds, lastLevel)
  }

  // 해시(#level=)를 마운트 시 반영하기 위한 순수 setter — onMapIdle 과 달리 fetch 를
  // 트리거하지 않는다. RealEstateMapCanvas 가 이 level 을 props 로 받아 initMap 에 넘기고,
  // 마운트 직후 스스로 idle 을 한 번 emit 하므로 데이터 fetch 는 그 경로로 자연히 일어난다.
  // 여기서까지 fetch 하면 (기본 전국 bounds 로) 중복 요청이 된다.
  function setLevel(next: number): void {
    level.value = next
  }

  return {
    type: readonly(type),
    level: readonly(level),
    granularity: readonly(granularity),
    items: readonly(items),
    total: readonly(total),
    exact: readonly(exact),
    pending: readonly(pending),
    error: readonly(error),
    hoveredKey,
    filter: readonly(filter),
    setFilter,
    isBuilding: computed(() => granularity.value === 'building'),
    setType,
    setLevel,
    onMapIdle,
    fetchNow,
    retry,
  }
}
