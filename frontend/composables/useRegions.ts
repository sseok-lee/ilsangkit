import { ref, readonly, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { RegionInfo } from '~/types/facility'

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
 * 시/도 slug → 한글명 매핑 (정적)
 */
export const CITY_SLUG_MAP: Record<string, string> = {
  seoul: '서울',
  busan: '부산',
  daegu: '대구',
  incheon: '인천',
  gwangju: '광주',
  daejeon: '대전',
  ulsan: '울산',
  sejong: '세종',
  gyeonggi: '경기',
  gangwon: '강원',
  chungbuk: '충북',
  chungnam: '충남',
  jeonbuk: '전북',
  jeonnam: '전남',
  gyeongbuk: '경북',
  gyeongnam: '경남',
  jeju: '제주',
}

/**
 * 한글 시/도명 → slug 역매핑
 */
export const CITY_NAME_TO_SLUG: Record<string, string> = Object.entries(CITY_SLUG_MAP).reduce(
  (acc, [slug, name]) => ({ ...acc, [name]: slug }),
  {} as Record<string, string>
)

/**
 * DB 풀네임 → slug 매핑 (서울특별시 → seoul 등)
 */
const CITY_FULL_NAME_TO_SLUG: Record<string, string> = {
  서울특별시: 'seoul',
  부산광역시: 'busan',
  대구광역시: 'daegu',
  인천광역시: 'incheon',
  광주광역시: 'gwangju',
  대전광역시: 'daejeon',
  울산광역시: 'ulsan',
  세종특별자치시: 'sejong',
  경기도: 'gyeonggi',
  강원특별자치도: 'gangwon',
  충청북도: 'chungbuk',
  충청남도: 'chungnam',
  전북특별자치도: 'jeonbuk',
  전라남도: 'jeonnam',
  경상북도: 'gyeongbuk',
  경상남도: 'gyeongnam',
  제주특별자치도: 'jeju',
}

/**
 * 한글명에서 slug 생성 (한글 → 로마자 변환)
 */
export function generateSlug(koreanName: string): string {
  const romanizationMap: Record<string, string> = {
    // 서울 구
    강남구: 'gangnam-gu',
    강동구: 'gangdong-gu',
    강북구: 'gangbuk-gu',
    강서구: 'gangseo-gu',
    관악구: 'gwanak-gu',
    광진구: 'gwangjin-gu',
    구로구: 'guro-gu',
    금천구: 'geumcheon-gu',
    노원구: 'nowon-gu',
    도봉구: 'dobong-gu',
    동대문구: 'dongdaemun-gu',
    동작구: 'dongjak-gu',
    마포구: 'mapo-gu',
    서대문구: 'seodaemun-gu',
    서초구: 'seocho-gu',
    성동구: 'seongdong-gu',
    성북구: 'seongbuk-gu',
    송파구: 'songpa-gu',
    양천구: 'yangcheon-gu',
    영등포구: 'yeongdeungpo-gu',
    용산구: 'yongsan-gu',
    은평구: 'eunpyeong-gu',
    종로구: 'jongno-gu',
    중구: 'jung-gu',
    중랑구: 'jungnang-gu',
    // 부산 구/군
    해운대구: 'haeundae-gu',
    부산진구: 'busanjin-gu',
    동래구: 'dongnae-gu',
    남구: 'nam-gu',
    북구: 'buk-gu',
    사하구: 'saha-gu',
    사상구: 'sasang-gu',
    수영구: 'suyeong-gu',
    연제구: 'yeonje-gu',
    영도구: 'yeongdo-gu',
    금정구: 'geumjeong-gu',
    기장군: 'gijang-gun',
    // 경기 시/군
    수원시: 'suwon-si',
    성남시: 'seongnam-si',
    고양시: 'goyang-si',
    용인시: 'yongin-si',
    부천시: 'bucheon-si',
    안산시: 'ansan-si',
    안양시: 'anyang-si',
    남양주시: 'namyangju-si',
    화성시: 'hwaseong-si',
    평택시: 'pyeongtaek-si',
    의정부시: 'uijeongbu-si',
    시흥시: 'siheung-si',
    파주시: 'paju-si',
    김포시: 'gimpo-si',
    광명시: 'gwangmyeong-si',
    광주시: 'gwangju-si',
    군포시: 'gunpo-si',
    하남시: 'hanam-si',
    오산시: 'osan-si',
    이천시: 'icheon-si',
    안성시: 'anseong-si',
    의왕시: 'uiwang-si',
    양평군: 'yangpyeong-gun',
    여주시: 'yeoju-si',
    과천시: 'gwacheon-si',
    구리시: 'guri-si',
    포천시: 'pocheon-si',
    양주시: 'yangju-si',
    동두천시: 'dongducheon-si',
    가평군: 'gapyeong-gun',
    연천군: 'yeoncheon-gun',
    // 인천
    강화군: 'ganghwa-gun',
    // 세종
    세종시: 'sejong-si',
  }

  // 매핑에 있으면 반환
  if (romanizationMap[koreanName]) {
    return romanizationMap[koreanName]
  }

  // 없으면 기본 변환: 행정 접미사를 로마자로 치환
  return koreanName
    .replace(/구$/, '-gu')
    .replace(/시$/, '-si')
    .replace(/군$/, '-gun')
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
      // 이미 로딩 중이면 완료될 때까지 대기
      await new Promise((resolve) => {
        const check = setInterval(() => {
          if (isLoaded.value) {
            clearInterval(check)
            resolve(true)
          }
        }, 100)
      })
      return cachedRegions.value
    }

    isLoading.value = true
    error.value = null

    try {
      const config = useRuntimeConfig()
      const apiBase = config.public.apiBase

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
        || CITY_FULL_NAME_TO_SLUG[region.city]
        || generateSlug(region.city)

      if (!cityMap.has(citySlug)) {
        cityMap.set(citySlug, [])
      }

      // slug 중복 방지 (같은 구가 다른 city 형식으로 중복 저장된 경우)
      const existingDistricts = cityMap.get(citySlug)!
      if (existingDistricts.some((d) => d.slug === region.slug)) continue

      existingDistricts.push({
        slug: region.slug,
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
      (r) => (r.city === cityName || r.city.startsWith(cityName)) && r.slug === districtSlug
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
