import { describe, it, expect } from 'vitest'
import { resolveRegionDisplay } from '~/utils/regionDisplayState'

// 지역×카테고리 목록의 SSR↔클라이언트 표시 선택 규칙.
// 이 함수가 곧 SSR HTML 에 실제 시설이 렌더되는지를 좌우한다.
describe('resolveRegionDisplay', () => {
  const client0 = { items: [] as string[], total: 0, totalPages: 0, loading: false }

  it('SSR 데이터가 있고 미소비면 SSR 목록을 렌더하고 로딩 아님 (핵심: SSR HTML 에 시설 노출)', () => {
    const s = resolveRegionDisplay({
      ssrConsumed: false,
      ssr: { items: ['a', 'b', 'c'], total: 42, totalPages: 3 },
      client: client0,
    })
    expect(s.facilities).toEqual(['a', 'b', 'c'])
    expect(s.total).toBe(42)
    expect(s.totalPages).toBe(3)
    expect(s.loading).toBe(false)
  })

  it('SSR 이 빈 지역(items[], total 0)이면 빈 상태로 렌더하고 로딩 아님', () => {
    const s = resolveRegionDisplay({
      ssrConsumed: false,
      ssr: { items: [], total: 0, totalPages: 0 },
      client: client0,
    })
    expect(s.facilities).toEqual([])
    expect(s.total).toBe(0)
    expect(s.loading).toBe(false)
  })

  it('클라이언트 재조회 후(ssrConsumed)면 SSR 데이터가 있어도 client 를 쓴다', () => {
    const s = resolveRegionDisplay({
      ssrConsumed: true,
      ssr: { items: ['old'], total: 100, totalPages: 5 },
      client: { items: ['new1', 'new2'], total: 2, totalPages: 1, loading: false },
    })
    expect(s.facilities).toEqual(['new1', 'new2'])
    expect(s.total).toBe(2)
    expect(s.totalPages).toBe(1)
  })

  it('client 가 이미 데이터를 가지면(ssrConsumed 아직 false여도) client 우선', () => {
    const s = resolveRegionDisplay({
      ssrConsumed: false,
      ssr: { items: ['ssr'], total: 9, totalPages: 1 },
      client: { items: ['c1'], total: 1, totalPages: 1, loading: false },
    })
    expect(s.facilities).toEqual(['c1'])
    expect(s.total).toBe(1)
  })

  it('degraded(ssr null)·미소비·client 빈 상태 → 빈 목록 + client.loading', () => {
    const s = resolveRegionDisplay({
      ssrConsumed: false,
      ssr: null,
      client: { items: [], total: 0, totalPages: 0, loading: false },
    })
    expect(s.facilities).toEqual([])
    expect(s.loading).toBe(false)
  })

  it('degraded 후 클라이언트 보충 로드 중이면 loading=true 로 스피너 노출', () => {
    const s = resolveRegionDisplay({
      ssrConsumed: true,
      ssr: null,
      client: { items: [], total: 0, totalPages: 0, loading: true },
    })
    expect(s.loading).toBe(true)
    expect(s.facilities).toEqual([])
  })
})
