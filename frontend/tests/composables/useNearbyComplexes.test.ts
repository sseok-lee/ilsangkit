import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useNearbyComplexes } from '../../composables/useNearbyComplexes'
import type { NearbyResponse } from '../../types/realEstate'

const list = (name: string): NearbyResponse => ({
  apt: [{ buildingName: name, city: '서울', district: '강남구', dongName: '역삼동', bjdCode: '1168010100', latestPrice: 50000, buildYear: 2000, transactionCount: 12, monthlyRent: null, latestDealYear: 2026, latestDealMonth: 8, lat: 37.5, lng: 127.03 }],
  villa: [], offitel: [],
})
const empty: NearbyResponse = { apt: [], villa: [], offitel: [] }
const scopes: ReturnType<typeof effectScope>[] = []
function setup(initial: NearbyResponse = list('SSR'), loaded = true) {
  const query = ref({ bjdCode: '1168010100', mode: 'rent' as 'rent' | 'sale', rentType: 'all', dongName: '역삼동', excludeBuildingName: 'A', limitPerType: 4 })
  const fetcher = vi.fn().mockResolvedValue(list('new'))
  const scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() => useNearbyComplexes(query, fetcher, loaded ? initial : undefined))!
  return { query, fetcher, scope, ...state }
}
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))

describe('nearby SSR hydration and query ownership', () => {
  it('retries failed or missing SSR once on hydration and recovers without a query change', async () => {
    const state = setup(empty, false)
    await flushPromises()
    expect(state.fetcher).toHaveBeenCalledTimes(1)
    expect(state.nearby.value).toEqual(list('new'))
  })

  it('does not retry a genuine successful empty SSR result', () => {
    const state = setup(empty)
    expect(state.fetcher).not.toHaveBeenCalled()
    expect(state.nearby.value).toEqual(empty)
  })
  it('does not refetch SSR data on hydration and preserves it on a failed same-key refresh', async () => {
    const state = setup()
    expect(state.fetcher).not.toHaveBeenCalled()
    state.fetcher.mockRejectedValue(new Error('offline'))
    await state.refresh()
    expect(state.nearby.value).toEqual(list('SSR'))
  })

  it('accepts a successful empty response', async () => {
    const state = setup()
    state.fetcher.mockResolvedValue(empty)
    await state.refresh()
    expect(state.nearby.value).toEqual(empty)
  })

  it.each(['bjdCode', 'mode', 'rentType', 'dongName', 'excludeBuildingName', 'limitPerType'] as const)('clears old data immediately when %s changes even if the API fails', async field => {
    const state = setup()
    state.fetcher.mockRejectedValue(new Error('offline'))
    Object.assign(state.query.value, { [field]: field === 'limitPerType' ? 3 : field === 'mode' ? 'sale' : 'different' })
    // Invalid rent filters normalize to all; use a supported filter.
    if (field === 'rentType') state.query.value.rentType = 'jeonse'
    expect(state.nearby.value).toEqual(empty)
    await flushPromises()
    expect(state.nearby.value).toEqual(empty)
  })

  it('invalidates in-flight requests even when the region becomes empty', async () => {
    const state = setup()
    let finish!: (data: NearbyResponse) => void
    state.fetcher.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const pending = state.refresh()
    state.query.value.bjdCode = ''
    finish(list('stale'))
    await pending
    expect(state.nearby.value).toEqual(empty)
  })

  it('ignores an older response across A → B → A and same-key racing refreshes', async () => {
    const state = setup()
    const finishes: ((data: NearbyResponse) => void)[] = []
    state.fetcher.mockImplementation(() => new Promise(resolve => { finishes.push(resolve) }))
    void state.refresh()
    state.query.value.excludeBuildingName = 'B'
    state.query.value.excludeBuildingName = 'A'
    finishes[2](list('latest A'))
    finishes[1](list('old B'))
    finishes[0](list('old A'))
    await flushPromises()
    expect(state.nearby.value).toEqual(list('latest A'))
    void state.refresh()
    void state.refresh()
    finishes[4](empty)
    finishes[3](list('late same key'))
    await flushPromises()
    expect(state.nearby.value).toEqual(empty)
  })

  it('does not update after disposal', async () => {
    const state = setup()
    let finish!: (data: NearbyResponse) => void
    state.fetcher.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const pending = state.refresh()
    state.scope.stop()
    finish(list('late'))
    await pending
    expect(state.nearby.value).toEqual(list('SSR'))
  })
})
