// @TASK T5.3 - JSON-LD 구조화된 데이터
import type { FacilityDetail, FacilityCategory } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'
import { SITE_NAME, SITE_URL } from '~/utils/seoConstants'

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
      description: '내 주변 생활 편의 정보, 한 번에 찾기. 공공시설과 생활 편의 정보를 통합 검색합니다.',
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
      parking: 'ParkingFacility',
      aed: 'EmergencyService',
      library: 'Library',
      hospital: 'Hospital',
      pharmacy: 'Pharmacy',
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

    // 카테고리별 상세 필드 추가
    const d = facility.details as Record<string, unknown>

    // 운영시간
    if (d?.operatingHours) {
      Object.assign(schema, { openingHours: d.operatingHours })
    }

    // 전화번호
    const phone = d?.phone || d?.phoneNumber || d?.clerkTel
    if (phone) {
      Object.assign(schema, { telephone: phone })
    }

    // 카테고리별 추가 필드
    switch (facility.category) {
      case 'toilet': {
        const amenities: Array<{ '@type': string; name: string; value: boolean }> = []
        if (d?.hasDisabledToilet) amenities.push({ '@type': 'LocationFeatureSpecification', name: '장애인 화장실', value: true })
        if (d?.hasDiaperChangingTable) amenities.push({ '@type': 'LocationFeatureSpecification', name: '기저귀 교환대', value: true })
        if (d?.hasEmergencyBell) amenities.push({ '@type': 'LocationFeatureSpecification', name: '비상벨', value: true })
        if (amenities.length) Object.assign(schema, { amenityFeature: amenities })
        break
      }
      case 'kiosk': {
        const amenities: Array<{ '@type': string; name: string; value: boolean }> = []
        if (d?.voiceGuide) amenities.push({ '@type': 'LocationFeatureSpecification', name: '음성안내', value: true })
        if (d?.brailleOutput) amenities.push({ '@type': 'LocationFeatureSpecification', name: '점자출력', value: true })
        if (d?.wheelchairAccessible) amenities.push({ '@type': 'LocationFeatureSpecification', name: '휠체어 접근 가능', value: true })
        if (amenities.length) Object.assign(schema, { amenityFeature: amenities })
        if (d?.weekdayOperatingHours) Object.assign(schema, { openingHours: d.weekdayOperatingHours })
        break
      }
      case 'parking': {
        if (d?.capacity) Object.assign(schema, { totalNumberOfParkingSpaces: d.capacity })
        break
      }
      case 'library': {
        if (d?.weekdayOpenTime && d?.weekdayCloseTime) {
          Object.assign(schema, { openingHours: `Mo-Fr ${d.weekdayOpenTime}-${d.weekdayCloseTime}` })
        }
        break
      }
      case 'pharmacy': {
        const specs: Array<{ '@type': string; dayOfWeek: string; opens: string; closes: string }> = []
        const dayMap: Array<[string, string, string]> = [
          ['Monday', 'dutyTime1s', 'dutyTime1c'],
          ['Tuesday', 'dutyTime2s', 'dutyTime2c'],
          ['Wednesday', 'dutyTime3s', 'dutyTime3c'],
          ['Thursday', 'dutyTime4s', 'dutyTime4c'],
          ['Friday', 'dutyTime5s', 'dutyTime5c'],
          ['Saturday', 'dutyTime6s', 'dutyTime6c'],
          ['Sunday', 'dutyTime7s', 'dutyTime7c'],
        ]
        for (const [day, sKey, cKey] of dayMap) {
          if (d?.[sKey] && d?.[cKey]) {
            specs.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: day, opens: String(d[sKey]), closes: String(d[cKey]) })
          }
        }
        if (specs.length) Object.assign(schema, { openingHoursSpecification: specs })
        break
      }
      case 'aed': {
        const specs: Array<{ '@type': string; dayOfWeek: string; opens: string; closes: string }> = []
        const aedDays: Array<[string, string, string]> = [
          ['Monday', 'monSttTme', 'monEndTme'],
          ['Tuesday', 'tueSttTme', 'tueEndTme'],
          ['Wednesday', 'wedSttTme', 'wedEndTme'],
          ['Thursday', 'thuSttTme', 'thuEndTme'],
          ['Friday', 'friSttTme', 'friEndTme'],
          ['Saturday', 'satSttTme', 'satEndTme'],
          ['Sunday', 'sunSttTme', 'sunEndTme'],
        ]
        for (const [day, sKey, cKey] of aedDays) {
          if (d?.[sKey] && d?.[cKey]) {
            specs.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: day, opens: String(d[sKey]), closes: String(d[cKey]) })
          }
        }
        if (specs.length) Object.assign(schema, { openingHoursSpecification: specs })
        break
      }
      case 'hospital': {
        if (d?.clCdNm) Object.assign(schema, { medicalSpecialty: d.clCdNm })
        break
      }
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
      logo: `${SITE_URL}/icons/logo.webp`,
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
