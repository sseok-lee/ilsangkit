import { ref, nextTick } from 'vue'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRegions, CITY_SLUG_MAP, CITY_NAME_TO_SLUG, generateSlug } from '~/composables/useRegions'
import type { RegionInfo } from '~/types/facility'

// Mock Nuxt composables
vi.mock('#app', () => ({
  useRuntimeConfig: () => ({
    public: {
      apiBase: 'http://localhost:8000',
    },
  }),
}))

// Mock $fetch and Nuxt auto-imports
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)
vi.stubGlobal('useState', (_key: string, init: () => any) => ref(init()))
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

  describe('syncFromHydration', () => {
    const mockRegions: RegionInfo[] = [
      { id: 1, city: '서울', district: '강남구', slug: 'gangnam', lat: 37.5172, lng: 127.0473, bjdCode: '1168000000' },
      { id: 2, city: '서울', district: '송파구', slug: 'songpa', lat: 37.5146, lng: 127.1050, bjdCode: '1171000000' },
    ]

    it('syncs hydrated data into cache when not yet loaded', () => {
      const { syncFromHydration, regions, isLoaded } = useRegions()
      const hydratedData = ref<RegionInfo[] | null>(mockRegions)

      syncFromHydration(hydratedData)

      expect(regions.value).toEqual(mockRegions)
      expect(isLoaded.value).toBe(true)
    })

    it('does not overwrite if already loaded', () => {
      const { syncFromHydration, regions } = useRegions()

      // First sync loads data
      const hydratedData = ref<RegionInfo[] | null>(mockRegions)
      syncFromHydration(hydratedData)
      expect(regions.value).toEqual(mockRegions)

      // Second sync with different data should not overwrite (isLoaded is already true)
      const otherData = ref<RegionInfo[] | null>([
        { id: 3, city: '부산', district: '해운대구', slug: 'haeundae', lat: 35.1631, lng: 129.1635, bjdCode: '2635000000' },
      ])
      syncFromHydration(otherData)

      // Should still have original data
      expect(regions.value).toEqual(mockRegions)
    })

    it('skips sync when hydrated data is null', () => {
      const { syncFromHydration, regions, isLoaded } = useRegions()
      const hydratedData = ref<RegionInfo[] | null>(null)

      syncFromHydration(hydratedData)

      expect(regions.value).toEqual([])
      expect(isLoaded.value).toBe(false)
    })

    it('skips sync when hydrated data is empty array', () => {
      const { syncFromHydration, regions, isLoaded } = useRegions()
      const hydratedData = ref<RegionInfo[] | null>([])

      syncFromHydration(hydratedData)

      expect(regions.value).toEqual([])
      expect(isLoaded.value).toBe(false)
    })

    it('syncs when watch triggers with new data', async () => {
      const { syncFromHydration, regions, isLoaded } = useRegions()
      const hydratedData = ref<RegionInfo[] | null>(null)

      syncFromHydration(hydratedData)
      expect(regions.value).toEqual([])

      // Simulate watch trigger by updating the ref
      hydratedData.value = mockRegions
      await nextTick()

      expect(regions.value).toEqual(mockRegions)
      expect(isLoaded.value).toBe(true)
    })
  })
})
