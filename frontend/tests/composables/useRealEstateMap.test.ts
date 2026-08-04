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
    expect(itemKey({ name: '서울', district: '강남구', dong: null } as never)).toBe('서울|강남구|')
  })

  it('건물 항목은 buildingName+district 로 식별한다', () => {
    expect(itemKey({ buildingName: 'A', district: '강남구' } as never)).toBe('A|강남구')
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

  it('dong 이 없는 구·군 항목은 기존 키 형태를 유지한다', () => {
    const gangbuk = { name: '서울', district: '강북구', dong: null,
      lat: 37.63, lng: 127.02, avgPricePerPyeong: 3225, transactionCount: 42 }
    expect(itemKey(gangbuk)).toBe('서울|강북구|')
  })
})
