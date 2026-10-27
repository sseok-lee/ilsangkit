import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  clampBounds, parseMapHash, buildMapHash, itemKey, useRealEstateMap,
  DEFAULT_MAP_VIEW, parseSavedMapState, readSavedMapState, resolveInitialMapState, saveMapState,
} from '~/composables/useRealEstateMap'

describe('clampBounds', () => {
  it('한국 영역 밖으로 나간 bbox 를 클램프한다', () => {
    // 지도를 일본까지 끌면 백엔드 Zod 가 422 를 낸다. 클라이언트가 미리 자른다.
    const r = clampBounds({ swLat: 20, swLng: 100, neLat: 45, neLng: 150 })
    expect(r).toEqual({ swLat: 33, swLng: 124, neLat: 39, neLng: 132 })
  })

  it('영역 안 좌표는 그대로 둔다', () => {
    const b = { swLat: 37.4, swLng: 127.0, neLat: 37.6, neLng: 127.2 }
    expect(clampBounds(b)).toEqual(b)
  })
})

describe('map hash', () => {
  it('해시를 파싱한다', () => {
    expect(parseMapHash('#type=villa-rent&level=9&lat=37.5&lng=127.03')).toEqual({
      type: 'villa-rent', level: 9, lat: 37.5, lng: 127.03,
    })
  })

  it('빈 해시는 빈 객체', () => {
    expect(parseMapHash('')).toEqual({})
    expect(parseMapHash('#')).toEqual({})
  })

  it('알 수 없는 type 은 무시한다', () => {
    expect(parseMapHash('#type=bogus&level=9').type).toBeUndefined()
  })

  it('해시를 만든다 — 쿼리스트링(?)이 아니라 해시(#)여야 한다', () => {
    // 쿼리로 새면 Nitro swr 캐시 키가 lat/lng 연속값마다 갈라져 힙을 먹는다(2026-08-02 사고)
    const h = buildMapHash({ type: 'apt-sale', level: 9, lat: 37.5, lng: 127.03 })
    expect(h.startsWith('#')).toBe(true)
    expect(h).not.toContain('?')
  })

  it('왕복이 보존된다', () => {
    const s = { type: 'apt-rent', level: 6, lat: 35.1536, lng: 129.0555 }
    expect(parseMapHash(buildMapHash(s))).toEqual(s)
  })
})

describe('itemKey', () => {
  it('지역 항목은 name+district 로 식별한다', () => {
    expect(itemKey({ name: '서울', district: '강남구', dong: null } as never)).toBe('서울|강남구|')
  })

  it('건물 항목은 buildingKey 로 식별한다', () => {
    const buildingKey = 'a'.repeat(64)
    expect(itemKey({ buildingName: 'A', district: '강남구', bjdCode: '1168010100', buildingKey } as never))
      .toBe(buildingKey)
  })

  it('시/도 레벨 지역 항목은 district 가 null 이라 빈 문자열로 접힌다', () => {
    // 이 폴백이 사라지면 키가 "서울|null" 이 되어 마커·목록 연동이 어긋난다
    expect(itemKey({ name: '서울', district: null, dong: null } as never)).toBe('서울||')
  })
})

describe('itemKey 고유성', () => {
  // 같은 구 안의 동들은 name(시/도)·district(구·군)가 모두 같다. dong 을 키에 넣지
  // 않으면 전부 같은 문자열이 되어 Vue :key 가 충돌하고 목록 렌더가 깨진다.
  it('같은 구의 서로 다른 동은 서로 다른 키를 갖는다', () => {
    const mia = { name: '서울', district: '강북구', dong: '미아동',
      lat: 37.63, lng: 127.02, avgPricePerPyeong: 3225, transactionCount: 42 }
    const beon = { name: '서울', district: '강북구', dong: '번동',
      lat: 37.64, lng: 127.03, avgPricePerPyeong: 3100, transactionCount: 31 }
    expect(itemKey(mia)).not.toBe(itemKey(beon))
  })

  it('같은 이름·법정동코드라도 지번별 buildingKey가 다르면 서로 다른 키를 갖는다', () => {
    const daechi = { buildingName: '은마', city: '서울', district: '강남구', dongName: '대치동',
      bjdCode: '1168010100', buildingKey: 'a'.repeat(64), jibun: '316', lat: 37.5, lng: 127.06 }
    const dogok = { buildingName: '은마', city: '서울', district: '강남구', dongName: '대치동',
      bjdCode: '1168010100', buildingKey: 'b'.repeat(64), jibun: '317', lat: 37.49, lng: 127.05 }

    expect(itemKey(daechi as never)).toBe('a'.repeat(64))
    expect(itemKey(dogok as never)).toBe('b'.repeat(64))
    expect(itemKey(daechi as never)).not.toBe(itemKey(dogok as never))
  })

  it('dong 이 없는 구·군 항목은 기존 키 형태를 유지한다', () => {
    const gangbuk = { name: '서울', district: '강북구', dong: null,
      lat: 37.63, lng: 127.02, avgPricePerPyeong: 3225, transactionCount: 42 }
    expect(itemKey(gangbuk)).toBe('서울|강북구|')
  })
})

describe('useRealEstateMap fetch lifecycle', () => {
  const bounds = { swLat: 33, swLng: 124, neLat: 39, neLng: 132 }

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('debounce 대기 시작 시점에 이전 요청을 stale 처리한다', async () => {
    vi.useFakeTimers()
    let resolveFirst: (value: unknown) => void = () => {}
    const fetchMock = vi.fn()
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce({
        success: true,
        data: {
          granularity: 'district',
          items: [{ name: '부산', district: null, dong: null, lat: 35.1, lng: 129.0, avgPricePerPyeong: 5000, transactionCount: 1 }],
          total: 1,
          exact: true,
        },
      })
    vi.stubGlobal('$fetch', fetchMock)

    const map = useRealEstateMap({ type: 'apt-sale', items: [], granularity: 'city' })
    const first = map.fetchNow(bounds, 13)
    map.onMapIdle(bounds, 9)

    resolveFirst({
      success: true,
      data: {
        granularity: 'building',
        items: [{ name: '서울', district: null, dong: null, lat: 37.5, lng: 127, avgPricePerPyeong: 7000, transactionCount: 1 }],
        total: 1,
        exact: true,
      },
    })
    await first
    expect(map.items.value).toEqual([])

    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    expect(map.granularity.value).toBe('district')
    expect(map.items.value[0]).toMatchObject({ name: '부산' })
  })

  it('같은 조건 실패는 이전 결과를 유지하고 error 와 retry 를 제공한다', async () => {
    const initial = [{ name: '서울', district: null, dong: null, lat: 37.5, lng: 127, avgPricePerPyeong: 7000, transactionCount: 1 }]
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        success: true,
        data: {
          granularity: 'city',
          items: [{ name: '부산', district: null, dong: null, lat: 35.1, lng: 129.0, avgPricePerPyeong: 5000, transactionCount: 1 }],
          total: 1,
          exact: true,
        },
      })
    vi.stubGlobal('$fetch', fetchMock)

    const map = useRealEstateMap({ type: 'apt-sale', items: initial, granularity: 'city' })
    await map.fetchNow(bounds, 13)
    expect(map.error.value).toBe('network down')
    expect(map.items.value).toEqual(initial)

    await map.retry()
    expect(map.error.value).toBeNull()
    expect(map.items.value[0]).toMatchObject({ name: '부산' })
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('/api/real-estate/apt-sale/map'), expect.any(Object))
  })

  it('다른 type 으로 전환한 요청이 실패하면 이전 type 결과를 숨긴다', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('type failed'))
    vi.stubGlobal('$fetch', fetchMock)
    const map = useRealEstateMap({
      type: 'apt-sale',
      items: [{ name: '서울', district: null, dong: null, lat: 37.5, lng: 127, avgPricePerPyeong: 7000, transactionCount: 1 }],
      granularity: 'city',
    })

    map.setType('villa-rent', bounds)
    await flushPromises()

    expect(map.type.value).toBe('villa-rent')
    expect(map.items.value).toEqual([])
    expect(map.total.value).toBe(0)
    expect(map.error.value).toBe('type failed')
  })
})

describe('첫 화면 위치 — 해시 > 저장된 마지막 위치 > 서울 구·군 단위', () => {
  const SAVED = { type: 'villa-rent', level: 5, lat: 35.18, lng: 129.07 }

  it('저장값 검증: 6종 유형·1~14 정수 level·한국 범위 좌표만 받는다', () => {
    expect(parseSavedMapState(JSON.stringify(SAVED))).toEqual(SAVED)
    expect(parseSavedMapState(null)).toBeNull()
    expect(parseSavedMapState('{깨진')).toBeNull()
    expect(parseSavedMapState(JSON.stringify({ ...SAVED, type: 'land' }))).toBeNull()
    expect(parseSavedMapState(JSON.stringify({ ...SAVED, level: 4.5 }))).toBeNull()
    expect(parseSavedMapState(JSON.stringify({ ...SAVED, level: 15 }))).toBeNull()
    expect(parseSavedMapState(JSON.stringify({ ...SAVED, lat: 0, lng: 0 }))).toBeNull()
    expect(parseSavedMapState(JSON.stringify({ ...SAVED, lng: 140 }))).toBeNull()
    expect(parseSavedMapState(JSON.stringify({ ...SAVED, lat: '35' }))).toBeNull()
  })

  it('해시도 저장값도 없으면 서울 — 데스크톱 level 9, 모바일 level 10(둘 다 구·군 밴드)', () => {
    expect(resolveInitialMapState({}, null, { desktop: true })).toEqual({
      type: null, level: DEFAULT_MAP_VIEW.desktopLevel, lat: DEFAULT_MAP_VIEW.lat, lng: DEFAULT_MAP_VIEW.lng, filter: { area: null, price: null, priceKind: null }, source: 'default',
    })
    expect(resolveInitialMapState({}, null, { desktop: false }).level).toBe(DEFAULT_MAP_VIEW.mobileLevel)
    expect([DEFAULT_MAP_VIEW.desktopLevel, DEFAULT_MAP_VIEW.mobileLevel].every((l) => l >= 9 && l <= 10)).toBe(true)
  })

  it('저장값이 있으면 그 자리에서 시작한다', () => {
    expect(resolveInitialMapState({}, SAVED, { desktop: true })).toEqual({ ...SAVED, filter: { area: null, price: null, priceKind: null }, source: 'saved' })
  })

  it('해시가 있으면 저장값보다 우선하고, 빠진 필드는 저장값이 아니라 기본값(서울)으로 채운다', () => {
    expect(resolveInitialMapState({ type: 'apt-rent', level: 4, lat: 37.5, lng: 127.05 }, SAVED, { desktop: true }))
      .toEqual({ type: 'apt-rent', level: 4, lat: 37.5, lng: 127.05, filter: { area: null, price: null, priceKind: null }, source: 'hash' })
    expect(resolveInitialMapState({ lat: 37.5, lng: 127.05 }, SAVED, { desktop: false }))
      .toEqual({ type: null, level: DEFAULT_MAP_VIEW.mobileLevel, lat: 37.5, lng: 127.05, filter: { area: null, price: null, priceKind: null }, source: 'hash' })
  })
})

describe('마지막 위치 저장소', () => {
  beforeEach(() => window.localStorage.clear())

  it('저장 → 읽기 왕복', () => {
    saveMapState({ type: 'apt-sale', level: 7, lat: 37.5, lng: 127 })
    expect(readSavedMapState()).toEqual({ type: 'apt-sale', level: 7, lat: 37.5, lng: 127 })
  })

  it('저장소가 막혀 있어도 던지지 않는다', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    expect(readSavedMapState()).toBeNull()
    expect(() => saveMapState({ type: 'apt-sale', level: 7, lat: 37.5, lng: 127 })).not.toThrow()
    spy.mockRestore()
    set.mockRestore()
  })
})

describe('면적·가격 필터 — 해시·저장·요청', () => {
  const bounds = { swLat: 37.48, swLng: 127.02, neLat: 37.52, neLng: 127.07 }
  const OK = (granularity: string, extra: Record<string, unknown> = {}) => ({
    success: true, data: { granularity, items: [], total: 0, exact: true, ...extra },
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it('필터가 없으면 해시가 예전과 글자까지 같다', () => {
    const s = { type: 'apt-sale', level: 5, lat: 37.5, lng: 127.03 }
    expect(buildMapHash({ ...s, filter: { area: null, price: null, priceKind: null } })).toBe(buildMapHash(s))
    expect(buildMapHash(s)).toBe('#type=apt-sale&level=5&lat=37.5&lng=127.03')
  })

  it('필터를 해시에 싣고 왕복한다(공유 링크)', () => {
    const h = buildMapHash({
      type: 'apt-rent', level: 5, lat: 37.5, lng: 127.03,
      filter: { area: '60-85', price: '30000-50000', priceKind: 'jeonse' },
    })
    expect(h).toBe('#type=apt-rent&level=5&lat=37.5&lng=127.03&area=60-85&price=30000-50000&pk=jeonse')
    expect(parseMapHash(h)).toEqual({
      type: 'apt-rent', level: 5, lat: 37.5, lng: 127.03, area: '60-85', price: '30000-50000', priceKind: 'jeonse',
    })
  })

  it('해시의 필터가 저장된 필터보다 우선하고, 해시가 없으면 저장된 필터로 시작한다', () => {
    const saved = { type: 'apt-sale', level: 5, lat: 37.5, lng: 127, filter: { area: '135-', price: null, priceKind: null } }
    expect(resolveInitialMapState({ type: 'apt-sale', area: '0-60' }, saved, { desktop: true }).filter)
      .toEqual({ area: '0-60', price: null, priceKind: null })
    expect(resolveInitialMapState({}, saved, { desktop: true }).filter)
      .toEqual({ area: '135-', price: null, priceKind: null })
  })

  it('마지막 위치와 함께 필터를 저장·복원하고, 유형에 안 맞는 저장 필터는 버린다', () => {
    saveMapState({ type: 'apt-rent', level: 5, lat: 37.5, lng: 127, filter: { area: '60-85', price: '50-100', priceKind: 'wolse' } })
    expect(readSavedMapState()?.filter).toEqual({ area: '60-85', price: '50-100', priceKind: 'wolse' })
    expect(parseSavedMapState(JSON.stringify({ type: 'apt-sale', level: 5, lat: 37.5, lng: 127, filter: { price: '50-100', priceKind: 'wolse' } })))
      .toEqual({ type: 'apt-sale', level: 5, lat: 37.5, lng: 127 })
  })

  it('필터가 없으면 요청 파라미터가 예전과 같다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(OK('building'))
    vi.stubGlobal('$fetch', fetchMock)
    const map = useRealEstateMap({ type: 'apt-sale', items: [], granularity: 'building', level: 5 })
    await map.fetchNow(bounds, 5)
    expect(Object.keys(fetchMock.mock.calls[0][1].params).sort())
      .toEqual(['level', 'neLat', 'neLng', 'prev', 'swLat', 'swLng'])
  })

  it('단지 단계에서 필터를 바꾸면 그 필터로 바로 다시 조회하고 응답 메타를 둔다', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(OK('building'))
      .mockResolvedValueOnce(OK('building', { total: 3, filter: { scanned: 400, approximate: true } }))
    vi.stubGlobal('$fetch', fetchMock)
    const map = useRealEstateMap({ type: 'apt-rent', items: [], granularity: 'building', level: 5 })
    await map.fetchNow(bounds, 5)
    map.setFilter({ area: '60-85', price: '30000-50000', priceKind: 'jeonse' }, bounds)
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][1].params).toMatchObject({ area: '60-85', price: '30000-50000', priceKind: 'jeonse' })
    expect(map.filterMeta.value).toEqual({ scanned: 400, approximate: true })
  })

  it('집계 단계에서 필터를 바꾸면 다시 조회하지 않는다(서버가 무시하므로 결과가 같다)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(OK('district'))
    vi.stubGlobal('$fetch', fetchMock)
    const map = useRealEstateMap({ type: 'apt-sale', items: [], granularity: 'district', level: 9 })
    map.setFilter({ area: '60-85', price: null, priceKind: null }, bounds)
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(map.filter.value.area).toBe('60-85')
  })

  it('유형을 바꾸면 맞지 않는 가격 필터는 초기화하고 면적은 유지한다', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(OK('building')))
    const map = useRealEstateMap({ type: 'apt-sale', items: [], granularity: 'district', level: 9 })
    map.setFilter({ area: '85-135', price: '90000-150000', priceKind: null }, bounds)
    map.setType('apt-rent', bounds)
    await flushPromises()
    expect(map.filter.value).toEqual({ area: '85-135', price: null, priceKind: null })
  })
})
