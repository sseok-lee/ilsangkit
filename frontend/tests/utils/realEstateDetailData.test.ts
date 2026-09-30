import { describe, expect, it } from 'vitest'
import { hasUsableRealEstateDetailData } from '~/utils/realEstateDetailData'

describe('hasUsableRealEstateDetailData', () => {
  it('returns false for empty payloads', () => {
    expect(hasUsableRealEstateDetailData(null)).toBe(false)
    expect(
      hasUsableRealEstateDetailData({
        bjdCode: '',
        statsResponse: { monthly: [], summary: null },
        transactions: { items: [], total: 0, page: 1, totalPages: 0 },
        buildingInfo: null,
        areaGroups: [],
      })
    ).toBe(false)
  })

  it('returns true when building info exists', () => {
    expect(
      hasUsableRealEstateDetailData({
        buildingInfo: {
          bjdCode: '11110',
          buildingName: '성원',
          city: '서울',
          district: '종로구',
          dongName: '청운동',
          roadName: null,
          jibun: null,
          buildYear: 1994,
          minArea: 49.98,
          maxArea: 84.96,
          latestDealAmount: 42000,
          latestDealYear: 2026,
          latestDealMonth: 4,
          lat: 37.58,
          lng: 126.97,
        },
      })
    ).toBe(true)
  })

  it('returns true when stats or transactions exist', () => {
    expect(
      hasUsableRealEstateDetailData({
        statsResponse: {
          monthly: [],
          summary: {
            recentAvg: 10000,
            previousAvg: 9000,
            changeRate: 11.1,
            totalCount: 12,
            lowVolume: false,
            priceLabel: '매매가',
          },
        },
      })
    ).toBe(true)

    expect(
      hasUsableRealEstateDetailData({
        transactions: {
          items: [],
          total: 3,
          page: 1,
          totalPages: 1,
        },
      })
    ).toBe(true)

    expect(
      hasUsableRealEstateDetailData({
        areaGroups: [{ area: 84, pyeong: 25, count: 10 }],
      })
    ).toBe(true)
  })

  it('returns true for a valid exact snapshot even when it has zero rows', () => {
    expect(
      hasUsableRealEstateDetailData({
        snapshot: {
          filters: {
            bjdCode: '11680',
            buildingName: '반포자이',
            mode: 'sale',
            months: 6,
            area: '84.90',
            deposit: null,
          },
          window: { from: '2026-03-21', to: '2026-09-21' },
          options: { areas: ['84.90'], deposits: [] },
          points: [],
          table: { items: [], total: 0, page: 1, totalPages: 0 },
          generatedAt: '2026-09-21T00:00:00.000Z',
          adjustment: null,
        },
      })
    ).toBe(true)
  })
})
