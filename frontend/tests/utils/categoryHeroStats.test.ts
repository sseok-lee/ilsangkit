import { describe, it, expect, vi } from 'vitest'
import { buildHeroStats } from '~/utils/categoryHeroStats'

describe('buildHeroStats', () => {
  it('hospital: 종별/의사/주차 stat을 만든다', () => {
    const items = buildHeroStats('hospital', { clCdNm: '종합병원', drTotCnt: 10, parkQty: 5 }, '')
    expect(items).toContainEqual({ label: '종별', value: '종합병원' })
    expect(items).toContainEqual({ label: '의사', value: '10명' })
    expect(items).toContainEqual({ label: '주차', value: '5대' })
  })
  it('parking: 주차면수/요금/구분', () => {
    const items = buildHeroStats('parking', { capacity: 100, feeType: '유료', lotType: '노상' }, '')
    expect(items).toContainEqual({ label: '주차면수', value: '100면' })
    expect(items).toContainEqual({ label: '요금', value: '유료' })
  })
  it('pharmacy: 전화 fallback', () => {
    const items = buildHeroStats('pharmacy', {}, '02-123-4567')
    expect(items).toContainEqual({ label: '전화', value: '02-123-4567' })
  })
  it('미등록 카테고리: 전화 default + dev 경고', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const items = buildHeroStats('unknown-cat' as any, {}, '031-000-0000')
    expect(items).toContainEqual({ label: '전화', value: '031-000-0000' })
    warn.mockRestore()
  })
})

describe('pharmacy 칩 보강', () => {
  it('약사수·오늘 영업시간·전화 순으로 렌더한다', () => {
    const stats = buildHeroStats('pharmacy', { pharmacistCnt: 2, _todayHours: '09:00~18:00' }, '02-123-4567')
    expect(stats).toEqual([
      { label: '약사', value: '2명' },
      { label: '오늘', value: '09:00~18:00' },
      { label: '전화', value: '02-123-4567' },
    ])
  })
  it('데이터 없으면 해당 칩 생략(전화만)', () => {
    expect(buildHeroStats('pharmacy', {}, '02-1')).toEqual([{ label: '전화', value: '02-1' }])
  })
  it('오늘 휴무(_todayHours null)면 오늘 칩 생략', () => {
    const stats = buildHeroStats('pharmacy', { pharmacistCnt: 1, _todayHours: null }, '')
    expect(stats).toEqual([{ label: '약사', value: '1명' }])
  })
})

describe('얇은 카테고리 칩 보강', () => {
  it('wifi: SSID + 설치장소', () => {
    expect(buildHeroStats('wifi', { ssid: '3층', installLocation: '시청 로비' }, '')).toEqual([
      { label: 'SSID', value: '3층' },
      { label: '설치장소', value: '시청 로비' },
    ])
  })
  it('wifi: 설치장소 없으면 SSID만', () => {
    expect(buildHeroStats('wifi', { ssid: 'A' }, '')).toEqual([{ label: 'SSID', value: 'A' }])
  })
  it('sports: 전화 있어도 시설구분·유형·면적을 보여준다(전화 fallback 제거)', () => {
    const stats = buildHeroStats('sports', { faciGbNm: '공공', ftypeNm: '체육관', faciGfa: 1200 }, '02-1')
    expect(stats).toEqual([
      { label: '시설구분', value: '공공' },
      { label: '유형', value: '체육관' },
      { label: '면적', value: '1,200㎡' },
    ])
  })
  it('sports: 정보 전무하면 전화 fallback', () => {
    expect(buildHeroStats('sports', {}, '02-1')).toEqual([{ label: '전화', value: '02-1' }])
  })
  it('clothes: 상세위치 있으면 표시, 없으면 전화 fallback', () => {
    expect(buildHeroStats('clothes', { detailLocation: '정문 앞' }, '02-1')).toEqual([{ label: '위치', value: '정문 앞' }])
    expect(buildHeroStats('clothes', {}, '02-1')).toEqual([{ label: '전화', value: '02-1' }])
  })
  it('sports: 면적 0이면 면적 칩 생략', () => {
    expect(buildHeroStats('sports', { faciGbNm: '공공', faciGfa: 0 }, '')).toEqual([{ label: '시설구분', value: '공공' }])
  })
  it('sports: 일부 팩트만 있어도 전화 칩은 숨긴다', () => {
    expect(buildHeroStats('sports', { faciGbNm: '공공' }, '02-1')).toEqual([{ label: '시설구분', value: '공공' }])
  })
  it('wifi: SSID 없이 설치장소만 있어도 표시', () => {
    expect(buildHeroStats('wifi', { installLocation: '시청 로비' }, '')).toEqual([{ label: '설치장소', value: '시청 로비' }])
  })
})
