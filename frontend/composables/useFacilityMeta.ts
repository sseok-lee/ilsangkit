import type { FacilityCategory, FacilityDetail, ToiletDetails, WifiDetails, ParkingDetails, KioskDetails, HospitalDetails, PharmacyDetails, AedDetails, LibraryDetails, ClothesDetails } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'

/**
 * 메타태그 옵션
 */
interface MetaOptions {
  title: string
  description: string
  path?: string
  image?: string
  type?: 'website' | 'article'
}

/**
 * 카테고리별 시설 description 생성
 */
function buildFacilityDescription(facility: FacilityDetail): string {
  const location = facility.district
    ? `${facility.city} ${facility.district}`
    : facility.city
  const address = facility.roadAddress || facility.address || location
  const parts: string[] = []

  if (address) parts.push(address)

  const d = facility.details as Record<string, unknown>

  switch (facility.category) {
    case 'toilet': {
      const det = d as ToiletDetails
      if (det.operatingHours) parts.push(det.operatingHours)
      const features: string[] = []
      if (det.maleToilets || det.femaleToilets) features.push('남녀 분리')
      if (det.hasDisabledToilet) features.push('장애인 화장실 있음')
      if (det.hasDiaperChangingTable) features.push('기저귀 교환대')
      if (features.length) parts.push(features.join(', '))
      break
    }
    case 'wifi': {
      const det = d as WifiDetails
      if (det.ssid) parts.push(`SSID: ${det.ssid}`)
      if (det.serviceProvider) parts.push(det.serviceProvider)
      break
    }
    case 'parking': {
      const det = d as ParkingDetails
      if (det.capacity) parts.push(`주차면수 ${det.capacity}면`)
      if (det.baseFee != null && det.baseTime) parts.push(`기본 ${det.baseTime}분 ${det.baseFee.toLocaleString()}원`)
      if (det.operatingHours) parts.push(det.operatingHours)
      break
    }
    case 'kiosk': {
      const det = d as KioskDetails
      if (det.weekdayOperatingHours) parts.push(`평일 ${det.weekdayOperatingHours}`)
      const access: string[] = []
      if (det.voiceGuide) access.push('음성안내')
      if (det.brailleOutput) access.push('점자출력')
      if (det.wheelchairAccessible) access.push('휠체어 접근')
      if (access.length) parts.push(access.join(', '))
      break
    }
    case 'hospital': {
      const det = d as HospitalDetails
      if (det.clCdNm) parts.push(det.clCdNm)
      if (det.drTotCnt) parts.push(`의사 ${det.drTotCnt}명`)
      if (det.phone) parts.push(`☎ ${det.phone}`)
      break
    }
    case 'pharmacy': {
      const det = d as PharmacyDetails
      if (det.phone) parts.push(`☎ ${det.phone}`)
      if (det.dutyTime1s && det.dutyTime1c) parts.push(`월 ${det.dutyTime1s}~${det.dutyTime1c}`)
      break
    }
    case 'aed': {
      const det = d as AedDetails
      if (det.buildPlace) parts.push(`설치장소: ${det.buildPlace}`)
      if (det.org) parts.push(det.org)
      break
    }
    case 'library': {
      const det = d as LibraryDetails
      const info: string[] = []
      if (det.seatCount) info.push(`좌석 ${det.seatCount}석`)
      if (det.bookCount) info.push(`장서 ${det.bookCount.toLocaleString()}권`)
      if (info.length) parts.push(info.join(', '))
      if (det.weekdayOpenTime && det.weekdayCloseTime) parts.push(`평일 ${det.weekdayOpenTime}~${det.weekdayCloseTime}`)
      if (det.phoneNumber) parts.push(`☎ ${det.phoneNumber}`)
      break
    }
    case 'clothes': {
      const det = d as ClothesDetails
      if (det.managementAgency) parts.push(`관리: ${det.managementAgency}`)
      if (det.detailLocation) parts.push(det.detailLocation)
      break
    }
  }

  parts.push('주소 및 상세 정보 확인')

  // 155자 이내로 자르기
  let desc = parts.join('. ')
  if (desc.length > 155) {
    desc = desc.slice(0, 152) + '...'
  }
  return desc
}

/**
 * 공통 메타태그 설정
 */
export function useFacilityMeta() {
  /**
   * 기본 메타태그 설정
   */
  function setMeta(options: MetaOptions) {
    // titleTemplate은 pass-through이므로 여기서 완전한 title 구성
    const fullTitle = options.title === SITE_NAME
      ? `${SITE_NAME} - 내 주변 생활 편의 정보`
      : `${options.title} - ${SITE_NAME}`

    const canonicalUrl = options.path ? `${SITE_URL}${options.path}` : SITE_URL

    useSeoMeta({
      title: fullTitle,
      description: options.description,

      // Open Graph
      ogTitle: fullTitle,
      ogDescription: options.description,
      ogImage: options.image || DEFAULT_OG_IMAGE,
      ogUrl: canonicalUrl,
      ogSiteName: SITE_NAME,
      ogType: options.type || 'website',
      ogLocale: 'ko_KR',

      // Twitter Card
      twitterCard: 'summary_large_image',
      twitterTitle: fullTitle,
      twitterDescription: options.description,
      twitterImage: options.image || DEFAULT_OG_IMAGE,
    })

    // Canonical URL
    useHead({
      link: [
        { rel: 'canonical', href: canonicalUrl },
      ],
    })
  }

  /**
   * 홈페이지 메타태그
   */
  function setHomeMeta() {
    setMeta({
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      path: '/',
    })
  }

  /**
   * 검색 결과 페이지 메타태그
   */
  function setSearchMeta(params: {
    keyword?: string
    category?: FacilityCategory
    city?: string
    district?: string
  }) {
    const parts: string[] = []

    if (params.keyword) {
      parts.push(`'${params.keyword}' 검색 결과`)
    }

    if (params.category) {
      const categoryName = CATEGORY_META[params.category]?.label || params.category
      parts.push(categoryName)
    }

    if (params.city && params.district) {
      parts.push(`${params.city} ${params.district}`)
    }

    const title = parts.length > 0
      ? parts.join(' - ')
      : '시설 검색'

    const description = params.keyword
      ? `${params.keyword} 관련 시설 검색 결과입니다.`
      : params.category
        ? `${CATEGORY_META[params.category]?.label || params.category} 검색 결과입니다.`
        : '내 주변 생활 편의 시설을 검색하세요.'

    setMeta({
      title,
      description,
      path: '/search',
    })
  }

  /**
   * 시설 상세 페이지 메타태그
   */
  function setFacilityDetailMeta(facility: FacilityDetail) {
    const categoryName = CATEGORY_META[facility.category]?.label || facility.category
    const location = facility.district
      ? `${facility.city} ${facility.district}`
      : facility.city

    const title = `${facility.name} - ${location} ${categoryName}`
    const description = buildFacilityDescription(facility)

    setMeta({
      title,
      description,
      path: `/${facility.category}/${facility.id}`,
    })
  }

  /**
   * 지역별 페이지 메타태그
   */
  function setRegionMeta(params: {
    city: string
    cityName: string
    district: string
    districtName: string
    category: FacilityCategory
  }) {
    const categoryName = CATEGORY_META[params.category]?.label || params.category

    const title = `${params.cityName} ${params.districtName} ${categoryName}`
    const description = `${params.cityName} ${params.districtName}의 ${categoryName} 위치 정보를 확인하세요.`

    setMeta({
      title,
      description,
      path: `/${params.city}/${params.district}/${params.category}`,
    })
  }

  /**
   * 쓰레기 배출 상세 페이지 메타태그
   */
  function setWasteScheduleDetailMeta(schedule: {
    id: number
    city: string
    district: string
    targetRegion?: string | null
  }) {
    const location = `${schedule.city} ${schedule.district}`
    const title = `${location} 쓰레기 배출 일정`
    const description = schedule.targetRegion
      ? `${location} ${schedule.targetRegion} 지역의 쓰레기 배출 요일, 시간, 방법을 확인하세요.`
      : `${location} 지역의 쓰레기 배출 요일, 시간, 방법을 확인하세요.`

    setMeta({
      title,
      description,
      path: `/trash/${schedule.id}`,
      type: 'article',
    })
  }

  /**
   * 에러 페이지 메타태그
   */
  function setErrorMeta(statusCode: number) {
    const title = statusCode === 404
      ? '페이지를 찾을 수 없습니다'
      : '오류가 발생했습니다'

    const description = statusCode === 404
      ? '요청하신 페이지를 찾을 수 없습니다.'
      : '서비스 이용 중 오류가 발생했습니다.'

    setMeta({
      title,
      description,
    })
  }

  return {
    setMeta,
    setHomeMeta,
    setSearchMeta,
    setFacilityDetailMeta,
    setWasteScheduleDetailMeta,
    setRegionMeta,
    setErrorMeta,
    SITE_NAME,
    SITE_URL,
    SITE_DESCRIPTION,
  }
}
