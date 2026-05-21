import { ref, readonly, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { RegionInfo } from '~/types/facility'
import {
  CITY_SLUG_MAP as SHARED_CITY_SLUG_MAP,
  CITY_SLUGS as SHARED_CITY_SLUGS,
  CITY_FULL_NAME_TO_SLUG as SHARED_CITY_FULL_NAME_TO_SLUG,
  DISTRICT_SLUG_MAP,
} from '~/shared/regionSlugs'

/**
 * 시/도 정보
 */
export interface CityData {
  slug: string
  name: string
  districts: DistrictData[]
}

/**
 * 구/군 정보
 */
export interface DistrictData {
  slug: string
  name: string
  lat: number
  lng: number
  bjdCode: string
}


/**
 * 시/도 slug → 한글명 매핑 (shared에서 가져옴)
 */
export const CITY_SLUG_MAP: Record<string, string> = SHARED_CITY_SLUG_MAP

/**
 * 한글 시/도명 → slug 역매핑
 */
export const CITY_NAME_TO_SLUG: Record<string, string> = SHARED_CITY_SLUGS

/**
 * 한글명에서 slug 생성 (한글 → 로마자 변환)
 * shared/regionSlugs.ts의 DISTRICT_SLUG_MAP을 사용하여 전체 지역 커버
 */
export function generateSlug(koreanName: string): string {
  if (DISTRICT_SLUG_MAP[koreanName]) {
    return DISTRICT_SLUG_MAP[koreanName]
  }

  // fallback: 매핑에 없는 경우 (새로 추가된 지역 등)
  return koreanName
    .replace(/[시군구]/g, '')
    .replace(/[가-힣]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
}

/**
 * 지역 정보 조회 및 캐싱 composable
 */
export function useRegions() {
  const cachedRegions = useState<RegionInfo[]>('regions-cache', () => [])
  const isLoaded = useState<boolean>('regions-loaded', () => false)
  const isLoading = useState<boolean>('regions-loading', () => false)
  const error = ref<string | null>(null)

  /**
   * API에서 전체 지역 정보 로드
   */
  async function loadRegions(): Promise<RegionInfo[]> {
    if (isLoaded.value) {
      return cachedRegions.value
    }

    if (isLoading.value) {
      // 이미 로딩 중이면 완료될 때까지 대기 (최대 30초)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          unwatch()
          resolve()
        }, 30_000)
        const unwatch = watch(isLoaded, (loaded) => {
          if (loaded) {
            clearTimeout(timeout)
            unwatch()
            resolve()
          }
        }, { immediate: true })
      })
      return cachedRegions.value
    }

    isLoading.value = true
    error.value = null

    try {
      const apiBase = useApiBase()

      const response = await $fetch<{ success: boolean; data: RegionInfo[] }>(
        `${apiBase}/api/meta/regions`
      )

      if (response.success && response.data) {
        cachedRegions.value = response.data
        isLoaded.value = true
      }

      return cachedRegions.value
    } catch (err: any) {
      error.value = err?.message || '지역 정보를 불러오는데 실패했습니다.'
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 시/도별 구/군 목록 가져오기
   */
  const citiesWithDistricts = computed((): CityData[] => {
    const cityMap = new Map<string, DistrictData[]>()

    for (const region of cachedRegions.value) {
      const citySlug = CITY_NAME_TO_SLUG[region.city]
        || SHARED_CITY_FULL_NAME_TO_SLUG[region.city]
        || generateSlug(region.city)

      if (!cityMap.has(citySlug)) {
        cityMap.set(citySlug, [])
      }

      // slug가 한글이면 로마자로 변환 (DB 데이터 방어)
      const districtSlug = /[가-힣]/.test(region.slug)
        ? generateSlug(region.district)
        : region.slug

      // slug 중복 방지 (같은 구가 다른 city 형식으로 중복 저장된 경우)
      const existingDistricts = cityMap.get(citySlug)!
      if (existingDistricts.some((d) => d.slug === districtSlug)) continue

      existingDistricts.push({
        slug: districtSlug,
        name: region.district,
        lat: region.lat,
        lng: region.lng,
        bjdCode: region.bjdCode,
      })
    }

    return Array.from(cityMap.entries()).map(([slug, districts]) => ({
      slug,
      name: CITY_SLUG_MAP[slug] || slug,
      districts: districts.sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    }))
  })

  /**
   * slug로 지역 정보 찾기
   */
  function findRegionBySlug(citySlug: string, districtSlug: string): RegionInfo | undefined {
    const cityName = CITY_SLUG_MAP[citySlug]
    if (!cityName) return undefined

    return cachedRegions.value.find(
      (r) => {
        if (!(r.city === cityName || r.city.startsWith(cityName))) return false
        // DB slug가 한글이면 generateSlug로 변환하여 비교
        const rSlug = /[가-힣]/.test(r.slug) ? generateSlug(r.district) : r.slug
        return rSlug === districtSlug
      }
    )
  }

  /**
   * 시/도 slug로 구/군 목록 가져오기
   */
  function getDistrictsByCity(citySlug: string): DistrictData[] {
    const city = citiesWithDistricts.value.find((c) => c.slug === citySlug)
    return city?.districts || []
  }

  /**
   * slug → 한글명 변환
   */
  function getCityName(citySlug: string): string {
    return CITY_SLUG_MAP[citySlug] || citySlug
  }

  function getDistrictName(citySlug: string, districtSlug: string): string {
    const region = findRegionBySlug(citySlug, districtSlug)
    return region?.district || districtSlug
  }

  /**
   * useAsyncData의 hydrated data로 캐시 동기화
   * 페이지에서 useAsyncData 후 호출하여 SSR→클라이언트 하이드레이션 보장
   */
  function syncFromHydration(data: Ref<RegionInfo[] | null>) {
    if (data.value?.length && !isLoaded.value) {
      cachedRegions.value = data.value
      isLoaded.value = true
    }
    watch(data, (newData) => {
      if (newData?.length) {
        cachedRegions.value = newData
        isLoaded.value = true
      }
    })
  }

  return {
    regions: readonly(cachedRegions),
    isLoaded: readonly(isLoaded),
    isLoading: readonly(isLoading),
    error: readonly(error),
    citiesWithDistricts,
    loadRegions,
    syncFromHydration,
    findRegionBySlug,
    getDistrictsByCity,
    getCityName,
    getDistrictName,
  }
}
