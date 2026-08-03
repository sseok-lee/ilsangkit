import { ref, computed, readonly } from 'vue'
import type { Ref } from 'vue'
import {
  KOREA_BOUNDS, MAP_TYPES, isBuildingItem,
  type Granularity, type MapBounds, type MapItem, type MapResponse,
} from '~/types/realEstateMap'

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
  return out
}

/**
 * 지도 상태는 **해시**에 담는다. 쿼리스트링에 담으면 lat/lng 가 연속값이라
 * Nitro swr('/real-estate/**': swr 300) 캐시 키가 무한히 갈라진다.
 * 2026-08-02 에 같은 계열로 프론트가 힙 한계에 도달해 하루 12~24회 SIGABRT 크래시했다.
 * 해시는 서버로 전송되지 않아 캐시 키에 영향이 없고 canonical 도 갈라지지 않는다.
 */
export function buildMapHash(s: { type: string; level: number; lat: number; lng: number }): string {
  return `#type=${s.type}&level=${s.level}&lat=${s.lat}&lng=${s.lng}`
}

export function itemKey(item: MapItem): string {
  return isBuildingItem(item)
    ? `${item.buildingName}|${item.district}`
    : `${item.name}|${item.district ?? ''}`
}

export function useRealEstateMap(initial: {
  type: string
  items: MapItem[]
  granularity: Granularity
}) {
  const apiBase = useApiBase()

  const type = ref(initial.type)
  const level = ref(13)
  const granularity = ref<Granularity>(initial.granularity)
  const items = ref<MapItem[]>(initial.items) as Ref<MapItem[]>
  const total = ref(initial.items.length)
  const exact = ref(true)
  const pending = ref(false)
  const hoveredKey = ref<string | null>(null)
  const selectedKey = ref<string | null>(null)

  // 빠르게 드래그하면 나중 요청이 먼저 도착한다. 시퀀스로 stale 응답을 버린다.
  let seq = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  async function fetchNow(bounds: MapBounds, lvl: number): Promise<void> {
    const mySeq = ++seq
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
        },
      })
      if (mySeq !== seq) return // stale
      items.value = res.data.items
      granularity.value = res.data.granularity
      total.value = res.data.total
      exact.value = res.data.exact
    } catch {
      // 화면을 비우지 않는다. 직전 결과를 유지한다.
      if (mySeq !== seq) return
    } finally {
      if (mySeq === seq) pending.value = false
    }
  }

  function onMapIdle(bounds: MapBounds, lvl: number): void {
    level.value = lvl
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void fetchNow(bounds, lvl), DEBOUNCE_MS)
  }

  function setType(next: string, bounds: MapBounds): void {
    type.value = next
    if (timer) clearTimeout(timer)
    void fetchNow(bounds, level.value)
  }

  return {
    type: readonly(type),
    level: readonly(level),
    granularity: readonly(granularity),
    items: readonly(items),
    total: readonly(total),
    exact: readonly(exact),
    pending: readonly(pending),
    hoveredKey,
    selectedKey,
    isBuilding: computed(() => granularity.value === 'building'),
    setType,
    onMapIdle,
    fetchNow,
  }
}
