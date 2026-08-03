import { describe, it, expect } from 'vitest'
import { clampBounds, parseMapHash, buildMapHash, itemKey } from '~/composables/useRealEstateMap'

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
    expect(itemKey({ name: '서울', district: '강남구' } as never)).toBe('서울|강남구')
  })

  it('건물 항목은 buildingName+district 로 식별한다', () => {
    expect(itemKey({ buildingName: 'A', district: '강남구' } as never)).toBe('A|강남구')
  })
})
