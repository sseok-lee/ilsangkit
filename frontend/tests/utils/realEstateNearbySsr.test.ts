import { describe, it, expect } from 'vitest'
import { fetchNearbyForSsr } from '../../utils/realEstateNearbySsr'
import type { NearbyResponse } from '../../types/realEstate'

const EMPTY: NearbyResponse = { apt: [], villa: [], offitel: [] }

function sample(): NearbyResponse {
  return {
    apt: [
      {
        buildingName: '파크리오',
        bjdCode: '1171010100',
        city: '서울',
        district: '송파구',
        dongName: '신천동',
        buildYear: 2008,
        transactionCount: 848,
        latestPrice: 110000,
        monthlyRent: null,
        latestDealYear: 2026,
        latestDealMonth: 6,
        lat: 37.5,
        lng: 127.1,
      },
    ],
    villa: [],
    offitel: [],
  }
}

describe('fetchNearbyForSsr — SSR best-effort 인근 단지 (fail-open · non-blocking)', () => {
  it('성공 시 로더 결과를 그대로 반환한다', async () => {
    const data = sample()
    const r = await fetchNearbyForSsr(async () => data)
    expect(r).toEqual(data)
  })

  it('로더가 reject해도 throw하지 않고 빈 결과를 반환한다 (풀고갈이 페이지를 깨선 안 됨)', async () => {
    const r = await fetchNearbyForSsr(async () => {
      throw new Error('P2024 pool exhausted')
    })
    expect(r).toEqual(EMPTY)
  })

  it('로더가 타임아웃을 초과하면 빈 결과를 반환한다', async () => {
    const slow = () => new Promise<NearbyResponse>((resolve) => setTimeout(() => resolve(sample()), 80))
    const r = await fetchNearbyForSsr(slow, 15)
    expect(r).toEqual(EMPTY)
  })

  it('로더가 영원히 settle 안 돼도 SSR을 매달지 않고 즉시 빈 결과로 끝낸다', async () => {
    const never = () => new Promise<NearbyResponse>(() => {})
    const start = Date.now()
    const r = await fetchNearbyForSsr(never, 25)
    expect(r).toEqual(EMPTY)
    expect(Date.now() - start).toBeLessThan(500)
  })

  it('로더가 nullish를 반환하면 빈 결과로 정규화한다', async () => {
    const r = await fetchNearbyForSsr(async () => null as unknown as NearbyResponse)
    expect(r).toEqual(EMPTY)
  })
})
