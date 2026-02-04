import { ref, readonly, computed } from 'vue'
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

// 캐시된 지역 데이터
const cachedRegions = ref<RegionInfo[]>([])
const isLoaded = ref(false)
const isLoading = ref(false)

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
 * 한글명에서 slug 생성 (한글 → 로마자 변환)
 */
export function generateSlug(koreanName: string): string {
  const romanizationMap: Record<string, string> = {
    // 서울 구
    강남구: 'gangnam',
    강동구: 'gangdong',
    강북구: 'gangbuk',
    강서구: 'gangseo',
    관악구: 'gwanak',
    광진구: 'gwangjin',
    구로구: 'guro',
    금천구: 'geumcheon',
    노원구: 'nowon',
    도봉구: 'dobong',
    동대문구: 'dongdaemun',
    동작구: 'dongjak',
    마포구: 'mapo',
    서대문구: 'seodaemun',
    서초구: 'seocho',
    성동구: 'seongdong',
    성북구: 'seongbuk',
    송파구: 'songpa',
    양천구: 'yangcheon',
    영등포구: 'yeongdeungpo',
    용산구: 'yongsan',
    은평구: 'eunpyeong',
    종로구: 'jongno',
    중구: 'jung',
    중랑구: 'jungnang',
    // 부산 구
    해운대구: 'haeundae',
    부산진구: 'busanjin',
    동래구: 'dongnae',
    남구: 'nam',
    북구: 'buk',
    사하구: 'saha',
    사상구: 'sasang',
    수영구: 'suyeong',
    연제구: 'yeonje',
    영도구: 'yeongdo',
    금정구: 'geumjeong',
    기장군: 'gijang',
    // 경기 시/군
    수원시: 'suwon',
    성남시: 'seongnam',
    고양시: 'goyang',
    용인시: 'yongin',
    부천시: 'bucheon',
    안산시: 'ansan',
    안양시: 'anyang',
    남양주시: 'namyangju',
    화성시: 'hwaseong',
    평택시: 'pyeongtaek',
    의정부시: 'uijeongbu',
    시흥시: 'siheung',
    파주시: 'paju',
    김포시: 'gimpo',
    광명시: 'gwangmyeong',
    광주시: 'gwangju',
    군포시: 'gunpo',
    하남시: 'hanam',
    오산시: 'osan',
    이천시: 'icheon',
    안성시: 'anseong',
    의왕시: 'uiwang',
    양평군: 'yangpyeong',
    여주시: 'yeoju',
    과천시: 'gwacheon',
    구리시: 'guri',
    포천시: 'pocheon',
    양주시: 'yangju',
    동두천시: 'dongducheon',
    가평군: 'gapyeong',
    연천군: 'yeoncheon',
  }

  // 매핑에 있으면 반환
  if (romanizationMap[koreanName]) {
    return romanizationMap[koreanName]
  }

  // 없으면 기본 변환: 한글 제거하고 소문자화
  return koreanName
    .replace(/[시군구]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
}

/**
 * 지역 정보 조회 및 캐싱 composable
 */
export function useRegions() {
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
      const citySlug = CITY_NAME_TO_SLUG[region.city] || generateSlug(region.city)

      if (!cityMap.has(citySlug)) {
        cityMap.set(citySlug, [])
      }

      cityMap.get(citySlug)!.push({
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
      (r) => r.city === cityName && r.slug === districtSlug
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

  return {
    regions: readonly(cachedRegions),
    isLoaded: readonly(isLoaded),
    isLoading: readonly(isLoading),
    error: readonly(error),
    citiesWithDistricts,
    loadRegions,
    findRegionBySlug,
    getDistrictsByCity,
    getCityName,
    getDistrictName,
  }
}
