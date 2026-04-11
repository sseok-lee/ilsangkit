import type { FacilityCategory, FacilityDetail, ToiletDetails, WifiDetails, ParkingDetails, HospitalDetails, PharmacyDetails, AedDetails, LibraryDetails, ClothesDetails, ParkDetails, SchoolDetails, MarketDetails, ChildcareDetails, EvChargerDetails, SportsDetails } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, DEFAULT_OG_IMAGE, CATEGORY_CTA } from '~/utils/seoConstants'

/** 받침 유무에 따라 조사 선택 (은/는, 이/가, 을/를 등) */
function getJosa(word: string, josaWithBatchim: string, josaWithout: string): string {
  if (!word) return josaWithBatchim
  const lastChar = word.charCodeAt(word.length - 1)
  if (lastChar < 0xAC00 || lastChar > 0xD7A3) {
    const lastDigitMap: Record<string, boolean> = { '0': true, '1': true, '3': true, '6': true, '7': true, '8': true }
    const lastStr = word[word.length - 1]
    if (lastStr in lastDigitMap) return josaWithBatchim
    return josaWithout
  }
  const hasBatchim = (lastChar - 0xAC00) % 28 !== 0
  return hasBatchim ? josaWithBatchim : josaWithout
}

/** "0900" → "09:00" */
function formatTimeStr(t: string): string {
  const s = String(t).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)}`
}

/**
 * 메타태그 옵션
 */
interface MetaOptions {
  title: string
  description: string
  path?: string
  image?: string
  type?: 'website' | 'article'
  category?: string
}

/**
 * 카테고리별 시설 description 생성
 */
/**
 * 상세 페이지 h1 아래 자연어 설명문 생성
 */
export function buildFacilityIntro(facility: FacilityDetail): string {
  const categoryName = CATEGORY_META[facility.category]?.label || facility.category
  const location = facility.district
    ? `${facility.city} ${facility.district}`
    : facility.city
  const josa = getJosa(facility.name, '은', '는')
  return `${facility.name}${josa} ${location}에 위치한 ${categoryName}입니다.`
}

export function buildFacilityDescription(facility: FacilityDetail): string {
  const categoryName = CATEGORY_META[facility.category]?.label || facility.category
  const location = facility.district
    ? `${facility.city} ${facility.district}`
    : facility.city
  const address = facility.roadAddress || facility.address || location
  const parts: string[] = []

  // 시설명 + 지역 + 카테고리를 먼저 배치
  const josa = getJosa(facility.name, '은', '는')
  parts.push(`${facility.name}${josa} ${location}에 위치한 ${categoryName}입니다`)

  const d = facility.details as Record<string, unknown>

  switch (facility.category) {
    case 'toilet': {
      const det = d as ToiletDetails
      const features: string[] = []
      if (det.operatingHours === '24시간') features.push('상시 개방')
      else if (det.operatingHours) features.push(det.operatingHours)
      if (det.maleToilets || det.femaleToilets) features.push('남녀 분리')
      if (det.hasCCTV) features.push('CCTV 설치')
      if (det.hasDisabledToilet) features.push('장애인 화장실')
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
    case 'hospital': {
      const det = d as HospitalDetails
      if (det.clCdNm) parts.push(det.clCdNm)
      if (det.drTotCnt) parts.push(`의사 ${det.drTotCnt}명`)
      break
    }
    case 'pharmacy': {
      const det = d as PharmacyDetails
      if (det.dutyTime1s && det.dutyTime1c) parts.push(`월 ${formatTimeStr(det.dutyTime1s)}~${formatTimeStr(det.dutyTime1c)}`)
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
      break
    }
    case 'clothes': {
      const det = d as ClothesDetails
      if (det.managementAgency) parts.push(`관리: ${det.managementAgency}`)
      if (det.detailLocation) parts.push(det.detailLocation)
      break
    }
    case 'park': {
      const det = d as ParkDetails
      if (det.parkType) parts.push(det.parkType)
      if (det.area) parts.push(`면적 ${det.area.toLocaleString()}㎡`)
      if (det.managingOrg) parts.push(`관리: ${det.managingOrg}`)
      break
    }
    case 'school': {
      const det = d as SchoolDetails
      if (det.schoolLevel) parts.push(det.schoolLevel)
      if (det.foundationType) parts.push(det.foundationType)
      if (det.operationStatus) parts.push(det.operationStatus)
      break
    }
    case 'market': {
      const det = d as MarketDetails
      if (det.marketType) parts.push(det.marketType)
      if (det.openingCycle) parts.push(`개장: ${det.openingCycle}`)
      if (det.storeCount) parts.push(`점포 ${det.storeCount.toLocaleString()}개`)
      break
    }
    case 'childcare': {
      const det = d as ChildcareDetails
      if (det.crtypename) parts.push(det.crtypename)
      if (det.crcapat) parts.push(`정원 ${det.crcapat}명`)
      if (det.crchcnt) parts.push(`현원 ${det.crchcnt}명`)
      break
    }
    case 'ev-charger': {
      const det = d as EvChargerDetails
      const charger = det.chargers?.[0]
      if (charger?.chgerType) parts.push(`충전기 타입: ${charger.chgerType}`)
      if (charger?.output) parts.push(`출력 ${charger.output}kW`)
      if (det.useTime) parts.push(det.useTime)
      break
    }
    case 'sports': {
      const det = d as SportsDetails
      if (det.ftypeNm) parts.push(det.ftypeNm)
      if (det.faciGbNm) parts.push(det.faciGbNm)
      if (det.faciGfa) parts.push(`연면적 ${det.faciGfa}`)
      break
    }
  }

  if (address) parts.push(address)

  // 155자 이내로 자르기
  let desc = parts.join('. ') + '.'
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
      : options.title.includes(SITE_NAME)
        ? options.title
        : `${options.title} - ${SITE_NAME}`

    const canonicalUrl = options.path ? `${SITE_URL}${options.path}` : SITE_URL

    const dynamicOgImage = options.image || (options.category
      ? `${SITE_URL}/og?category=${encodeURIComponent(options.category)}&title=${encodeURIComponent(options.title || '')}`
      : DEFAULT_OG_IMAGE)

    useSeoMeta({
      title: fullTitle,
      description: options.description,

      // Open Graph
      ogTitle: fullTitle,
      ogDescription: options.description,
      ogImage: dynamicOgImage,
      ogUrl: canonicalUrl,
      ogSiteName: SITE_NAME,
      ogType: options.type || 'website',
      ogLocale: 'ko_KR',

      // OG Image dimensions
      ogImageWidth: 1200,
      ogImageHeight: 630,

      // Twitter Card
      twitterCard: 'summary_large_image',
      twitterTitle: fullTitle,
      twitterDescription: options.description,
      twitterImage: dynamicOgImage,
    })

    // Canonical URL (key로 중복 방지 - 페이지에서 별도 canonical 설정 시 덮어씀)
    useHead({
      link: [
        { rel: 'canonical', href: canonicalUrl, key: 'canonical' },
      ],
    })
  }

  /**
   * 홈페이지 메타태그
   */
  function setHomeMeta() {
    setMeta({
      title: '부동산 실거래가·내 주변 생활시설 검색 - 일상킷',
      description: '아파트·빌라·오피스텔 실거래가 조회와 학교, 어린이집, 공원 등 생활시설을 한번에 검색. 시세 조회부터 주변 시설 정보까지 한곳에서 확인하세요.',
      path: '/',
    })
  }

  /**
   * 카테고리 페이지 메타태그
   */
  function setCategoryMeta(category: FacilityCategory) {
    const categoryName = CATEGORY_META[category]?.label || category
    const cta = CATEGORY_CTA[category]

    const title = `${categoryName} 위치 및 운영시간 - 일상킷`
    const description = `${cta}. 전국 ${categoryName} 정보를 한 번에 검색하세요.`

    setMeta({
      title,
      description,
      path: `/${category}`,
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
      : '부동산·생활시설 검색'

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
   * 카테고리별 상세 타이틀 — 검색 의도 키워드를 전면 배치해 CTR 최적화
   * {name} + 의도 키워드 + {loc} + {categoryName} 구조
   */
  function buildDetailTitle(facility: FacilityDetail): string {
    const loc = facility.district || facility.city
    const name = facility.name

    switch (facility.category) {
      case 'toilet':
        return `${name} 위치·개방시간 · ${loc} 공공화장실`
      case 'parking':
        return `${name} 주차요금·운영시간 · ${loc} 공영주차장`
      case 'ev-charger':
        return `${name} 실시간 충전 상태 · ${loc} 전기차 충전소`
      case 'park':
        return `${name} 운동시설·산책로 · ${loc} 공원`
      case 'school':
        return `${name} 학교 정보·설립유형 · ${loc} 초·중·고`
      case 'childcare':
        return `${name} 정원·현원·빈자리 · ${loc} 어린이집`
      case 'library':
        return `${name} 운영시간·휴관일 · ${loc} 도서관`
      case 'hospital':
        return `${name} 진료시간·진료과 · ${loc} 병원`
      case 'pharmacy':
        return `${name} 영업시간·야간운영 · ${loc} 약국`
      case 'aed':
        return `${name} 설치 위치 · ${loc} AED 자동심장충격기`
      case 'sports':
        return `${name} 시설 정보·규모 · ${loc} 공공체육시설`
      case 'market':
        return `${name} 장날·상점 정보 · ${loc} 전통시장`
      case 'clothes':
        return `${name} 위치 · ${loc} 의류수거함 배출 안내`
      case 'wifi':
        return `${name} · ${loc} 공공 와이파이`
      default: {
        const categoryName = CATEGORY_META[facility.category]?.label || facility.category
        return `${name} - ${loc} ${categoryName}`
      }
    }
  }

  /**
   * 시설 상세 페이지 메타태그
   */
  function setFacilityDetailMeta(facility: FacilityDetail) {
    const title = buildDetailTitle(facility)
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
    const region = schedule.targetRegion?.replaceAll('+', ', ')
    const description = region
      ? `${location} ${region} 지역의 쓰레기 배출 요일, 시간, 방법을 확인하세요.`
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
    setCategoryMeta,
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
