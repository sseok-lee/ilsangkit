import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Nuxt composables
const mockUseSeoMeta = vi.fn()
const mockUseHead = vi.fn()

vi.stubGlobal('useSeoMeta', mockUseSeoMeta)
vi.stubGlobal('useHead', mockUseHead)

// Import after mocking
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import type { FacilityDetail } from '~/types/facility'

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
          title: undefined,
          ogSiteName: '일상킷',
          ogLocale: 'ko_KR',
          twitterCard: 'summary_large_image',
        })
      )

      expect(mockUseHead).toHaveBeenCalledWith({
        link: [{ rel: 'canonical', href: 'https://ilsangkit.co.kr/' }],
      })
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
          ogType: 'article',
        })
      )
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
          title: expect.stringContaining('서울 강남구 공공화장실'),
          description: expect.stringContaining('서울 강남구'),
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
})
