import { describe, it, expect } from 'vitest'
import {
  parseAccessPoints,
  groupAccessPointsByLocation,
  accessPointsToMapFacilities,
  mapLevelForAccessPoints,
} from '~/utils/wifiAccessPoints'

const AP = (over: Record<string, unknown> = {}) => ({
  id: 'wifi-a',
  lat: 37.5,
  lng: 127.0,
  ssid: 'SEOUL',
  installLocation: '관광',
  installLocationDetail: '저류지 야외',
  ...over,
})

describe('parseAccessPoints', () => {
  it('details.accessPoints 를 읽는다', () => {
    expect(parseAccessPoints({ accessPoints: [AP(), AP({ id: 'wifi-b' })] })).toHaveLength(2)
  })

  it('통합 상세가 아니면 빈 배열 — 기존 AP 단일 페이지에서 목록이 뜨지 않게', () => {
    expect(parseAccessPoints({})).toEqual([])
    expect(parseAccessPoints(undefined)).toEqual([])
    expect(parseAccessPoints({ accessPoints: null })).toEqual([])
  })

  it('좌표가 숫자가 아닌 항목은 버린다 — 지도 핀이 (0,0) 아프리카 앞바다로 튀지 않게', () => {
    const aps = parseAccessPoints({
      accessPoints: [AP(), AP({ id: 'x', lat: null }), AP({ id: 'y', lng: 'abc' })],
    })
    expect(aps.map((a) => a.id)).toEqual(['wifi-a'])
  })

  it('배열이 아니면 빈 배열', () => {
    expect(parseAccessPoints({ accessPoints: { a: 1 } })).toEqual([])
  })
})

describe('groupAccessPointsByLocation', () => {
  it('설치장소상세로 묶고 개수 많은 순으로 정렬한다', () => {
    const groups = groupAccessPointsByLocation([
      AP({ id: '1', installLocationDetail: '저류지 야외' }),
      AP({ id: '2', installLocationDetail: '식물문화센터 2F' }),
      AP({ id: '3', installLocationDetail: '저류지 야외' }),
      AP({ id: '4', installLocationDetail: '저류지 야외' }),
    ])
    expect(groups).toEqual([
      { label: '저류지 야외', count: 3 },
      { label: '식물문화센터 2F', count: 1 },
    ])
  })

  it('같은 개수면 이름순으로 안정 정렬한다 — 렌더가 매번 바뀌지 않게', () => {
    const groups = groupAccessPointsByLocation([
      AP({ id: '1', installLocationDetail: '나' }),
      AP({ id: '2', installLocationDetail: '가' }),
    ])
    expect(groups.map((g) => g.label)).toEqual(['가', '나'])
  })

  it('설치장소상세가 비면 installLocation 으로 넘어간다', () => {
    const groups = groupAccessPointsByLocation([
      AP({ installLocationDetail: '', installLocation: '공원' }),
    ])
    expect(groups).toEqual([{ label: '공원', count: 1 }])
  })

  it('둘 다 비면 그 항목은 목록에서 뺀다 — "미지정" 같은 빈 줄을 만들지 않는다', () => {
    expect(groupAccessPointsByLocation([AP({ installLocationDetail: '', installLocation: '' })])).toEqual([])
  })

  it('앞뒤 공백을 정리해 같은 장소가 갈라지지 않게 한다', () => {
    const groups = groupAccessPointsByLocation([
      AP({ id: '1', installLocationDetail: ' 본관 A동 ' }),
      AP({ id: '2', installLocationDetail: '본관 A동' }),
    ])
    expect(groups).toEqual([{ label: '본관 A동', count: 2 }])
  })
})

describe('accessPointsToMapFacilities', () => {
  const base = {
    id: 'wifi-gaaa', name: '서울식물원', category: 'wifi' as const,
    address: '서울특별시 강서구 마곡동로 161', roadAddress: null,
    lat: 37.5, lng: 127.0, city: '서울', district: '강서구',
  }

  it('AP 마다 핀을 만들고 설치장소상세를 이름에 붙인다', () => {
    const pins = accessPointsToMapFacilities(
      [AP({ id: '1', lat: 37.51, lng: 127.01, installLocationDetail: '저류지 야외' })],
      base,
    )
    expect(pins).toEqual([
      expect.objectContaining({
        id: '1', name: '서울식물원 · 저류지 야외', lat: 37.51, lng: 127.01,
        category: 'wifi', city: '서울', district: '강서구',
      }),
    ])
  })

  it('설치장소상세가 없으면 장소 이름만 쓴다', () => {
    const pins = accessPointsToMapFacilities([AP({ installLocationDetail: '', installLocation: '' })], base)
    expect(pins[0].name).toBe('서울식물원')
  })

  it('AP 가 없으면 대표 시설 하나를 그대로 돌려준다 — 기존 단일 상세 동작 유지', () => {
    expect(accessPointsToMapFacilities([], base)).toEqual([base])
  })
})

describe('mapLevelForAccessPoints', () => {
  it('한 점에 모여 있으면 가깝게 본다', () => {
    expect(mapLevelForAccessPoints([AP(), AP({ lat: 37.5001, lng: 127.0001 })])).toBe(3)
  })

  it('넓게 퍼질수록 멀리 본다 — 29km 짜리 그룹에서 핀이 화면 밖으로 나가지 않게', () => {
    const wide = mapLevelForAccessPoints([
      AP({ lat: 37.0, lng: 127.0 }),
      AP({ lat: 37.26, lng: 127.0 }),
    ])
    const narrow = mapLevelForAccessPoints([
      AP({ lat: 37.0, lng: 127.0 }),
      AP({ lat: 37.005, lng: 127.0 }),
    ])
    expect(wide).toBeGreaterThan(narrow)
  })

  it('AP 가 0~1개면 기본 레벨', () => {
    expect(mapLevelForAccessPoints([])).toBe(3)
    expect(mapLevelForAccessPoints([AP()])).toBe(3)
  })

  it('카카오 레벨 범위를 벗어나지 않는다', () => {
    const level = mapLevelForAccessPoints([AP({ lat: 33, lng: 124 }), AP({ lat: 39, lng: 131 })])
    expect(level).toBeGreaterThanOrEqual(1)
    expect(level).toBeLessThanOrEqual(14)
  })
})

describe('FAQ 회귀 — 통합 상세에서 대표 행 값을 전체인 양 쓰지 않는다', () => {
  it('AP 가 여럿이면 상세 위치를 단일 값이 아니라 지점 수로 말한다', async () => {
    const { generateDynamicFAQ } = await import('~/utils/dynamicFAQ')
    const faq = generateDynamicFAQ({
      id: 'wifi-gaaa', category: 'wifi', name: '서울식물원',
      address: null, roadAddress: null, lat: 37.5, lng: 127.0,
      city: '서울', district: '강서구', bjdCode: null,
      sourceId: 's', sourceUrl: null, viewCount: 0,
      createdAt: '', updatedAt: '', syncedAt: '',
      details: {
        ssid: 'SEOUL', installLocation: '관광', installLocationDetail: '물가쉼터 주변',
        accessPointCount: 154,
        accessPoints: [
          { id: '1', lat: 37.5, lng: 127.0, ssid: 'SEOUL', installLocation: '관광', installLocationDetail: '저류지 야외' },
          { id: '2', lat: 37.5, lng: 127.0, ssid: 'SEOUL', installLocation: '관광', installLocationDetail: '물가쉼터 주변' },
        ],
      },
    } as never)
    const answer = faq.map((f) => f.answer).join(' ')
    expect(answer).toContain('154')
    // 26곳 중 한 곳인 "물가쉼터 주변"을 유일한 상세 위치처럼 말하면 안 된다
    expect(answer).not.toContain('상세 위치: 물가쉼터 주변')
  })

  it('AP 가 하나면 종전처럼 상세 위치를 그대로 말한다', async () => {
    const { generateDynamicFAQ } = await import('~/utils/dynamicFAQ')
    const faq = generateDynamicFAQ({
      id: 'wifi-a', category: 'wifi', name: '어느 장소',
      address: null, roadAddress: null, lat: 37.5, lng: 127.0,
      city: '서울', district: '강서구', bjdCode: null,
      sourceId: 's', sourceUrl: null, viewCount: 0,
      createdAt: '', updatedAt: '', syncedAt: '',
      details: { ssid: 'SEOUL', installLocation: '관광', installLocationDetail: '물가쉼터 주변' },
    } as never)
    expect(faq.map((f) => f.answer).join(' ')).toContain('상세 위치: 물가쉼터 주변')
  })
})
