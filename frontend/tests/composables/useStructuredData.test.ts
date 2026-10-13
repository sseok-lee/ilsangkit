import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUseHead = vi.fn()
vi.stubGlobal('useHead', mockUseHead)

// SITE_URL mock
vi.mock('~/utils/seoConstants', () => ({
  SITE_NAME: '일상킷',
  SITE_URL: 'https://ilsangkit.co.kr',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og-image.png',
  CONTENT_AUTHOR: '일상킷 데이터팀',
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

  // ─── setItemListSchema 확장 (rich entity + options) ──────────────────────────

  describe('setItemListSchema', () => {
    it('Backward compat: name/url 만 전달 시 ListItem with name/url at top level', () => {
      const { setItemListSchema } = useStructuredData()
      setItemListSchema([
        { name: '테스트A', url: '/real-estate/apt-sale/seoul/gangnam/A' },
        { name: '테스트B', url: 'https://ilsangkit.co.kr/real-estate/apt-sale/seoul/mapo/B' },
      ])
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed['@type']).toBe('ItemList')
      const el0 = parsed.itemListElement[0]
      expect(el0['@type']).toBe('ListItem')
      expect(el0.position).toBe(1)
      expect(el0.name).toBe('테스트A')
      expect(el0.url).toBe('https://ilsangkit.co.kr/real-estate/apt-sale/seoul/gangnam/A')
      // nested item 없어야 함
      expect(el0.item).toBeUndefined()
      // 절대 URL 그대로 유지
      const el1 = parsed.itemListElement[1]
      expect(el1.url).toBe('https://ilsangkit.co.kr/real-estate/apt-sale/seoul/mapo/B')
    })

    it('Rich item: type/address 전달 시 nested item 에 Apartment + PostalAddress 포함', () => {
      const { setItemListSchema } = useStructuredData()
      setItemListSchema([
        {
          name: '래미안 (매매)',
          url: '/real-estate/apt-sale/seoul/gangnam/%EB%9E%98%EB%AF%B8%EC%95%88',
          position: 1,
          type: 'Apartment',
          address: { addressLocality: '강남구', addressRegion: '서울특별시' },
        },
      ])
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      const el = parsed.itemListElement[0]
      expect(el['@type']).toBe('ListItem')
      expect(el.position).toBe(1)
      expect(el.item).toBeDefined()
      expect(el.item['@type']).toBe('Apartment')
      expect(el.item.name).toBe('래미안 (매매)')
      expect(el.item.url).toContain('https://ilsangkit.co.kr')
      expect(el.item.address['@type']).toBe('PostalAddress')
      expect(el.item.address.addressCountry).toBe('KR')
      expect(el.item.address.addressLocality).toBe('강남구')
      expect(el.item.address.addressRegion).toBe('서울특별시')
      // top-level name/url 없어야 함 (nested item 방식)
      expect(el.name).toBeUndefined()
      expect(el.url).toBeUndefined()
    })

    it('Options: name/description 추가 시 schema 최상위에 포함', () => {
      const { setItemListSchema } = useStructuredData()
      setItemListSchema(
        [{ name: '단지A', url: '/real-estate/apt-sale/seoul/gangnam/A' }],
        { name: '이번 주 인기 아파트 단지', description: '최근 7일 거래가 많은 단지' },
      )
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed.name).toBe('이번 주 인기 아파트 단지')
      expect(parsed.description).toBe('최근 7일 거래가 많은 단지')
    })

    it('Key 분리: options.key 전달 시 script key 가 해당 값으로 설정된다', () => {
      const { setItemListSchema } = useStructuredData()
      setItemListSchema(
        [{ name: '단지A', url: '/real-estate/apt-sale/seoul/gangnam/A' }],
        { key: 'jsonld-trending-buildings' },
      )
      const call = mockUseHead.mock.calls[0][0]
      expect(call.script[0].key).toBe('jsonld-trending-buildings')
    })

    it('key 미전달 시 기본 key jsonld-itemlist 사용', () => {
      const { setItemListSchema } = useStructuredData()
      setItemListSchema([{ name: '단지A', url: '/real-estate/apt-sale/seoul/gangnam/A' }])
      const call = mockUseHead.mock.calls[0][0]
      expect(call.script[0].key).toBe('jsonld-itemlist')
    })

    // ─── C1: url 없는 항목 null-safe (trash 집계 페이지) ───────────────────────
    it('url 없는 항목을 전달해도 TypeError가 발생하지 않는다', () => {
      const { setItemListSchema } = useStructuredData()
      expect(() => {
        setItemListSchema([
          { name: '서울시 강남구 쓰레기 배출 일정', position: 1 },
          { name: '서울시 서초구 쓰레기 배출 일정', position: 2 },
        ])
      }).not.toThrow()
    })

    it('url 없는 항목의 ListItem에 url 키가 포함되지 않는다', () => {
      const { setItemListSchema } = useStructuredData()
      setItemListSchema([
        { name: '서울시 강남구 쓰레기 배출 일정', position: 1 },
        { name: '서울시 서초구 쓰레기 배출 일정', position: 2 },
      ])
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed['@type']).toBe('ItemList')
      const el0 = parsed.itemListElement[0]
      expect(el0['@type']).toBe('ListItem')
      expect(el0.position).toBe(1)
      expect(el0.name).toBe('서울시 강남구 쓰레기 배출 일정')
      // url 키가 없어야 한다 (undefined가 아닌 키 자체가 없어야 함)
      expect(Object.prototype.hasOwnProperty.call(el0, 'url')).toBe(false)
    })

    it('url 있는 항목은 기존 동작 그대로 절대 URL로 변환된다 (다른 콜러 무영향)', () => {
      const { setItemListSchema } = useStructuredData()
      setItemListSchema([
        { name: '단지A', url: '/real-estate/apt-sale/seoul/gangnam/A', position: 1 },
        { name: '단지B', url: 'https://ilsangkit.co.kr/real-estate/apt-sale/seoul/mapo/B', position: 2 },
      ])
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed.itemListElement[0].url).toBe('https://ilsangkit.co.kr/real-estate/apt-sale/seoul/gangnam/A')
      expect(parsed.itemListElement[1].url).toBe('https://ilsangkit.co.kr/real-estate/apt-sale/seoul/mapo/B')
    })

    it('url 있는 항목 + url 없는 항목 혼합 시 url 있는 항목만 url 키를 가진다', () => {
      const { setItemListSchema } = useStructuredData()
      setItemListSchema([
        { name: '항목A(url있음)', url: '/category/list', position: 1 },
        { name: '항목B(url없음)', position: 2 },
      ])
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(Object.prototype.hasOwnProperty.call(parsed.itemListElement[0], 'url')).toBe(true)
      expect(Object.prototype.hasOwnProperty.call(parsed.itemListElement[1], 'url')).toBe(false)
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

    it('recentAvg → recentAveragePrice additionalProperty (offers 제거됨)', () => {
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
      // offers 블록은 더 이상 포함되지 않는다 (역사적 평균가를 현재 재고처럼 표현하면 오해 소지)
      expect(parsed.offers).toBeUndefined()
      // 대신 additionalProperty 에 recentAveragePrice 로 추가된다
      const avgProp = parsed.additionalProperty.find((p: { name: string }) => p.name === 'recentAveragePrice')
      expect(avgProp).toBeDefined()
      expect(avgProp['@type']).toBe('PropertyValue')
      expect(avgProp.value).toBe('1500000000')
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

  // ─── P1-4: setRealEstateListingSchema offers 제거 ──────────────────────────

  describe('setRealEstateListingSchema - offers 제거', () => {
    it('recentAvg 없을 때도 offers 는 undefined 이다', () => {
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
      expect(parsed.offers).toBeUndefined()
    })

    it('recentAvg 있을 때도 offers 는 undefined 이다 (역사적 평균가는 InStock 으로 표현 불가)', () => {
      const { setRealEstateListingSchema } = useStructuredData()
      setRealEstateListingSchema({
        name: '래미안',
        address: '서울 마포구',
        city: '서울특별시',
        district: '마포구',
        propertyType: '아파트',
        url: 'https://ilsangkit.co.kr/x',
        recentAvg: 900_000_000,
      })
      const factory = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(factory().script[0].innerHTML)
      expect(parsed.offers).toBeUndefined()
    })
  })

  // ─── P0-1a/1b: setArticleSchema publisher.logo + image fallback ────────────

  describe('setArticleSchema - publisher.logo + image fallback', () => {
    it('author는 CONTENT_AUTHOR(일상킷 데이터팀) Organization이고 publisher는 SITE_NAME을 유지한다', () => {
      const { setArticleSchema } = useStructuredData()
      setArticleSchema({
        headline: '테스트 가이드',
        description: '테스트 설명',
        datePublished: '2024-01-01T00:00:00Z',
        url: 'https://ilsangkit.co.kr/guide/test',
      })
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed.author).toEqual({ '@type': 'Organization', name: '일상킷 데이터팀', url: 'https://ilsangkit.co.kr' })
      expect(parsed.publisher.name).toBe('일상킷')
    })

    it('publisher에 logo ImageObject가 포함된다', () => {
      const { setArticleSchema } = useStructuredData()
      setArticleSchema({
        headline: '테스트 가이드',
        description: '테스트 설명',
        datePublished: '2024-01-01T00:00:00Z',
        url: 'https://ilsangkit.co.kr/guide/test',
      })
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed.publisher['@type']).toBe('Organization')
      expect(parsed.publisher.logo).toBeDefined()
      expect(parsed.publisher.logo['@type']).toBe('ImageObject')
      expect(parsed.publisher.logo.url).toBeTruthy()
      expect(parsed.publisher.logo.url).toContain('logo.webp')
    })

    it('options.image 가 있으면 schema.image 에 그대로 사용된다', () => {
      const { setArticleSchema } = useStructuredData()
      setArticleSchema({
        headline: '테스트',
        description: '설명',
        datePublished: '2024-01-01T00:00:00Z',
        url: 'https://ilsangkit.co.kr/guide/test',
        image: 'https://ilsangkit.co.kr/uploads/custom.jpg',
      })
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed.image).toBe('https://ilsangkit.co.kr/uploads/custom.jpg')
    })

    it('options.image 가 없으면 DEFAULT_OG_IMAGE 로 폴백된다', () => {
      const { setArticleSchema } = useStructuredData()
      setArticleSchema({
        headline: '테스트',
        description: '설명',
        datePublished: '2024-01-01T00:00:00Z',
        url: 'https://ilsangkit.co.kr/guide/test',
      })
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      // image 필드가 항상 존재해야 한다 (Google Article rich result 필수)
      expect(parsed.image).toBeDefined()
      expect(typeof parsed.image).toBe('string')
      expect(parsed.image.length).toBeGreaterThan(0)
    })
  })

  // ─── P1-3: setFacilitySchema @type 유효성 ─────────────────────────────────

  describe('setFacilitySchema - 유효한 schema.org @type 만 사용', () => {
    const VALID_SCHEMA_TYPES = new Set([
      'CivicStructure', 'LocalBusiness', 'EmergencyService', 'Library',
      'Hospital', 'Pharmacy', 'Park', 'School', 'ChildCare',
      'SportsActivityLocation', 'TrainStation', 'Place',
    ])
    const INVALID_TYPES = ['ParkingFacility', 'RecyclingCenter']

    const makeMinimalFacility = (category: string) => ({
      id: `${category}-1`,
      category: category as any,
      name: `테스트 ${category}`,
      address: '서울시 강남구 테헤란로 1',
      roadAddress: '서울시 강남구 테헤란로 1',
      lat: 37.5,
      lng: 127.0,
      city: '서울시',
      district: '강남구',
      bjdCode: null,
      sourceId: `${category}-001`,
      sourceUrl: null,
      viewCount: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      syncedAt: '2024-01-01T00:00:00Z',
      details: {},
    })

    const categories = [
      'toilet', 'trash', 'wifi', 'clothes', 'parking', 'aed',
      'library', 'hospital', 'pharmacy', 'park', 'school',
      'market', 'childcare', 'ev-charger', 'sports', 'subway',
    ]

    it.each(categories)('카테고리 %s의 @type이 유효한 schema.org 타입이다', (category) => {
      const { setFacilitySchema } = useStructuredData()
      setFacilitySchema(makeMinimalFacility(category))
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(INVALID_TYPES).not.toContain(parsed['@type'])
      expect(VALID_SCHEMA_TYPES.has(parsed['@type'])).toBe(true)
    })

    it('parking 카테고리의 @type이 CivicStructure이다 (ParkingFacility 아님)', () => {
      const { setFacilitySchema } = useStructuredData()
      setFacilitySchema(makeMinimalFacility('parking'))
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed['@type']).toBe('CivicStructure')
      expect(parsed['@type']).not.toBe('ParkingFacility')
    })

    it('clothes 카테고리의 @type이 CivicStructure이다 (RecyclingCenter 아님)', () => {
      const { setFacilitySchema } = useStructuredData()
      setFacilitySchema(makeMinimalFacility('clothes'))
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed['@type']).toBe('CivicStructure')
      expect(parsed['@type']).not.toBe('RecyclingCenter')
    })
  })

  // ─── P1-6: library openingHours HH:MM 정규화 ──────────────────────────────

  describe('setFacilitySchema - library openingHours HH:MM 정규화', () => {
    const makeLibraryFacility = (detailsOverride = {}) => ({
      id: 'lib-1',
      category: 'library' as const,
      name: '테스트도서관',
      address: '서울시 강남구 테헤란로 1',
      roadAddress: '서울시 강남구 테헤란로 1',
      lat: 37.5,
      lng: 127.0,
      city: '서울시',
      district: '강남구',
      bjdCode: null,
      sourceId: 'L001',
      sourceUrl: null,
      viewCount: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      syncedAt: '2024-01-01T00:00:00Z',
      details: { ...detailsOverride },
    })

    it('이미 HH:MM 콜론 형식인 경우 그대로 사용된다', () => {
      const { setFacilitySchema } = useStructuredData()
      setFacilitySchema(makeLibraryFacility({ weekdayOpenTime: '09:00', weekdayCloseTime: '18:00' }))
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed.openingHours).toMatch(/^Mo-Fr \d{2}:\d{2}-\d{2}:\d{2}$/)
      expect(parsed.openingHours).toBe('Mo-Fr 09:00-18:00')
    })

    it('raw 숫자 문자열(0900/1800)이 HH:MM 형식으로 정규화된다', () => {
      const { setFacilitySchema } = useStructuredData()
      setFacilitySchema(makeLibraryFacility({ weekdayOpenTime: '0900', weekdayCloseTime: '1800' }))
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed.openingHours).toMatch(/^Mo-Fr \d{2}:\d{2}-\d{2}:\d{2}$/)
      expect(parsed.openingHours).toBe('Mo-Fr 09:00-18:00')
    })

    it('세 자리 숫자(900)도 HH:MM 으로 정규화된다', () => {
      const { setFacilitySchema } = useStructuredData()
      setFacilitySchema(makeLibraryFacility({ weekdayOpenTime: '900', weekdayCloseTime: '1700' }))
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed.openingHours).toMatch(/^Mo-Fr \d{2}:\d{2}-\d{2}:\d{2}$/)
    })

    it('시간 값이 없으면 openingHours 필드가 포함되지 않는다', () => {
      const { setFacilitySchema } = useStructuredData()
      setFacilitySchema(makeLibraryFacility())
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed.openingHours).toBeUndefined()
    })
  })

  // ─── VideoObject 스키마 제거 가드 ──────────────────────────────────────────
  // 화면에 없는 콘텐츠를 구조화 데이터로 주장하면 Google 정책 위반이다.
  //
  // 제거 근거 (2026-07-29 실측):
  //   FacilityYoutubeSection 은 onMounted + IntersectionObserver 로만 fetch 하므로
  //   SSR HTML 에 영상이 0건이다. `SectionBlock v-if="hasResults || loading"` 이라
  //   섹션 자체가 렌더되지 않는다. 그런데 스키마는 SSR 에서 나갔다 —
  //   /childcare/childcare-29110000026 raw HTML: VideoObject 6건, <iframe> 0개,
  //   본문에 'youtube' 0회.
  //
  //   게다가 매칭이 시설명 키워드 검색(youtubeService.ts `${name} ${region} 어린이집`)
  //   이라 무관한 영상이 붙었다. 광주 새싹어린이집 페이지에 붙은 6건:
  //     "🦧 새싹어린이집 오랑이반장의 칭찬도장 🌱 #인형계브이로그"  (인형놀이 채널)
  //     "첫 꽃잎 어린이집 오전 일상🌸[음원출처:새싹이네]"          (고양이 채널 '냥이예린')
  //
  // 화면의 관련 영상 섹션(클라이언트 렌더)은 그대로 둔다 — 제거 대상은 스키마뿐이다.
  describe('VideoObject 구조화 데이터를 발행하지 않는다', () => {
    it('useStructuredData 가 setVideoListSchema 를 노출하지 않는다', () => {
      expect('setVideoListSchema' in useStructuredData()).toBe(false)
    })
  })

  // ─── 공매 물건 본문 엔티티(Product + Offer) ────────────────────────────────

  describe('setAuctionListingSchema', () => {
    it('minBidPrc가 있으면 Product + Offer(price/KRW/InStock)를 출력한다', () => {
      const { setAuctionListingSchema } = useStructuredData()
      setAuctionListingSchema({
        address: '서울특별시 강남구 테헤란로 1',
        usage: '아파트',
        minBidPrc: 350_000_000,
        appraisalAmt: 500_000_000,
      })
      const call = mockUseHead.mock.calls[0][0]
      expect(call.script[0].key).toBe('jsonld-auction-listing')
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed['@type']).toBe('Product')
      expect(parsed.name).toBe('서울특별시 강남구 테헤란로 1')
      expect(parsed.category).toBe('아파트')
      expect(parsed.offers['@type']).toBe('Offer')
      expect(parsed.offers.price).toBe(350_000_000)
      expect(parsed.offers.priceCurrency).toBe('KRW')
      expect(parsed.offers.availability).toBe('https://schema.org/InStock')
      // 감정가는 additionalProperty로 부착
      const appraisal = parsed.additionalProperty.find((p: { name: string }) => p.name === 'appraisalAmount')
      expect(appraisal.value).toBe('500000000')
    })

    it('minBidPrc가 null이면 offers 자체를 생략한다', () => {
      const { setAuctionListingSchema } = useStructuredData()
      setAuctionListingSchema({
        address: '부산광역시 해운대구 우동 100',
        usage: '오피스텔',
        minBidPrc: null,
        appraisalAmt: null,
      })
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed['@type']).toBe('Product')
      expect(parsed.name).toBe('부산광역시 해운대구 우동 100')
      expect(parsed.offers).toBeUndefined()
      // appraisalAmt가 null이면 additionalProperty도 없어야 한다
      expect(parsed.additionalProperty).toBeUndefined()
    })

    it('address가 없으면 usage로, usage도 없으면 기본 라벨로 name을 채운다', () => {
      const { setAuctionListingSchema } = useStructuredData()
      setAuctionListingSchema({ address: null, usage: '토지', minBidPrc: null })
      let parsed = JSON.parse(mockUseHead.mock.calls[0][0].script[0].innerHTML)
      expect(parsed.name).toBe('토지')
      // category는 usage가 있을 때만
      expect(parsed.category).toBe('토지')

      mockUseHead.mockClear()
      setAuctionListingSchema({ address: null, usage: null, minBidPrc: null })
      parsed = JSON.parse(mockUseHead.mock.calls[0][0].script[0].innerHTML)
      expect(parsed.name).toBe('공매 물건')
      expect(parsed.category).toBeUndefined()
    })
  })

  describe('setDetailProvenance', () => {
    it('facility/toilet에 대해 원본 데이터셋명·제공기관·dateModified를 가진 Dataset을 출력한다', () => {
      const { setDetailProvenance } = useStructuredData()
      setDetailProvenance({ domain: 'facility', category: 'toilet', path: '/toilet/1', description: '역삼동 공중화장실 위치·운영시간', updatedAt: '2026-06-20T03:00:00Z' })
      const parsed = JSON.parse(mockUseHead.mock.calls[0][0].script[0].innerHTML)
      expect(parsed['@type']).toBe('Dataset')
      expect(parsed.name).toBe('전국 공중화장실 표준데이터')
      expect(parsed.sourceOrganization.name).toBe('행정안전부')
      expect(parsed.isBasedOn).toContain('data.go.kr')
      expect(parsed.dateModified).toBe('2026-06-20')
    })

    it('noindex=true면 아무것도 출력하지 않는다', () => {
      const { setDetailProvenance } = useStructuredData()
      setDetailProvenance({ domain: 'facility', category: 'toilet', path: '/toilet/1', description: 'x', noindex: true })
      expect(mockUseHead).not.toHaveBeenCalled()
    })

    it('출처가 없는 도메인(예: category 없는 facility)이면 출력하지 않는다', () => {
      const { setDetailProvenance } = useStructuredData()
      setDetailProvenance({ domain: 'facility', path: '/x', description: 'x' })
      expect(mockUseHead).not.toHaveBeenCalled()
    })

    it('path가 없으면 아무것도 출력하지 않는다', () => {
      const { setDetailProvenance } = useStructuredData()
      setDetailProvenance({ domain: 'facility', category: 'toilet', path: '', description: 'x', updatedAt: '2026-06-20T00:00:00Z' })
      expect(mockUseHead).not.toHaveBeenCalled()
    })
  })

  describe('setDatasetSchema provenance/date 옵션', () => {
    const baseSource = { datasetName: '전국 공중화장실 표준데이터', provider: '행정안전부', url: 'https://www.data.go.kr/data/15012892/standard.do' }

    it('provenance 옵션 전달 시 isBasedOn/sourceOrganization/citation/dateModified/datePublished를 출력한다', () => {
      const { setDatasetSchema } = useStructuredData()
      setDatasetSchema({
        name: baseSource.datasetName, description: '설명', url: '/toilet/1', sources: [baseSource],
        isBasedOn: baseSource.url,
        sourceOrganization: { '@type': 'Organization', name: baseSource.provider },
        citation: { '@type': 'CreativeWork', name: baseSource.datasetName, url: baseSource.url },
        dateModified: '2026-06-20', datePublished: '2026-01-01',
      })
      const parsed = JSON.parse(mockUseHead.mock.calls[0][0].script[0].innerHTML)
      expect(parsed.isBasedOn).toBe(baseSource.url)
      expect(parsed.sourceOrganization).toEqual({ '@type': 'Organization', name: '행정안전부' })
      expect(parsed.citation['@type']).toBe('CreativeWork')
      expect(parsed.dateModified).toBe('2026-06-20')
      expect(parsed.datePublished).toBe('2026-01-01')
    })

    it('provenance 옵션 미전달 시 새 필드는 출력되지 않는다 (하위호환)', () => {
      const { setDatasetSchema } = useStructuredData()
      setDatasetSchema({ name: baseSource.datasetName, description: '설명', url: '/toilet', sources: [baseSource] })
      const parsed = JSON.parse(mockUseHead.mock.calls[0][0].script[0].innerHTML)
      expect(parsed.isBasedOn).toBeUndefined()
      expect(parsed.sourceOrganization).toBeUndefined()
      expect(parsed.dateModified).toBeUndefined()
      expect(parsed.datePublished).toBeUndefined()
    })
  })
})
