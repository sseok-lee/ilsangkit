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
