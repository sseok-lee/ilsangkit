// @TASK T5.3 - JSON-LD 구조화된 데이터
import type { FacilityDetail, FacilityCategory } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'

const SITE_NAME = '일상킷'
const SITE_URL = 'https://ilsangkit.co.kr'

/**
 * BreadcrumbList 스키마
 */
interface BreadcrumbItem {
  name: string
  url: string
}

/**
 * 구조화된 데이터 composable
 */
export function useStructuredData() {
  /**
   * WebSite 스키마 (홈페이지용)
   */
  function setWebsiteSchema() {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      description: '내 주변 생활 편의 정보, 한 번에 찾기. 위치 기반으로 공공화장실, 쓰레기 배출, 무료 와이파이 정보를 통합 검색합니다.',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/search?keyword={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    }

    useHead({
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify(schema),
        },
      ],
    })
  }

  /**
   * BreadcrumbList 스키마
   */
  function setBreadcrumbSchema(items: BreadcrumbItem[]) {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
      })),
    }

    useHead({
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify(schema),
        },
      ],
    })
  }

  /**
   * LocalBusiness/Place 스키마 (시설 상세용)
   */
  function setFacilitySchema(facility: FacilityDetail) {
    const categoryName = CATEGORY_META[facility.category]?.label || facility.category

    // 시설 유형에 따른 @type 결정
    const typeMap: Record<FacilityCategory, string> = {
      toilet: 'PublicToilet',
      trash: 'CivicStructure',
      wifi: 'LocalBusiness',
      clothes: 'RecyclingCenter',
      kiosk: 'GovernmentOffice',
    }

    const schema = {
      '@context': 'https://schema.org',
      '@type': typeMap[facility.category] || 'Place',
      name: facility.name,
      description: `${facility.city} ${facility.district}에 위치한 ${categoryName}`,
      address: {
        '@type': 'PostalAddress',
        streetAddress: facility.roadAddress || facility.address,
        addressLocality: facility.district,
        addressRegion: facility.city,
        addressCountry: 'KR',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: facility.lat,
        longitude: facility.lng,
      },
      url: `${SITE_URL}/${facility.category}/${facility.id}`,
      isAccessibleForFree: true,
    }

    // 운영시간 추가 (있는 경우)
    if (facility.details?.operatingHours) {
      Object.assign(schema, {
        openingHours: facility.details.operatingHours,
      })
    }

    useHead({
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify(schema),
        },
      ],
    })
  }

  /**
   * ItemList 스키마 (검색 결과/목록용)
   */
  function setItemListSchema(items: Array<{ name: string; url: string; position?: number }>) {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: item.position || index + 1,
        name: item.name,
        url: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
      })),
    }

    useHead({
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify(schema),
        },
      ],
    })
  }

  /**
   * Organization 스키마 (사이트 전체)
   */
  function setOrganizationSchema() {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      sameAs: [
        // 소셜 미디어 링크 추가 가능
      ],
    }

    useHead({
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify(schema),
        },
      ],
    })
  }

  /**
   * GovernmentService 스키마 (쓰레기 배출 상세용)
   */
  function setWasteScheduleSchema(schedule: {
    id: number
    city: string
    district: string
    targetRegion?: string | null
    details?: { manageDepartment?: string; managePhone?: string } | null
  }) {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'GovernmentService',
      name: `${schedule.city} ${schedule.district} 쓰레기 배출 안내`,
      description: `${schedule.city} ${schedule.district} 지역 쓰레기 배출 일정 및 방법`,
      serviceType: '쓰레기 배출 안내',
      areaServed: {
        '@type': 'AdministrativeArea',
        name: `${schedule.city} ${schedule.district}`,
      },
      url: `${SITE_URL}/trash/${schedule.id}`,
    }

    useHead({
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify(schema),
        },
      ],
    })
  }

  return {
    setWebsiteSchema,
    setBreadcrumbSchema,
    setFacilitySchema,
    setItemListSchema,
    setOrganizationSchema,
    setWasteScheduleSchema,
  }
}
