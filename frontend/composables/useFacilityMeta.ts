import type { FacilityCategory, FacilityDetail } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'

/**
 * 사이트 기본 정보
 */
const SITE_NAME = '일상킷'
const SITE_URL = 'https://ilsangkit.co.kr'
const SITE_DESCRIPTION = '내 주변 생활 편의 정보, 한 번에 찾기. 위치 기반으로 공공화장실, 쓰레기 배출, 무료 와이파이 정보를 통합 검색합니다.'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`

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
 * 공통 메타태그 설정
 */
export function useFacilityMeta() {
  /**
   * 기본 메타태그 설정
   */
  function setMeta(options: MetaOptions) {
    const fullTitle = options.title === SITE_NAME
      ? SITE_NAME
      : `${options.title} - ${SITE_NAME}`

    const canonicalUrl = options.path ? `${SITE_URL}${options.path}` : SITE_URL

    useSeoMeta({
      // 기본 메타태그
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

    const title = facility.name
    const description = `${location}에 위치한 ${categoryName}입니다. ${facility.roadAddress || facility.address || ''}`

    setMeta({
      title,
      description,
      path: `/${facility.category}/${facility.id}`,
      type: 'article',
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
