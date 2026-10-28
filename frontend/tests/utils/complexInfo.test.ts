import { describe, it, expect } from 'vitest'
import type { ComplexInfo } from '~/types/housingRedesign'
import {
  approvalYear,
  buildComplexFactsLine,
  buildComplexInfoRows,
  groupComplexAreas,
} from '~/utils/complexInfo'

const GAEPO: ComplexInfo = {
  matchType: 'address',
  kaptCode: 'A13580602',
  name: '개포경남아파트',
  householdCount: 678,
  dongCount: 9,
  topFloor: 15,
  basementFloors: 0,
  useApprovalDate: '1984-03-08',
  totalParking: 747,
  groundParking: 747,
  undergroundParking: 0,
  heatingType: '지역난방',
  corridorType: '계단식',
  builder: '경남건설',
  developer: '경남건설',
  managementType: '위탁관리',
  saleType: '분양',
  elevatorCount: 26,
  cctvCount: 102,
  evChargerCount: 9,
  areas: [
    [84.6, 2], [84.725, 1], [91.91, 29], [96.98, 166], [123.28, 192], [149.21, 59],
    [149.57, 1], [166.48, 48], [182.11, 1], [182.2, 149], [186.16, 30],
  ].map(([exclusiveArea, householdCount]) => ({ exclusiveArea, householdCount })),
  sourceDate: '2026-10-26',
}

const EMPTY: ComplexInfo = {
  ...GAEPO,
  householdCount: null, dongCount: null, topFloor: null, basementFloors: null, useApprovalDate: null,
  totalParking: null, groundParking: null, undergroundParking: null, heatingType: null, corridorType: null,
  builder: null, developer: null, managementType: null, saleType: null, elevatorCount: null, cctvCount: null,
  evChargerCount: null, areas: [],
}

const TODAY = new Date('2025-06-01T00:00:00+09:00')
const rowsOf = (c: ComplexInfo) => Object.fromEntries(buildComplexInfoRows(c, TODAY).map((r) => [r.label, r.value]))

describe('approvalYear / buildComplexFactsLine', () => {
  it('사용승인 연도', () => {
    expect(approvalYear(GAEPO)).toBe(1984)
    expect(approvalYear(EMPTY)).toBeNull()
  })

  it('헤더 요약 줄', () => {
    expect(buildComplexFactsLine(GAEPO)).toBe('678세대 · 9개 동 · 최고 15층 · 1984년 사용승인')
    expect(buildComplexFactsLine({ ...GAEPO, householdCount: 2296, dongCount: null })).toBe('2,296세대 · 최고 15층 · 1984년 사용승인')
    expect(buildComplexFactsLine(EMPTY)).toBe('')
  })
})

describe('buildComplexInfoRows', () => {
  it('스펙 표 순서와 문구', () => {
    expect(buildComplexInfoRows(GAEPO, TODAY)).toEqual([
      { label: '세대수 · 동수', value: '678세대 · 9개 동' },
      { label: '층수', value: '최고 15층 · 지하 없음' },
      { label: '사용승인', value: '1984년 3월 (42년차)' },
      { label: '주차', value: '747면 · 세대당 1.10대 (지상 747 · 지하 0)' },
      { label: '난방 · 복도', value: '지역난방 · 계단식' },
      { label: '시공 · 시행', value: '경남건설' },
      { label: '관리 · 분양', value: '위탁관리 · 분양' },
      { label: '승강기 · CCTV', value: '26대 · 102대' },
      { label: '전기차 충전', value: '9기' },
    ])
  })

  it('지하층이 있으면 층수로 표시', () => {
    expect(rowsOf({ ...GAEPO, basementFloors: 2 })['층수']).toBe('최고 15층 · 지하 2층')
  })

  it('세대수가 없거나 0이면 세대당 주차를 뺀다', () => {
    expect(rowsOf({ ...GAEPO, householdCount: null })['주차']).toBe('747면 (지상 747 · 지하 0)')
    expect(rowsOf({ ...GAEPO, householdCount: 0 })['주차']).toBe('747면 (지상 747 · 지하 0)')
    expect(rowsOf({ ...GAEPO, groundParking: null, undergroundParking: null })['주차']).toBe('747면 · 세대당 1.10대')
  })

  it('시공·시행이 다르면 둘 다, 한쪽만 있으면 한쪽', () => {
    expect(rowsOf({ ...GAEPO, developer: '대한주택공사' })['시공 · 시행']).toBe('경남건설 · 대한주택공사')
    expect(rowsOf({ ...GAEPO, developer: null })['시공 · 시행']).toBe('경남건설')
  })

  it('승강기·CCTV 한쪽만 있으면 이름을 붙인다', () => {
    expect(rowsOf({ ...GAEPO, cctvCount: null })['승강기 · CCTV']).toBe('승강기 26대')
    expect(rowsOf({ ...GAEPO, elevatorCount: null })['승강기 · CCTV']).toBe('CCTV 102대')
  })

  it('0 은 표시하고, 값이 하나도 없으면 줄을 숨긴다', () => {
    expect(rowsOf({ ...GAEPO, evChargerCount: 0 })['전기차 충전']).toBe('0기')
    expect(buildComplexInfoRows(EMPTY, TODAY)).toEqual([])
  })
})

describe('groupComplexAreas', () => {
  it('반올림 면적 기준 5㎡ 이내를 묶는다', () => {
    const groups = groupComplexAreas(GAEPO.areas)
    expect(groups.map((g) => g.label)).toEqual(['85㎡', '92~97㎡', '123㎡', '149~150㎡', '166㎡', '182~186㎡'])
    expect(groups.map((g) => g.householdCount)).toEqual([3, 195, 192, 60, 48, 180])
    expect(groups[1].ratio).toBe(1)
    expect(groups[0].ratio).toBeCloseTo(3 / 195)
  })

  it('묶음이 8개를 넘으면 10㎡ 단위로 다시 묶는다', () => {
    const areas = [40, 50, 60, 70, 80, 90, 100, 110, 120].map((exclusiveArea) => ({ exclusiveArea, householdCount: 10 }))
    expect(groupComplexAreas(areas).map((g) => g.label)).toEqual(['40~50㎡', '60~70㎡', '80~90㎡', '100~110㎡', '120㎡'])
  })

  it('빈 목록·세대 0 면적', () => {
    expect(groupComplexAreas([])).toEqual([])
    expect(groupComplexAreas([{ exclusiveArea: 59.9, householdCount: 0 }])).toEqual([])
  })
})
