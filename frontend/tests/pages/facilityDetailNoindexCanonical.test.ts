/**
 * 시설 상세: robots=noindex 와 rel=canonical 동시 송출 금지 회귀 가드.
 * 정책: .omc/notes/noindex-canonical-policy.md
 *
 * 페이지는 useHead(computed(...)) 로 noindex 를 내보내면서, 같은 응답에서
 * setFacilityDetailMeta → setMeta 가 자기 자신을 가리키는 canonical 을 따로 발행하고 있었다.
 * 즉 "canonical 은 이 URL, 하지만 색인하지 마라"라는 모순 신호를 wifi 상세 전부와
 * thin-content 시설마다 내보낸 셈이다. 두 발행처가 서로를 모르는 구조였으므로,
 * 판정값이 setFacilityDetailMeta 까지 전달되는지를 페이지 mount 로 고정한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, isRef, defineComponent, h, Suspense } from 'vue'
import type { Ref } from 'vue'
import DetailPage from '~/pages/[category]/[id].vue'
import type { FacilityDetail } from '~/types/facility'

const routeParams = { category: 'toilet', id: 'toilet-1' }

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: routeParams, path: `/${routeParams.category}/${routeParams.id}` }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('createError', vi.fn((opts: { statusCode: number; statusMessage?: string }) => {
  const err = new Error(opts.statusMessage ?? 'Error') as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
}))
vi.stubGlobal('showError', vi.fn())

vi.mock('~/composables/useKakaoMap', () => ({
  useKakaoMap: () => ({
    isLoaded: { value: true }, map: { value: null },
    initMap: vi.fn(), addMarkers: vi.fn(), clearMarkers: vi.fn(),
    setCenter: vi.fn(), panTo: vi.fn(), setLevel: vi.fn(),
  }),
}))

const globalStubs = {
  ClientOnly: { template: '<div><slot /></div>' },
  FacilityMap: { template: '<div />' },
  FacilityFeatureCard: { template: '<div />' },
  Breadcrumb: { template: '<nav />' },
  PageHero: {
    template: '<section><component :is="titleTag || \'h1\'">{{ title }}</component></section>',
    props: ['eyebrow', 'title', 'description', 'stats', 'titleTag'],
  },
}

function baseFacility(over: Partial<FacilityDetail>): FacilityDetail {
  return {
    id: 'toilet-1',
    category: 'toilet',
    name: '강남역 공중화장실',
    address: '서울특별시 강남구 강남대로 396',
    roadAddress: '서울특별시 강남구 강남대로 396',
    lat: 37.4979,
    lng: 127.0276,
    city: '서울',
    district: '강남구',
    bjdCode: '11680',
    details: { operatingHours: '24시간', maleToilets: 3, femaleToilets: 5 },
    sourceId: 'src-1',
    sourceUrl: null,
    viewCount: 10,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    syncedAt: '2024-01-01T00:00:00Z',
    ...over,
  } as FacilityDetail
}

type HeadPayload = {
  meta?: Array<Record<string, string>>
  link?: Array<Record<string, string>>
}

let headCalls: unknown[] = []

function mockUseAsyncDataWith(data: unknown) {
  const result = {
    data: ref(data),
    status: ref('success'),
    error: ref(null),
    refresh: vi.fn(),
    pending: ref(false),
  }
  ;(globalThis as unknown as Record<string, unknown>).useAsyncData = vi.fn(() =>
    Object.assign(Promise.resolve(result), result),
  )
}

async function mountDetail() {
  const wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(DetailPage) }) }),
    { global: { stubs: globalStubs } },
  )
  await flushPromises()
  return wrapper
}

/** useHead 는 페이지에서 computed 로, setMeta 에서 일반 객체로 호출된다 — 둘 다 펼친다. */
function resolveHead(entry: unknown): HeadPayload {
  return (isRef(entry) ? (entry as Ref<HeadPayload>).value : entry) as HeadPayload
}

function collectedHead() {
  const payloads = headCalls.map(resolveHead)
  return {
    robots: payloads.flatMap((p) => p?.meta ?? []).filter((m) => m?.name === 'robots'),
    canonicals: payloads.flatMap((p) => p?.link ?? []).filter((l) => l?.rel === 'canonical'),
  }
}

describe('시설 상세 — noindex 와 canonical 동시 송출 금지', () => {
  beforeEach(() => {
    headCalls = []
    ;(globalThis as unknown as Record<string, unknown>).useHead = vi.fn((arg: unknown) => {
      headCalls.push(arg)
    })
    ;(globalThis as unknown as Record<string, unknown>).useSeoMeta = vi.fn()
    routeParams.category = 'toilet'
    routeParams.id = 'toilet-1'
  })

  it('wifi 상세는 noindex 를 내보내고 canonical 은 하나도 내보내지 않는다', async () => {
    routeParams.category = 'wifi'
    routeParams.id = 'wifi-1'
    mockUseAsyncDataWith({
      success: true,
      data: baseFacility({ id: 'wifi-1', category: 'wifi', name: '황성공원 와이파이', details: { ssid: 'PublicWiFi' } }),
    })

    await mountDetail()
    const { robots, canonicals } = collectedHead()
    expect(robots.some((m) => m.content.includes('noindex'))).toBe(true)
    expect(canonicals).toHaveLength(0)
  })

  it('구분자 없는 AED 상세도 noindex + canonical 없음', async () => {
    routeParams.category = 'aed'
    routeParams.id = 'aed-1'
    mockUseAsyncDataWith({
      success: true,
      data: baseFacility({
        id: 'aed-1', category: 'aed', name: '한국전력공사 남서울본부',
        address: null, roadAddress: null,
        details: { buildPlace: '한국전력공사 남서울본부', org: '한국전력공사' },
      }),
    })

    await mountDetail()
    const { robots, canonicals } = collectedHead()
    expect(robots.some((m) => m.content.includes('noindex'))).toBe(true)
    expect(canonicals).toHaveLength(0)
  })

  it('정상 화장실 상세는 canonical 을 내보내고 noindex 는 없다 (보호 대상)', async () => {
    mockUseAsyncDataWith({ success: true, data: baseFacility({}) })

    await mountDetail()
    const { robots, canonicals } = collectedHead()
    expect(robots.filter((m) => m.content.includes('noindex'))).toHaveLength(0)
    expect(canonicals.length).toBeGreaterThan(0)
    expect(canonicals.every((l) => l.href === 'https://ilsangkit.co.kr/toilet/toilet-1')).toBe(true)
  })
})

/**
 * 진짜 동일 레코드 통합 — 대표 URL 로의 rel=canonical.
 *
 * 실측(2026-09-04, 로컬 DB): 제목·설명을 만드는 필드가 형제와 하나도 다르지 않은 AED 가
 * 62,707행 중 361행 있다(예: '양구군보건소 보건정책과 사무실' 18행). 이 URL 들은 404 도
 * noindex 도 아니고 대표 페이지로 canonical 해서 색인을 한 문서로 모은다 —
 * noindex+canonical 동시 송출은 신호 충돌이라 금지다(.omc/notes/noindex-canonical-policy.md).
 */
describe('시설 상세 — 동일 레코드는 대표 URL 로 canonical', () => {
  beforeEach(() => {
    headCalls = []
    ;(globalThis as unknown as Record<string, unknown>).useHead = vi.fn((arg: unknown) => {
      headCalls.push(arg)
    })
    ;(globalThis as unknown as Record<string, unknown>).useSeoMeta = vi.fn()
    routeParams.category = 'aed'
    routeParams.id = 'aed-dup'
  })

  /** canonical 은 key='canonical' 하나로 dedupe 되므로, href 가 한 종류여야 태그가 하나다. */
  function soleCanonicalHref(canonicals: Array<Record<string, string>>): string {
    expect(canonicals.length).toBeGreaterThan(0)
    expect(canonicals.every((l) => l.key === 'canonical')).toBe(true)
    const hrefs = new Set(canonicals.map((l) => l.href))
    expect(hrefs.size).toBe(1)
    return [...hrefs][0]
  }

  const duplicateAed = () => baseFacility({
    id: 'aed-dup',
    category: 'aed',
    name: '양구군보건소',
    address: '강원특별자치도 양구군 양구읍 관공서로 61',
    roadAddress: '강원특별자치도 양구군 양구읍 관공서로 61',
    city: '강원특별자치도',
    district: '양구군',
    details: { buildPlace: '보건정책과 사무실', org: '양구군보건소' },
    canonicalId: 'aed-rep',
  })

  it('비대표 상세는 대표 URL 로 canonical 하고 noindex 는 내보내지 않는다', async () => {
    mockUseAsyncDataWith({ success: true, data: duplicateAed() })

    await mountDetail()
    const { robots, canonicals } = collectedHead()
    expect(robots.filter((m) => m.content.includes('noindex'))).toHaveLength(0)
    expect(soleCanonicalHref(canonicals)).toBe('https://ilsangkit.co.kr/aed/aed-rep')
  })

  it('canonical 태그는 정확히 하나다 — setMeta 와 페이지 useHead 가 같은 href 를 낸다', async () => {
    mockUseAsyncDataWith({ success: true, data: duplicateAed() })

    await mountDetail()
    const { canonicals } = collectedHead()
    // 두 발행처가 다른 href 를 내면 unhead 가 순서에 따라 한쪽을 덮어써 결과가 흔들린다.
    expect(new Set(canonicals.map((l) => l.href)).size).toBe(1)
  })

  it('대표행(canonicalId === id)은 자기참조 canonical 을 유지한다', async () => {
    mockUseAsyncDataWith({
      success: true,
      data: baseFacility({ ...duplicateAed(), id: 'aed-dup', canonicalId: 'aed-dup' }),
    })

    await mountDetail()
    const { robots, canonicals } = collectedHead()
    expect(robots.filter((m) => m.content.includes('noindex'))).toHaveLength(0)
    expect(soleCanonicalHref(canonicals)).toBe('https://ilsangkit.co.kr/aed/aed-dup')
  })

  it('canonicalId 가 없는 응답(구버전 백엔드 포함)은 종전대로 자기참조 canonical', async () => {
    const { canonicalId: _drop, ...withoutCanonicalId } = duplicateAed()
    void _drop
    mockUseAsyncDataWith({ success: true, data: withoutCanonicalId })

    await mountDetail()
    const { canonicals } = collectedHead()
    expect(soleCanonicalHref(canonicals)).toBe('https://ilsangkit.co.kr/aed/aed-dup')
  })

  it('noindex 조건(구분 불가)이 겹치면 noindex 가 이기고 canonical 은 전부 빠진다', async () => {
    // 기존 noindex 경로는 그대로 살아 있어야 한다 — 정책상 둘을 같이 내보낼 수 없다.
    mockUseAsyncDataWith({
      success: true,
      data: baseFacility({
        id: 'aed-dup', category: 'aed', name: '한국전력공사 남서울본부',
        address: null, roadAddress: null,
        details: { buildPlace: '한국전력공사 남서울본부', org: '한국전력공사' },
        canonicalId: 'aed-rep',
      }),
    })

    await mountDetail()
    const { robots, canonicals } = collectedHead()
    expect(robots.some((m) => m.content.includes('noindex'))).toBe(true)
    expect(canonicals).toHaveLength(0)
  })
})
