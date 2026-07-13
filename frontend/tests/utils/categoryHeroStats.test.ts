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
