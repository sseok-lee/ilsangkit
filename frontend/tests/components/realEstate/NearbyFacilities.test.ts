import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense } from 'vue'
import NearbyFacilities from '~/components/realEstate/NearbyFacilities.vue'

type Item = { id: string; name: string; category: string; distance: number }

function items(category: string, names: string[], start = 100): Item[] {
  return names.map((name, i) => ({ id: `${category}-${i + 1}`, name, category, distance: start + i * 100 }))
}

const STATIONS = [
  { id: 'st-1', name: '강남', nameSlug: 'gangnam', line: '2호선', distance: 210 },
  { id: 'st-2', name: '역삼', nameSlug: 'yeoksam', line: '2호선', distance: 650 },
]

function groupedResponse(groups: Record<string, { count: number; exact: boolean; items: Item[] }>) {
  return { success: true, data: { radius: 2000, groups } }
}

const DEFAULT_GROUPS = {
  school: { count: 14, exact: true, items: [{ id: 'school-1', name: '새봄초등학교', category: 'school', distance: 320 }] },
  childcare: { count: 64, exact: true, items: [{ id: 'childcare-1', name: '키즈랄라어린이집', category: 'childcare', distance: 26 }] },
  hospital: {
    count: 123,
    exact: false,
    items: items('hospital', ['가병원', '나병원', '다병원', '라병원', '마병원']),
  },
  pharmacy: { count: 0, exact: true, items: [] },
  park: { count: 2, exact: true, items: items('park', ['가람공원', '하늘공원']) },
  sports: { count: 1, exact: true, items: items('sports', ['유앤아이센터']) },
}

function mockAsyncData(opts: {
  grouped?: unknown
  transit?: unknown
  status?: string
}) {
  const make = (data: unknown) => {
    const result = { data: ref(data), status: ref(opts.status ?? 'success'), error: ref(null), refresh: vi.fn() }
    return Object.assign(Promise.resolve(result), result)
  }
  ;(globalThis as any).useAsyncData = vi.fn((key: string) =>
    key.startsWith('nearby-transit') ? make(opts.transit ?? null) : make(opts.grouped ?? null),
  )
}

async function mountSuspended(props: Record<string, unknown> = {}) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(NearbyFacilities, { lat: 37.4979, lng: 127.0276, ...props }) })
      },
    }),
  )
  await flushPromises()
  return wrapper
}

function sections(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  return wrapper.findAll('[data-testid="nearby-facility-section"]')
}

describe('NearbyFacilities — 구분선 목록 2열 · 카테고리별 실제 개수', () => {
  beforeEach(() => {
    mockAsyncData({
      grouped: groupedResponse(DEFAULT_GROUPS),
      transit: { success: true, data: { stations: STATIONS } },
    })
  })

  it('카테고리별 개수+가까운 곳 API 를 lat/lng 포함 키로 1회 호출한다', async () => {
    await mountSuspended()
    const calls = (globalThis as any).useAsyncData.mock.calls.map((c: unknown[]) => c[0])
    expect(calls).toContain('nearby-facilities-grouped-37.4979-127.0276')
    expect(calls).toContain('nearby-transit-37.4979-127.0276')
  })

  it('nearby-grouped 엔드포인트를 2km·6개 카테고리·5곳으로 부른다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(groupedResponse(DEFAULT_GROUPS))
    ;(globalThis as any).$fetch = fetchMock
    await mountSuspended()
    const groupedCall = (globalThis as any).useAsyncData.mock.calls.find((c: unknown[]) =>
      String(c[0]).startsWith('nearby-facilities-grouped'),
    )
    await groupedCall[1]()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/facilities/nearby-grouped'), {
      query: {
        lat: 37.4979,
        lng: 127.0276,
        radius: 2000,
        categories: 'school,childcare,hospital,pharmacy,park,sports',
        limit: 5,
      },
    })
  })

  it('지하철역이 맨 위(전체 너비), 그 다음 고정 순서로 나오고 0곳 카테고리는 숨긴다', async () => {
    const wrapper = await mountSuspended()
    const headings = sections(wrapper).map((s) => s.find('h3').text())
    expect(headings).toEqual(['지하철역', '학교', '어린이집', '병원', '공원', '체육시설'])
    expect(sections(wrapper)[0].classes()).toContain('md:col-span-2')
    expect(wrapper.text()).not.toContain('약국')
  })

  it('섹션 머리에 반경 안 실제 개수를 쓰고, 하한값이면 "이상"을 붙인다', async () => {
    const wrapper = await mountSuspended()
    const counts = sections(wrapper).map((s) => s.find('[data-testid="nearby-facility-count"]').text())
    expect(counts).toEqual(['2km 안 2곳', '2km 안 14곳', '2km 안 64곳', '2km 안 123곳 이상', '2km 안 2곳', '2km 안 1곳'])
  })

  it('지하철역 개수는 transit 결과 전체 길이, 목록은 5곳까지', async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      id: `st-${i}`, name: `역${i}`, nameSlug: `st${i}`, line: '1호선', distance: 100 + i * 100,
    }))
    mockAsyncData({ grouped: groupedResponse(DEFAULT_GROUPS), transit: { success: true, data: { stations: many } } })
    const wrapper = await mountSuspended()
    const subway = sections(wrapper)[0]
    expect(subway.find('[data-testid="nearby-facility-count"]').text()).toBe('2km 안 7곳')
    expect(subway.findAll('li')).toHaveLength(5)
  })

  it('거리와 도보 추정 시간을 함께 표시한다', async () => {
    const wrapper = await mountSuspended()
    const school = sections(wrapper)[1].find('li')
    expect(school.text()).toContain('새봄초등학교')
    expect(school.text()).toContain('320m')
    expect(school.text()).toContain('도보 약 5분')
    const childcare = sections(wrapper)[2].find('li')
    expect(childcare.text()).toContain('26m')
    expect(childcare.text()).toContain('도보 약 1분')
  })

  it('시설은 /{category}/{id}, 지하철역은 /subway/{nameSlug} 로 링크한다', async () => {
    const wrapper = await mountSuspended()
    expect(sections(wrapper)[0].find('a').attributes('href')).toBe('/subway/gangnam')
    expect(sections(wrapper)[1].find('a').attributes('href')).toBe('/school/school-1')
  })

  it('지하철역 행은 노선 색 배지를 이름 앞에 둔다', async () => {
    const wrapper = await mountSuspended()
    const badge = sections(wrapper)[0].find('[data-testid="subway-line-badge"]')
    expect(badge.text()).toBe('2호선')
    expect(badge.attributes('style')).toContain('background-color')
  })

  it('4·5번째 행도 DOM 에 렌더하고 모바일에서만 CSS 로 숨긴다', async () => {
    const wrapper = await mountSuspended()
    const rows = sections(wrapper)[3].findAll('li')
    expect(rows).toHaveLength(5)
    expect(rows.map((r) => r.classes().includes('max-md:hidden'))).toEqual([false, false, false, true, true])
    expect(rows[4].text()).toContain('마병원')
  })

  it('모바일 "모두 보기" 버튼은 3곳 초과 섹션에만 있고 aria-expanded 로 토글한다', async () => {
    const wrapper = await mountSuspended()
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(1)
    const button = sections(wrapper)[3].find('button')
    expect(button.attributes('type')).toBe('button')
    expect(button.classes()).toContain('md:hidden')
    expect(button.text()).toBe('5곳 모두 보기')
    expect(button.attributes('aria-expanded')).toBe('false')

    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(sections(wrapper)[3].findAll('li').some((r) => r.classes().includes('max-md:hidden'))).toBe(false)

    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(sections(wrapper)[3].findAll('li')[3].classes()).toContain('max-md:hidden')
  })

  it('이모지 아이콘·chevron·색 거리 배지를 쓰지 않는다', async () => {
    const wrapper = await mountSuspended()
    expect(wrapper.text()).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(wrapper.html()).not.toContain('chevron_right')
    expect(wrapper.html()).not.toMatch(/emerald|rounded-2xl bg-white/)
  })

  it('하단 출처 문구는 항상, 지역 링크는 regionHref 가 있을 때만', async () => {
    const without = await mountSuspended()
    expect(without.text()).toContain('공공데이터포털 시설 데이터 · 카테고리별 가까운 순 최대 5곳')
    expect(without.find('[data-testid="nearby-facilities-region-link"]').exists()).toBe(false)

    const withLink = await mountSuspended({ regionHref: '/seoul/gangnam', regionLabel: '강남구' })
    const link = withLink.find('[data-testid="nearby-facilities-region-link"]')
    expect(link.attributes('href')).toBe('/seoul/gangnam')
    expect(link.text()).toBe('강남구 생활시설 전체 보기 →')
  })

  it('로딩 중에는 스피너를 표시한다', async () => {
    mockAsyncData({ status: 'pending' })
    const wrapper = await mountSuspended()
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true)
  })

  it('시설·역이 모두 없으면 빈 상태 문구를 표시한다', async () => {
    mockAsyncData({
      grouped: groupedResponse({ school: { count: 0, exact: true, items: [] } }),
      transit: { success: true, data: { stations: [] } },
    })
    const wrapper = await mountSuspended()
    expect(wrapper.text()).toContain('조건에 맞는 시설이 없습니다')
    expect(sections(wrapper)).toHaveLength(0)
  })
})
