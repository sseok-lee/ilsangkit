import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Nuxt composables
const mockUseSeoMeta = vi.fn()
const mockUseHead = vi.fn()

vi.stubGlobal('useSeoMeta', mockUseSeoMeta)
vi.stubGlobal('useHead', mockUseHead)

// Import after mocking
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import type { FacilityDetail } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'
import { CATEGORY_SEO_TITLE, CATEGORY_SEO_DESCRIPTION } from '~/utils/seoConstants'

describe('useFacilityMeta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('setHomeMeta', () => {
    it('sets home page meta tags', () => {
      const { setHomeMeta } = useFacilityMeta()

      setHomeMeta()

      expect(mockUseSeoMeta).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '부동산 실거래가·청약·생활정보 | 일상킷',
          ogTitle: '부동산 실거래가·청약·생활정보 | 일상킷',
          ogSiteName: '일상킷',
          ogLocale: 'ko_KR',
          twitterCard: 'summary_large_image',
        })
      )

      expect(mockUseHead).toHaveBeenCalledWith({
        link: [{ rel: 'canonical', href: 'https://ilsangkit.co.kr/', key: 'canonical' }],
      })
    })
  })

  describe('setMeta - canonical 옵션', () => {
    it('canonical: false 일 때 canonical link를 설정하지 않는다', () => {
      const { setMeta } = useFacilityMeta()

      setMeta({ title: '테스트', description: '설명', path: '/search', canonical: false })

      // setMeta는 canonical 전용 useHead 호출을 스킵해야 함
      // useHead가 호출되지 않거나, 호출되더라도 link: canonical이 없어야 함
      const headCallsWithCanonical = mockUseHead.mock.calls.filter((c: unknown[]) => {
        const arg = c[0] as { link?: Array<{ rel: string }> }
        return arg?.link?.some((l) => l.rel === 'canonical')
      })
      expect(headCallsWithCanonical).toHaveLength(0)
    })

    it('canonical 옵션이 지정되면 해당 URL을 사용한다', () => {
      const { setMeta } = useFacilityMeta()

      setMeta({
        title: '테스트',
        description: '설명',
        path: '/toilet',
        canonical: 'https://ilsangkit.co.kr/custom-canonical',
      })

      const headCall = mockUseHead.mock.calls.find((c: unknown[]) => {
        const arg = c[0] as { link?: Array<{ rel: string; href: string }> }
        return arg?.link?.some((l) => l.rel === 'canonical')
      })
      expect(headCall).toBeTruthy()
      const link = (headCall![0] as { link: Array<{ rel: string; href: string }> }).link
      const canonical = link.find((l) => l.rel === 'canonical')
      expect(canonical?.href).toBe('https://ilsangkit.co.kr/custom-canonical')
    })

    it('canonical 옵션이 없으면 path로 기본 canonical을 생성한다 (기존 동작)', () => {
      const { setMeta } = useFacilityMeta()

      setMeta({ title: '테스트', description: '설명', path: '/toilet' })

      const headCall = mockUseHead.mock.calls.find((c: unknown[]) => {
        const arg = c[0] as { link?: Array<{ rel: string; href: string }> }
        return arg?.link?.some((l) => l.rel === 'canonical')
      })
      expect(headCall).toBeTruthy()
      const link = (headCall![0] as { link: Array<{ rel: string; href: string }> }).link
      const canonical = link.find((l) => l.rel === 'canonical')
      expect(canonical?.href).toBe('https://ilsangkit.co.kr/toilet')
    })
  })

  describe('setSearchMeta', () => {
    it('sets search page meta with keyword', () => {
      const { setSearchMeta } = useFacilityMeta()

      setSearchMeta({ keyword: '강남' })

      expect(mockUseSeoMeta).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('강남'),
          description: expect.stringContaining('강남'),
        })
      )
    })

    it('/search는 canonical을 설정하지 않는다 (noindex 충돌 방지)', () => {
      const { setSearchMeta } = useFacilityMeta()

      setSearchMeta({ keyword: '강남' })

      const headCallsWithCanonical = mockUseHead.mock.calls.filter((c: unknown[]) => {
        const arg = c[0] as { link?: Array<{ rel: string }> }
        return arg?.link?.some((l) => l.rel === 'canonical')
      })
      expect(headCallsWithCanonical).toHaveLength(0)
    })

    it('sets search page meta with category', () => {
      const { setSearchMeta } = useFacilityMeta()

      setSearchMeta({ category: 'toilet' })

      expect(mockUseSeoMeta).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('공공화장실'),
        })
      )
    })

    it('sets default meta without params', () => {
      const { setSearchMeta } = useFacilityMeta()

      setSearchMeta({})

      expect(mockUseSeoMeta).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('시설 검색'),
        })
      )
    })
  })

  describe('setFacilityDetailMeta', () => {
    it('sets facility detail page meta', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()

      const facility: FacilityDetail = {
        id: 'test-1',
        category: 'toilet',
        name: '강남역 공중화장실',
        address: '서울시 강남구',
        roadAddress: '서울시 강남구 강남대로 396',
        lat: 37.4979,
        lng: 127.0276,
        city: '서울',
        district: '강남구',
        bjdCode: '11680',
        details: {},
        sourceId: 'test-source',
        sourceUrl: null,
        viewCount: 100,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        syncedAt: '2024-01-01T00:00:00Z',
      }

      setFacilityDetailMeta(facility)

      expect(mockUseSeoMeta).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('강남역 공중화장실'),
          description: expect.stringContaining('서울'),
          ogType: 'website',
        })
      )
    })

    it('시설명이 길어도 title에 지역명과 카테고리를 유지한다', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()

      const facility: FacilityDetail = {
        id: 'test-long',
        category: 'park',
        name: '하복대근린공원 농구장 운동시설',
        address: '충청북도 청주시 상당구',
        roadAddress: '충청북도 청주시 상당구 하복대로 1',
        lat: 36.62,
        lng: 127.49,
        city: '서울특별시',
        district: '강남구',
        bjdCode: '11680',
        details: {},
        sourceId: 'test-source',
        sourceUrl: null,
        viewCount: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        syncedAt: '2024-01-01T00:00:00Z',
      }

      setFacilityDetailMeta(facility)

      const call = mockUseSeoMeta.mock.calls.at(-1)![0] as { title: string }
      expect(call.title).toContain('하복대근린공원 농구장 운동시설')
      expect(call.title).toContain('서울')
      expect(call.title).toContain('강남구')
      expect(call.title).toContain(CATEGORY_META.park.label)
    })

    it('district가 없으면 title에 시명만 들어가고 undefined/null이 없다', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()

      const facility: FacilityDetail = {
        id: 'test-no-district',
        category: 'toilet',
        name: '아주 길고 긴 어느 공중화장실 시설의 이름입니다',
        address: '서울특별시',
        roadAddress: null,
        lat: 37.5,
        lng: 127.0,
        city: '서울특별시',
        district: null,
        bjdCode: '11000',
        details: {},
        sourceId: 'test-source',
        sourceUrl: null,
        viewCount: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        syncedAt: '2024-01-01T00:00:00Z',
      }

      setFacilityDetailMeta(facility)

      const call = mockUseSeoMeta.mock.calls.at(-1)![0] as { title: string }
      expect(call.title).toContain('아주 길고 긴 어느 공중화장실 시설의 이름입니다')
      expect(call.title).toContain('서울')
      expect(call.title).toContain(CATEGORY_META.toilet.label)
      expect(call.title).not.toContain('undefined')
      expect(call.title).not.toContain('null')
    })
  })

  describe('setRegionMeta', () => {
    it('sets region page meta', () => {
      const { setRegionMeta } = useFacilityMeta()

      setRegionMeta({
        city: 'seoul',
        cityName: '서울',
        district: 'gangnam',
        districtName: '강남구',
        category: 'toilet',
      })

      expect(mockUseSeoMeta).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '서울 강남구 공공화장실 | 위치·개방시간 | 일상킷',
          description: '서울 강남구의 공공화장실 위치·개방시간 정보를 확인하세요.',
        })
      )
    })
  })

  describe('setErrorMeta', () => {
    it('sets 404 error page meta', () => {
      const { setErrorMeta } = useFacilityMeta()

      setErrorMeta(404)

      expect(mockUseSeoMeta).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('찾을 수 없습니다'),
        })
      )
    })

    it('sets 500 error page meta', () => {
      const { setErrorMeta } = useFacilityMeta()

      setErrorMeta(500)

      expect(mockUseSeoMeta).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('오류'),
        })
      )
    })
  })

  describe('constants', () => {
    it('exports site constants', () => {
      const { SITE_NAME, SITE_URL, SITE_DESCRIPTION } = useFacilityMeta()

      expect(SITE_NAME).toBe('일상킷')
      expect(SITE_URL).toBe('https://ilsangkit.co.kr')
      expect(SITE_DESCRIPTION).toContain('내 주변')
    })
  })

  describe('setHomeMeta - CTR 최적화', () => {
    it('홈 타이틀에 부동산 또는 생활시설 키워드 포함', () => {
      const { setHomeMeta } = useFacilityMeta()

      setHomeMeta()

      const call = mockUseSeoMeta.mock.calls[0][0]
      const title: string = call.title
      const hasKeyword = ['부동산', '생활시설', '일상킷'].some(kw => title.includes(kw))
      expect(hasKeyword).toBe(true)
    })

    it('홈 타이틀 60자 이내', () => {
      const { setHomeMeta } = useFacilityMeta()

      setHomeMeta()

      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.title.length).toBeLessThanOrEqual(60)
    })
  })

  describe('setMeta - 브랜드 부제 통일', () => {
    it('title이 브랜드명과 같을 때 SITE_TAGLINE을 부제로 쓴다', () => {
      const { setMeta } = useFacilityMeta()
      setMeta({ title: '일상킷', description: '설명', path: '/' })
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.title).toBe('일상킷 - 부동산 실거래가·청약·내 주변 생활정보')
    })
    it('일반 title에는 브랜드 suffix가 1회만 붙는다', () => {
      const { setMeta } = useFacilityMeta()
      setMeta({ title: '병원 찾기', description: '설명', path: '/hospital' })
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.title).toBe('병원 찾기 | 일상킷')
      expect(call.title.match(/일상킷/g)).toHaveLength(1)
    })
  })

  describe('setCategoryMeta - CTR 최적화', () => {
    it('toilet 카테고리 타이틀에 위치 또는 운영시간 포함', () => {
      const { setCategoryMeta } = useFacilityMeta()

      setCategoryMeta('toilet')

      const call = mockUseSeoMeta.mock.calls[0][0]
      const title: string = call.title
      const hasKeyword = ['위치', '운영시간'].some(kw => title.includes(kw))
      expect(hasKeyword).toBe(true)
    })

    it('hospital 카테고리 타이틀 60자 이내', () => {
      const { setCategoryMeta } = useFacilityMeta()

      setCategoryMeta('hospital')

      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.title.length).toBeLessThanOrEqual(60)
    })

    it('hospital 타이틀이 CATEGORY_SEO_TITLE 값을 사용한다', () => {
      const { setCategoryMeta } = useFacilityMeta()

      setCategoryMeta('hospital')

      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.title).toContain(CATEGORY_SEO_TITLE['hospital'])
    })

    it('pharmacy 디스크립션이 CATEGORY_SEO_DESCRIPTION 값을 사용한다', () => {
      const { setCategoryMeta } = useFacilityMeta()

      setCategoryMeta('pharmacy')

      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.description).toBe(CATEGORY_SEO_DESCRIPTION['pharmacy'])
    })

    it('위치 없으면 CATEGORY_SEO_TITLE 완성형을 쓴다', () => {
      const { setCategoryMeta } = useFacilityMeta()
      setCategoryMeta('hospital')
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.title).toBe('병원 찾기 - 근처 병원 진료과·진료시간 확인 | 일상킷')
    })
    it('위치가 있으면 지역 앞배치 타이틀을 만든다', () => {
      const { setCategoryMeta } = useFacilityMeta()
      setCategoryMeta('hospital', { cityName: '서울', districtName: '강남구' })
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.title).toBe('서울 강남구 병원 찾기 | 일상킷')
      expect(call.description).toContain('서울 강남구')
    })
    it('위치가 시(city)만 있으면 시 기준 타이틀', () => {
      const { setCategoryMeta } = useFacilityMeta()
      setCategoryMeta('hospital', { cityName: '서울' })
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.title).toBe('서울 병원 찾기 | 일상킷')
    })
    it('canonical:false 옵션이면 canonical을 설정하지 않는다', () => {
      const { setCategoryMeta } = useFacilityMeta()
      setCategoryMeta('hospital', undefined, { canonical: false })
      const headCallsWithCanonical = mockUseHead.mock.calls.filter((c: unknown[]) => {
        const arg = c[0] as { link?: Array<{ rel: string }> }
        return arg?.link?.some((l) => l.rel === 'canonical')
      })
      expect(headCallsWithCanonical).toHaveLength(0)
    })
  })

  describe('setMeta - og:image:alt', () => {
    it('ogImageAlt가 항상 설정된다 (기본=fullTitle)', () => {
      const { setMeta } = useFacilityMeta()
      setMeta({ title: '병원 찾기', description: '설명', path: '/hospital' })
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.ogImageAlt).toBe('병원 찾기 | 일상킷')
    })
    it('imageAlt 옵션이 있으면 그것을 쓴다', () => {
      const { setMeta } = useFacilityMeta()
      setMeta({ title: '병원 찾기', description: '설명', path: '/hospital', imageAlt: '커스텀 대체텍스트' })
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.ogImageAlt).toBe('커스텀 대체텍스트')
    })
  })

  describe('buildFacilityDescription - CTA', () => {
    const baseToiletFacility: FacilityDetail = {
      id: 'toilet-1',
      category: 'toilet',
      name: '강남역 공중화장실',
      address: '서울시 강남구',
      roadAddress: '서울시 강남구 강남대로 396',
      lat: 37.4979,
      lng: 127.0276,
      city: '서울',
      district: '강남구',
      bjdCode: '11680',
      details: {},
      sourceId: 'test-source',
      sourceUrl: null,
      viewCount: 100,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      syncedAt: '2024-01-01T00:00:00Z',
    }

    const baseHospitalFacility: FacilityDetail = {
      id: 'hospital-1',
      category: 'hospital',
      name: '강남세브란스병원',
      address: '서울시 강남구',
      roadAddress: '서울시 강남구 언주로 211',
      lat: 37.4979,
      lng: 127.0276,
      city: '서울',
      district: '강남구',
      bjdCode: '11680',
      details: {},
      sourceId: 'test-source',
      sourceUrl: null,
      viewCount: 200,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      syncedAt: '2024-01-01T00:00:00Z',
    }

    it('toilet description이 "주소 및 상세 정보 확인"으로 끝나지 않음', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()

      setFacilityDetailMeta(baseToiletFacility)

      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.description).not.toMatch(/주소 및 상세 정보 확인$/)
    })

    it('toilet description에 시설명과 카테고리 포함', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()

      setFacilityDetailMeta(baseToiletFacility)

      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.description).toContain('강남역 공중화장실')
      expect(call.description).toContain('공공화장실')
    })

    it('hospital description에 병원 또는 진료 관련 CTA 포함', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()

      setFacilityDetailMeta(baseHospitalFacility)

      const call = mockUseSeoMeta.mock.calls[0][0]
      const desc: string = call.description
      const hasMedicalCTA = ['병원', '진료'].some(kw => desc.includes(kw))
      expect(hasMedicalCTA).toBe(true)
    })
  })

  describe('buildFacilityDescription — prose shape (Fix 3a)', () => {
    const makeHospitalFacility = (overrides: Partial<FacilityDetail> = {}): FacilityDetail => ({
      id: 'h-2',
      category: 'hospital',
      name: '삼성서울병원',
      address: '서울 강남구 일원로 81',
      roadAddress: '서울 강남구 일원로 81',
      lat: 37.49,
      lng: 127.09,
      city: '서울',
      district: '강남구',
      bjdCode: '11680',
      details: { clCdNm: '종합병원', drTotCnt: 1234 } as Record<string, unknown>,
      sourceId: 'src-2',
      sourceUrl: null,
      viewCount: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      syncedAt: '2024-01-01T00:00:00Z',
      ...overrides,
    })

    it('description ends with CTA "지도에서 확인하세요."', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()
      setFacilityDetailMeta(makeHospitalFacility())
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.description).toMatch(/지도에서 확인하세요\.$/)
    })

    it('facts are joined by ", " (not ". " raw dump)', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()
      setFacilityDetailMeta(makeHospitalFacility())
      const call = mockUseSeoMeta.mock.calls[0][0]
      // The category-facts clause should use comma separators
      expect(call.description).toMatch(/종합병원,/)
    })

    it('description contains name and category', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()
      setFacilityDetailMeta(makeHospitalFacility())
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.description).toContain('삼성서울병원')
      expect(call.description).toContain('병원')
    })

    it('description does NOT contain intent string in a raw fact dump position', () => {
      // intent is in CTA form "진료과·진료시간 등 정보를 지도에서 확인하세요." but NOT as a bare fragment
      const { setFacilityDetailMeta } = useFacilityMeta()
      setFacilityDetailMeta(makeHospitalFacility())
      const call = mockUseSeoMeta.mock.calls[0][0]
      const desc: string = call.description
      // Must contain intent in CTA context, NOT as a raw ". 진료과·진료시간" fragment
      expect(desc).not.toMatch(/\. 진료과·진료시간(?! 등 정보를)/)
    })

    it('155-char cap still applies', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()
      setFacilityDetailMeta(makeHospitalFacility({
        name: '서울특별시강남구일원동초대형종합전문병원메디칼센터서울강남스페셜티클리닉',
        roadAddress: '서울 강남구 일원로 81번길 180 메디칼타워 A동 3층',
      }))
      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.description.length).toBeLessThanOrEqual(155)
    })
  })

  describe('buildDetailTitle — intent tail per category (Fix 2)', () => {
    const makeHospitalFacility = (name: string): FacilityDetail => ({
      id: 'h-1',
      category: 'hospital',
      name,
      address: '서울 강남구 일원로 81',
      roadAddress: '서울 강남구 일원로 81',
      lat: 37.49,
      lng: 127.09,
      city: '서울',
      district: '강남구',
      bjdCode: '11680',
      details: {},
      sourceId: 'src-1',
      sourceUrl: null,
      viewCount: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      syncedAt: '2024-01-01T00:00:00Z',
    })

    it('normal hospital: title contains name + loc + category + intent', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()
      setFacilityDetailMeta(makeHospitalFacility('삼성서울병원'))

      const call = mockUseSeoMeta.mock.calls[0][0]
      // full title includes " | 일상킷" appended by setMeta
      const raw: string = call.title
      expect(raw).toContain('삼성서울병원')
      expect(raw).toContain('강남구')
      expect(raw).toContain('병원')
      // must contain the intent string for hospital
      expect(raw).toContain('진료시간·진료과목')
    })

    it('normal hospital: title format is {name} | {loc} {category} {intent} | 일상킷', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()
      setFacilityDetailMeta(makeHospitalFacility('삼성서울병원'))

      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.title).toBe('삼성서울병원 | 서울 강남구 병원 진료시간·진료과목 | 일상킷')
    })

    it('long-name facility: keeps loc + category + intent (no length guard)', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()
      // composite가 24자를 한참 넘는 긴 이름이라도 지역·카테고리를 버리지 않는다
      const longName = '서울대학교어린이병원응급의료센터입구'  // 17 chars
      setFacilityDetailMeta(makeHospitalFacility(longName))

      const call = mockUseSeoMeta.mock.calls[0][0]
      expect(call.title).toBe(`${longName} | 서울 강남구 병원 진료시간·진료과목 | 일상킷`)
    })
  })
})
