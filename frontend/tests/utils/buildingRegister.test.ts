import { describe, it, expect } from 'vitest'
import type { BuildingRegisterInfo } from '~/types/housingRedesign'
import {
  registerSectionTitle,
  registerUnitsText,
  registerApprovalYear,
  buildRegisterFactsLine,
  buildRegisterInfoRows,
} from '~/utils/buildingRegister'

// 야탑동 177 대원빌라3단지 (2026-10 건축물대장)
const YATAP: BuildingRegisterInfo = {
  kind: 'residential',
  householdCount: 216,
  offitelUnitCount: null,
  dongCount: 9,
  topFloor: 4,
  basementFloors: 1,
  useApprovalDate: '1994-11-08',
  totalParking: 206,
  elevatorCount: 0,
  purposes: ['연립주택'],
  structure: '철근콘크리트구조',
  sourceMonth: '2026-09',
  unitSourceMonth: null,
}

// 아크로텔 강남역
const ACROTEL: BuildingRegisterInfo = {
  kind: 'offitel',
  householdCount: null,
  offitelUnitCount: 471,
  dongCount: 1,
  topFloor: 20,
  basementFloors: 6,
  useApprovalDate: '2016-07-29',
  totalParking: 180,
  elevatorCount: 3,
  purposes: ['오피스텔'],
  structure: '철근콘크리트구조',
  sourceMonth: '2026-09',
  unitSourceMonth: '2026-09',
}

const TODAY = new Date('2026-10-29T12:00:00+09:00')

describe('buildingRegister 표시', () => {
  it('섹션 제목: 동 2개 이상이면 단지, 아니면 건물', () => {
    expect(registerSectionTitle(YATAP)).toBe('단지 정보')
    expect(registerSectionTitle(ACROTEL)).toBe('건물 정보')
    expect(registerSectionTitle({ ...ACROTEL, dongCount: null })).toBe('건물 정보')
  })

  it('세대·호수 문구', () => {
    expect(registerUnitsText(YATAP)).toBe('216세대')
    expect(registerUnitsText(ACROTEL)).toBe('오피스텔 471호')
    expect(registerUnitsText({ ...ACROTEL, offitelUnitCount: null })).toBeNull()
  })

  it('사용승인 연도', () => {
    expect(registerApprovalYear(YATAP)).toBe(1994)
    expect(registerApprovalYear({ ...YATAP, useApprovalDate: null })).toBeNull()
  })

  it('헤더 요약 줄', () => {
    expect(buildRegisterFactsLine(YATAP)).toBe('216세대 · 9개 동 · 최고 4층 · 1994년 사용승인')
    expect(buildRegisterFactsLine(ACROTEL)).toBe('오피스텔 471호 · 최고 20층 · 2016년 사용승인')
    expect(buildRegisterFactsLine({ ...YATAP, householdCount: null, useApprovalDate: null })).toBe('9개 동 · 최고 4층')
  })

  it('표: 빌라 단지', () => {
    expect(buildRegisterInfoRows(YATAP, TODAY)).toEqual([
      { label: '세대수 · 동수', value: '216세대 · 9개 동' },
      { label: '층수', value: '최고 4층 · 지하 1층' },
      { label: '사용승인', value: '1994년 11월 (33년차)' },
      { label: '주차', value: '206면 · 세대당 0.95대' },
      { label: '승강기', value: '없음' },
      { label: '용도 · 구조', value: '연립주택 · 철근콘크리트구조' },
    ])
  })

  it('표: 오피스텔 1동', () => {
    expect(buildRegisterInfoRows(ACROTEL, TODAY)).toEqual([
      { label: '호수', value: '오피스텔 471호' },
      { label: '층수', value: '최고 20층 · 지하 6층' },
      { label: '사용승인', value: '2016년 7월 (11년차)' },
      { label: '주차', value: '180면 · 호당 0.38대' },
      { label: '승강기', value: '3대' },
      { label: '용도 · 구조', value: '오피스텔 · 철근콘크리트구조' },
    ])
  })

  it('표: 값 없는 줄은 빼고 지하 0 은 "지하 없음"', () => {
    const rows = buildRegisterInfoRows({
      ...YATAP, dongCount: 1, basementFloors: 0, totalParking: null, elevatorCount: null, structure: null, purposes: [],
    }, TODAY)
    expect(rows).toEqual([
      { label: '세대수', value: '216세대' },
      { label: '층수', value: '최고 4층 · 지하 없음' },
      { label: '사용승인', value: '1994년 11월 (33년차)' },
    ])
  })
})
