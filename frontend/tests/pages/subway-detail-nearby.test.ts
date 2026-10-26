// 지하철역 상세 "주변 시설" — nearby-grouped API 1회(useAsyncData, SSR 합류) + 실패 시 블록만 빠짐
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense } from 'vue'
import SubwayDetailPage from '~/pages/subway/[slug].vue'
import type { SubwayStation, SubwayNearbyGroup } from '~/types/subway'

const STATION: SubwayStation = {
  id: 'subway-0222', sourceId: '0222', name: '강남', nameSlug: 'gangnam', line: '2호선', transferLines: ['신분당선'],
  operator: '서울교통공사', lat: 37.4979, lng: 127.0276, address: '서울특별시 강남구 역삼동 858',
  roadAddress: '서울특별시 강남구 강남대로 396', city: '서울', district: '강남구', regionSlug: 'seoul',
  phoneNumber: null, dataDate: null, updatedAt: '2026-10-01T00:00:00Z',
}

const GROUPS: SubwayNearbyGroup[] = [
  {
    category: 'subway', count: 1, exact: true,
    items: [{ id: 'st-1', name: '신논현', nameSlug: 'sinnonhyeon', category: 'subway', lines: ['9호선', '신분당선'], distance: 726 }],
  },
  {
    category: 'parking', count: 1, exact: true,
    items: [{ id: 'parking-1', category: 'parking', name: '강남역 공영주차장', address: null, roadAddress: '서울특별시 강남구 강남대로 1', lat: 37.5, lng: 127.03, city: '서울', district: '강남구', distance: 120 }],
  },
  { category: 'market', count: 0, exact: true, items: [] },
]

const g = globalThis as unknown as Record<'useAsyncData' | '$fetch' | 'useRoute', unknown>

function asyncResult(data: unknown) {
  const result = { data: ref(data), status: ref('success'), error: ref(null), refresh: vi.fn(), pending: ref(false) }
  return Object.assign(Promise.resolve(result), result)
}

/** key-aware: subway-nearby-grouped-* 는 주변 시설 그룹, 그 외는 역 응답 */
function useAsyncDataWith(nearby: unknown) {
  const fn = vi.fn((key: string) =>
    asyncResult(String(key).startsWith('subway-nearby-grouped-') ? nearby : { success: true, data: STATION }),
  )
  g.useAsyncData = fn
  return fn
}

const stubs = {
  ClientOnly: { template: '<div><slot /></div>' },
  FacilityMap: { template: '<div />' },
  FacilityRoadview: { template: '<div />' },
  AffiliateBanner: { template: '<div />' },
  Breadcrumb: { template: '<nav>Breadcrumb</nav>' },
}

async function mountPage() {
  const wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(SubwayDetailPage) }) }),
    { global: { stubs } },
  )
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  g.useRoute = () => ({ params: { slug: 'gangnam' }, query: {}, path: '/subway/gangnam', fullPath: '/subway/gangnam', meta: {}, matched: [] })
})

describe('지하철역 상세 주변 시설', () => {
  it('nearby-grouped API 를 useAsyncData 로 1회 받아(SSR 합류) 공용 목록 틀로 렌더한다', async () => {
    const asyncData = useAsyncDataWith(GROUPS)
    const fetchMock = vi.fn().mockResolvedValue({ success: true, data: { radius: 1000, groups: GROUPS } })
    g.$fetch = fetchMock

    const wrapper = await mountPage()

    const call = asyncData.mock.calls.find((c) => String(c[0]).startsWith('subway-nearby-grouped-'))!
    expect(call[0]).toBe('subway-nearby-grouped-gangnam')
    await expect((call[1] as () => Promise<unknown>)()).resolves.toEqual(GROUPS)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/subway\/stations\/gangnam\/nearby-grouped$/)

    const block = wrapper.find('[data-testid="subway-nearby"]')
    expect(block.exists()).toBe(true)
    expect(block.text()).toContain('강남역에서 반경 1km 안의 시설입니다. 거리는 직선거리, 도보 시간은 추정입니다.')
    expect(block.find('a[href="/subway/sinnonhyeon"]').exists()).toBe(true)
    expect(block.findAll('[data-testid="subway-line-badge"]').map((b) => b.text())).toEqual(['9호선', '신분당선'])
    expect(block.find('a[href="/parking/parking-1"]').exists()).toBe(true)
    expect(block.findAll('[data-testid="nearby-facility-section"] h3').map((h3) => h3.text())).toEqual(['주변 지하철역', '주변 공영주차장'])
    const regionLink = block.find('[data-testid="nearby-facilities-region-link"]')
    expect(regionLink.attributes('href')).toBe('/seoul/gangnam')
    expect(regionLink.text()).toBe('강남구 생활시설 전체 보기 →')
  })

  it('옛 클라이언트 조회(/stations/nearby·POST /facilities/search)를 하지 않는다', async () => {
    useAsyncDataWith(GROUPS)
    const fetchMock = vi.fn().mockResolvedValue({ success: true, data: { items: [] } })
    g.$fetch = fetchMock
    await mountPage()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('주변 시설 API 가 실패하면 블록만 빠지고 본문은 렌더된다', async () => {
    const asyncData = useAsyncDataWith([])
    g.$fetch = vi.fn().mockRejectedValue(new Error('down'))
    const wrapper = await mountPage()

    const call = asyncData.mock.calls.find((c) => String(c[0]).startsWith('subway-nearby-grouped-'))!
    await expect((call[1] as () => Promise<unknown>)()).resolves.toEqual([])
    expect(wrapper.find('[data-testid="subway-nearby"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('역정보')
    expect(wrapper.text()).toContain('관련 탐색')
  })

  it('구·군 slug 를 만들 수 없으면 지역 링크만 생략한다', async () => {
    const noDistrict = { ...STATION, district: null }
    g.useAsyncData = vi.fn((key: string) =>
      asyncResult(String(key).startsWith('subway-nearby-grouped-') ? GROUPS : { success: true, data: noDistrict }),
    )
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="subway-nearby"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="nearby-facilities-region-link"]').exists()).toBe(false)
  })
})
