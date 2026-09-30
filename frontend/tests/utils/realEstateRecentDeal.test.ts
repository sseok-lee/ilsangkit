import { describe, it, expect } from 'vitest'
import { resolveRecentDeal, resolveLatestSaleDeal, formatLatestPrice } from '~/utils/realEstateRecentDeal'

describe('resolveRecentDeal', () => {
  it('보증금과 월세, 거래월을 함께 뽑는다', () => {
    // 부평 현대 라이브 표본
    expect(resolveRecentDeal({
      latestDealAmount: 2000, latestMonthlyRent: 80, latestDealYear: 2026, latestDealMonth: 8,
    })).toEqual({ amount: 2000, monthlyRent: 80, dealDate: '2026년 8월' })
  })

  it('보증금 0 을 없음으로 뭉개지 않는다 — 무보증 월세가 통째로 사라졌다', () => {
    const deal = resolveRecentDeal({
      latestDealAmount: 0, latestMonthlyRent: 80, latestDealYear: 2026, latestDealMonth: 8,
    })
    expect(deal.amount).toBe(0)
    expect(deal.monthlyRent).toBe(80)
  })

  it('월세 0(전세)과 null(미상)을 구분해 보존한다', () => {
    expect(resolveRecentDeal({
      latestDealAmount: 40000, latestMonthlyRent: 0, latestDealYear: 2026, latestDealMonth: 9,
    }).monthlyRent).toBe(0)
    expect(resolveRecentDeal({
      latestDealAmount: 40000, latestMonthlyRent: null, latestDealYear: 2026, latestDealMonth: 9,
    }).monthlyRent).toBeNull()
  })

  it('거래 정보가 없으면 전부 null 이다', () => {
    expect(resolveRecentDeal(null)).toEqual({ amount: null, monthlyRent: null, dealDate: null })
  })

  it('거래월이 없으면 dealDate 만 null 이다', () => {
    const deal = resolveRecentDeal({
      latestDealAmount: 50000, latestMonthlyRent: null, latestDealYear: null, latestDealMonth: null,
    })
    expect(deal.amount).toBe(50000)
    expect(deal.dealDate).toBeNull()
  })
})

describe('resolveLatestSaleDeal', () => {
  it('overview.latestSale을 최근 매매 단일 소스로 변환한다', () => {
    expect(resolveLatestSaleDeal({
      identity: { bjdCode: '11680', buildingName: '반포자이' },
      latestSale: { id: 1, amount: 80000, year: 2026, month: 9, day: 12, area: '84.90', floor: 0 },
      buildYear: 2009,
      minArea: '59.98',
      maxArea: '132.44',
      saleCount6m: 8,
      window6m: { from: '2026-03-21', to: '2026-09-21' },
      addresses: [],
      location: null,
      locationAmbiguous: false,
      generatedAt: '2026-09-21T00:00:00.000Z',
    })).toEqual({ amount: 80000, monthlyRent: null, dealDate: '2026년 9월 12일' })
  })

  it('latestSale이 없으면 금액 메타를 만들 수 없는 null 값을 반환한다', () => {
    expect(resolveLatestSaleDeal({ latestSale: null } as any)).toEqual({
      amount: null,
      monthlyRent: null,
      dealDate: null,
    })
  })
})

describe('formatLatestPrice', () => {
  it('보증금과 월세를 함께 표시한다', () => {
    expect(formatLatestPrice({ amount: 2000, monthlyRent: 80, dealDate: '2026년 8월' }))
      .toBe('2,000만원 / 80만원')
  })

  it('월세가 없으면 금액만 표시한다', () => {
    expect(formatLatestPrice({ amount: 285000, monthlyRent: null, dealDate: '2025년 3월' }))
      .toBe('28억 5,000만원')
  })

  it('보증금 0·월세 양수는 월세만 표시한다 — 대시로 지우지 않는다', () => {
    expect(formatLatestPrice({ amount: 0, monthlyRent: 80, dealDate: '2026년 8월' }))
      .toBe('월세 80만원')
  })

  it('금액이 모두 없으면 대시를 반환한다', () => {
    expect(formatLatestPrice({ amount: null, monthlyRent: null, dealDate: null })).toBe('-')
    expect(formatLatestPrice({ amount: 0, monthlyRent: 0, dealDate: '2026년 8월' })).toBe('-')
  })
})
