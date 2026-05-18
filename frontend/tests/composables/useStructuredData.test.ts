import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUseHead = vi.fn()
vi.stubGlobal('useHead', mockUseHead)

// SITE_URL mock
vi.mock('~/utils/seoConstants', () => ({
  SITE_NAME: '일상킷',
  SITE_URL: 'https://ilsangkit.co.kr',
}))

// CATEGORY_META mock
vi.mock('~/types/facility', () => ({
  CATEGORY_META: {
    toilet: { label: '공공화장실' },
    hospital: { label: '병원' },
  },
}))

import { useStructuredData } from '~/composables/useStructuredData'

describe('useStructuredData', () => {
  beforeEach(() => {
    mockUseHead.mockClear()
  })

  // ─── FAQPage/HowTo 스키마 제거됨 (2023.08 상업사이트 제한 / 2023.09 폐기) ──


  // ─── Organization sameAs ───────────────────────────────────────────────────
  // 자기 자신 URL 만 들어있던 sameAs 는 schema.org 의미상 noise 라 제거됨.
  // 외부 신뢰 프로필(네이버 비즈니스, 카카오채널 등) 확보 시 다시 부착.

  describe('setOrganizationSchema sameAs', () => {
    it('setOrganizationSchema 호출 시 sameAs 필드는 포함되지 않는다 (외부 프로필 미보유)', () => {
      const { setOrganizationSchema } = useStructuredData()
      setOrganizationSchema()
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed.sameAs).toBeUndefined()
    })
  })


  // ─── Task 14: Hospital OpeningHoursSpecification ───────────────────────────

  describe('setFacilitySchema - hospital OpeningHours', () => {
    const makeHospitalFacility = (detailsOverride = {}) => ({
      id: 'hosp-1',
      category: 'hospital' as const,
      name: '테스트병원',
      address: '서울시 강남구 테헤란로 1',
      roadAddress: '서울시 강남구 테헤란로 1',
      lat: 37.5,
      lng: 127.0,
      city: '서울시',
      district: '강남구',
      bjdCode: null,
      sourceId: 'H001',
      sourceUrl: null,
      viewCount: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      syncedAt: '2024-01-01T00:00:00Z',
      details: {
        phone: '02-1234-5678',
        clCdNm: '종합병원',
        ...detailsOverride,
      },
    })

    it('hospital facility에 trmtMonStart/trmtMonEnd 있을 때 openingHoursSpecification이 포함된다', () => {
      const { setFacilitySchema } = useStructuredData()
      setFacilitySchema(makeHospitalFacility({ trmtMonStart: '0900', trmtMonEnd: '1800' }))
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(Array.isArray(parsed.openingHoursSpecification)).toBe(true)
      expect(parsed.openingHoursSpecification.length).toBeGreaterThan(0)
    })

    it('OpeningHoursSpecification 배열에 Monday 항목이 HH:MM 형식으로 포함된다', () => {
      const { setFacilitySchema } = useStructuredData()
      setFacilitySchema(makeHospitalFacility({ trmtMonStart: '0900', trmtMonEnd: '1800' }))
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      const monday = parsed.openingHoursSpecification.find((s: any) => s.dayOfWeek === 'Monday')
      expect(monday).toBeDefined()
      expect(monday['@type']).toBe('OpeningHoursSpecification')
      expect(monday.opens).toBe('09:00')
      expect(monday.closes).toBe('18:00')
    })

    it('trmtXxxStart/End 패턴으로 여러 요일을 매핑한다', () => {
      const { setFacilitySchema } = useStructuredData()
      setFacilitySchema(makeHospitalFacility({
        trmtMonStart: '0900', trmtMonEnd: '1800',
        trmtTueStart: '0900', trmtTueEnd: '1800',
        trmtSatStart: '0900', trmtSatEnd: '1300',
      }))
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed.openingHoursSpecification).toHaveLength(3)
      const days = parsed.openingHoursSpecification.map((s: any) => s.dayOfWeek)
      expect(days).toContain('Monday')
      expect(days).toContain('Tuesday')
      expect(days).toContain('Saturday')
    })

    it('trmtXxxStart 필드가 없으면 openingHoursSpecification이 포함되지 않는다', () => {
      const { setFacilitySchema } = useStructuredData()
      setFacilitySchema(makeHospitalFacility())
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed.openingHoursSpecification).toBeUndefined()
    })
  })

  // ─── SEO Exec Plan US-004: setRealEstateListingSchema SSR-safe url ─────────

  // 이전 구현은 `typeof window !== 'undefined' ? window.location.href : ''` 를 사용해
  // SSR 첫 렌더에서 빈 url을 내보냈다. 새 API 는 호출부가 절대 URL 을 전달해야 하고,
  // useHead 는 팩토리 함수를 받아 reactive 업데이트를 지원한다.
  describe('setRealEstateListingSchema (SSR-safe url)', () => {
    it('호출부가 전달한 url 이 schema.url 로 그대로 직렬화된다 (plain options)', () => {
      const { setRealEstateListingSchema } = useStructuredData()
      setRealEstateListingSchema({
        name: '래미안테스트',
        address: '서울시 강남구 테헤란로 1',
        city: '서울특별시',
        district: '강남구',
        propertyType: '아파트',
        url: 'https://ilsangkit.co.kr/real-estate/apt-sale/seoul/gangnam/%EB%9E%98%EB%AF%B8%EC%95%88%ED%85%8C%EC%8A%A4%ED%8A%B8',
        lat: 37.5,
        lng: 127.0,
        buildYear: 2015,
        totalCount: 42,
      })
      const factory = mockUseHead.mock.calls[0][0]
      expect(typeof factory).toBe('function')
      const head = factory()
      const parsed = JSON.parse(head.script[0].innerHTML)
      expect(parsed['@type']).toBe('RealEstateListing')
      expect(parsed.url).toBe('https://ilsangkit.co.kr/real-estate/apt-sale/seoul/gangnam/%EB%9E%98%EB%AF%B8%EC%95%88%ED%85%8C%EC%8A%A4%ED%8A%B8')
      expect(parsed.url).not.toBe('')
      expect(parsed.address.addressRegion).toBe('서울특별시')
      expect(parsed.address.addressLocality).toBe('강남구')
      expect(parsed.geo).toEqual({ '@type': 'GeoCoordinates', latitude: 37.5, longitude: 127.0 })
    })

    it('getter 형태로 전달하면 useHead 가 매 호출 시 최신 값을 읽는다 (reactivity)', () => {
      const { setRealEstateListingSchema } = useStructuredData()
      const state = {
        url: 'https://ilsangkit.co.kr/real-estate/apt-sale/a',
        totalCount: 0,
      }
      setRealEstateListingSchema(() => ({
        name: '테스트',
        address: '서울시',
        city: '서울특별시',
        district: '강남구',
        propertyType: '아파트',
        url: state.url,
        totalCount: state.totalCount,
      }))
      const factory = mockUseHead.mock.calls[0][0]
      // 첫 렌더
      const first = JSON.parse(factory().script[0].innerHTML)
      expect(first.url).toBe('https://ilsangkit.co.kr/real-estate/apt-sale/a')
      expect(first.additionalProperty.find((p: { name: string }) => p.name === 'numberOfTransactions')).toBeUndefined()

      // 상태 변경 후 재팩토리
      state.url = 'https://ilsangkit.co.kr/real-estate/apt-sale/b'
      state.totalCount = 17
      const second = JSON.parse(factory().script[0].innerHTML)
      expect(second.url).toBe('https://ilsangkit.co.kr/real-estate/apt-sale/b')
      const txProp = second.additionalProperty.find((p: { name: string }) => p.name === 'numberOfTransactions')
      expect(txProp).toBeDefined()
      expect(txProp.value).toBe('17')
    })

    it('lat/lng 가 null 이면 geo 필드가 누락된 채로 schema 가 생성된다 (SSR 첫 렌더)', () => {
      const { setRealEstateListingSchema } = useStructuredData()
      setRealEstateListingSchema({
        name: '테스트',
        address: '서울시',
        city: '서울특별시',
        district: '강남구',
        propertyType: '아파트',
        url: 'https://ilsangkit.co.kr/x',
        lat: null,
        lng: null,
      })
      const head = mockUseHead.mock.calls[0][0]()
      const parsed = JSON.parse(head.script[0].innerHTML)
      expect(parsed.geo).toBeUndefined()
      expect(parsed.url).toBe('https://ilsangkit.co.kr/x')
    })

    it('window 가 없어도(SSR 환경 시뮬레이션) url 필드는 비지 않는다', () => {
      // 현재 프로세스에 window 가 없는 것처럼 동작하는지 검증.
      const originalWindow = (globalThis as unknown as { window?: unknown }).window
      try {
        ;(globalThis as unknown as { window?: unknown }).window = undefined
        const { setRealEstateListingSchema } = useStructuredData()
        setRealEstateListingSchema({
          name: '테스트',
          address: '서울시',
          city: '서울특별시',
          district: '강남구',
          propertyType: '아파트',
          url: 'https://ilsangkit.co.kr/ssr-safe',
        })
        const head = mockUseHead.mock.calls[0][0]()
        const parsed = JSON.parse(head.script[0].innerHTML)
        expect(parsed.url).toBe('https://ilsangkit.co.kr/ssr-safe')
      } finally {
        ;(globalThis as unknown as { window?: unknown }).window = originalWindow
      }
    })
  })

  describe('setRealEstateListingSchema (page-mirrored SSR first render)', () => {
    it('buildingInfo=null 인 SSR 첫 렌더에서도 RealEstateListing JSON-LD 가 완성된 url 과 함께 포함된다', () => {
      // 이 케이스는 실제 [buildingName].vue 가 setRealEstateListingSchema 를 호출하는 방식
      // (buildingInfo 가 ref(null) 이고 route.params 만으로 url 이 구성되는 상황) 을 재현한다.
      const buildingInfo: { value: null | { city: string; district: string; lat: number; lng: number } } = { value: null }
      const routeBuildingName = '래미안테스트'
      const expectedUrl = `https://ilsangkit.co.kr/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent(routeBuildingName)}`

      const { setRealEstateListingSchema } = useStructuredData()
      setRealEstateListingSchema(() => ({
        name: routeBuildingName,
        address: routeBuildingName, // fullAddress 가 아직 '-' 인 상태의 fallback
        city: buildingInfo.value?.city || '서울특별시',
        district: buildingInfo.value?.district || '강남구',
        propertyType: '아파트',
        url: expectedUrl,
        lat: buildingInfo.value?.lat ?? null,
        lng: buildingInfo.value?.lng ?? null,
      }))
      const factory = mockUseHead.mock.calls[0][0]
      const head = factory()
      const parsed = JSON.parse(head.script[0].innerHTML)
      expect(parsed['@type']).toBe('RealEstateListing')
      expect(parsed.url).toBe(expectedUrl)
      expect(parsed.url.length).toBeGreaterThan(0)
      expect(parsed.address.addressRegion).toBe('서울특별시')
      expect(parsed.address.addressLocality).toBe('강남구')
    })
  })

  describe('setBuildingPlaceSchema (SSR-safe)', () => {
    it('getter 형태로 전달하면 lat/lng 가 나중에 채워져도 geo 가 업데이트된다', () => {
      const { setBuildingPlaceSchema } = useStructuredData()
      const state: { lat: number | null; lng: number | null } = { lat: null, lng: null }
      setBuildingPlaceSchema(() => ({
        name: '빌라X',
        address: '서울시 서초구',
        lat: state.lat,
        lng: state.lng,
        propertyType: '빌라',
      }))
      const factory = mockUseHead.mock.calls[0][0]
      const before = JSON.parse(factory().script[0].innerHTML)
      expect(before.geo).toBeUndefined()
      state.lat = 37.48
      state.lng = 127.01
      const after = JSON.parse(factory().script[0].innerHTML)
      expect(after.geo).toEqual({ '@type': 'GeoCoordinates', latitude: 37.48, longitude: 127.01 })
    })

    it('image 옵션 → schema.image', () => {
      const { setBuildingPlaceSchema } = useStructuredData()
      setBuildingPlaceSchema({
        name: '래미안',
        address: '서울 마포구',
        propertyType: '아파트',
        propertySlug: 'apt',
        image: 'https://ilsangkit.co.kr/og?title=래미안',
      })
      const factory = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(factory().script[0].innerHTML)
      expect(parsed.image).toBe('https://ilsangkit.co.kr/og?title=래미안')
    })
  })

  describe('setRealEstateListingSchema (Task 6 확장 필드)', () => {
    it('image 옵션 → schema.image', () => {
      const { setRealEstateListingSchema } = useStructuredData()
      setRealEstateListingSchema({
        name: '래미안',
        address: '서울 마포구',
        city: '서울특별시',
        district: '마포구',
        propertyType: '아파트',
        url: 'https://ilsangkit.co.kr/x',
        image: 'https://ilsangkit.co.kr/og?title=래미안',
      })
      const factory = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(factory().script[0].innerHTML)
      expect(parsed.image).toBe('https://ilsangkit.co.kr/og?title=래미안')
    })

    it('mainEntityOfPage는 항상 url과 동일', () => {
      const { setRealEstateListingSchema } = useStructuredData()
      setRealEstateListingSchema({
        name: '래미안',
        address: '서울 마포구',
        city: '서울특별시',
        district: '마포구',
        propertyType: '아파트',
        url: 'https://ilsangkit.co.kr/x',
      })
      const factory = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(factory().script[0].innerHTML)
      expect(parsed.mainEntityOfPage).toBe('https://ilsangkit.co.kr/x')
    })

    it('recentAvg → offers (Offer/KRW/InStock)', () => {
      const { setRealEstateListingSchema } = useStructuredData()
      setRealEstateListingSchema({
        name: '래미안',
        address: '서울 마포구',
        city: '서울특별시',
        district: '마포구',
        propertyType: '아파트',
        url: 'https://ilsangkit.co.kr/x',
        recentAvg: 1_500_000_000,
      })
      const factory = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(factory().script[0].innerHTML)
      expect(parsed.offers).toEqual({
        '@type': 'Offer',
        price: 1_500_000_000,
        priceCurrency: 'KRW',
        availability: 'https://schema.org/InStock',
      })
    })

    it('latestDealDate → datePosted', () => {
      const { setRealEstateListingSchema } = useStructuredData()
      setRealEstateListingSchema({
        name: '래미안',
        address: '서울 마포구',
        city: '서울특별시',
        district: '마포구',
        propertyType: '아파트',
        url: 'https://ilsangkit.co.kr/x',
        latestDealDate: '2026-04-01',
      })
      const factory = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(factory().script[0].innerHTML)
      expect(parsed.datePosted).toBe('2026-04-01')
    })
  })
})
