import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRegions, CITY_SLUG_MAP, CITY_NAME_TO_SLUG, generateSlug } from '~/composables/useRegions'

// Mock Nuxt composables
vi.mock('#app', () => ({
  useRuntimeConfig: () => ({
    public: {
      apiBase: 'http://localhost:8000',
    },
  }),
}))

// Mock $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {
    apiBase: 'http://localhost:8000',
  },
}))

describe('useRegions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('CITY_SLUG_MAP', () => {
    it('contains major cities', () => {
      expect(CITY_SLUG_MAP.seoul).toBe('서울')
      expect(CITY_SLUG_MAP.busan).toBe('부산')
      expect(CITY_SLUG_MAP.gyeonggi).toBe('경기')
    })
  })

  describe('CITY_NAME_TO_SLUG', () => {
    it('reverse maps city names to slugs', () => {
      expect(CITY_NAME_TO_SLUG['서울']).toBe('seoul')
      expect(CITY_NAME_TO_SLUG['부산']).toBe('busan')
    })
  })

  describe('generateSlug', () => {
    it('generates slug for known districts', () => {
      expect(generateSlug('강남구')).toBe('gangnam')
      expect(generateSlug('송파구')).toBe('songpa')
      expect(generateSlug('해운대구')).toBe('haeundae')
    })

    it('handles unknown districts', () => {
      const result = generateSlug('테스트구')
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('useRegions composable', () => {
    it('initializes with empty regions', () => {
      const { regions, isLoaded, isLoading } = useRegions()

      expect(regions.value).toEqual([])
      expect(isLoaded.value).toBe(false)
      expect(isLoading.value).toBe(false)
    })

    it('getCityName returns Korean name for known slugs', () => {
      const { getCityName } = useRegions()

      expect(getCityName('seoul')).toBe('서울')
      expect(getCityName('busan')).toBe('부산')
    })

    it('getCityName returns slug for unknown cities', () => {
      const { getCityName } = useRegions()

      expect(getCityName('unknown')).toBe('unknown')
    })
  })
})
