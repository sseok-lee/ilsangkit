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

type OpeningHoursSpec = { '@type': string; dayOfWeek: string; opens: string; closes: string }

/**
 * dutyTime 패턴(Monday~Sunday)으로 OpeningHoursSpecification 배열 생성
 * pharmacy와 hospital이 공유하는 헬퍼
 */
function buildOpeningHoursSpecs(d: Record<string, unknown>): OpeningHoursSpec[] {
  const specs: OpeningHoursSpec[] = []
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
  return specs
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
      alternateName: 'ilsangkit',
      url: SITE_URL,
      description: '아파트·빌라·오피스텔 실거래가 조회부터 내 주변 병원·약국·주차장까지, 생활 정보를 한곳에서 확인하세요.',
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
  function setFacilitySchema(facility: FacilityDetail, rating?: { ratingValue: number; reviewCount: number }) {
    const categoryName = CATEGORY_META[facility.category]?.label || facility.category

    // 시설 유형에 따른 @type 결정
    const typeMap: Record<FacilityCategory, string> = {
      toilet: 'PublicToilet',
      trash: 'CivicStructure',
      wifi: 'LocalBusiness',
      clothes: 'RecyclingCenter',
      parking: 'ParkingFacility',
      aed: 'EmergencyService',
      library: 'Library',
      hospital: 'Hospital',
      pharmacy: 'Pharmacy',
      park: 'Park',
      school: 'School',
      market: 'LocalBusiness',
      childcare: 'ChildCare',
      'ev-charger': 'LocalBusiness',
      sports: 'SportsActivityLocation',
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
        const specs = buildOpeningHoursSpecs(d)
        if (specs.length) Object.assign(schema, { openingHoursSpecification: specs })
        break
      }
      case 'aed': {
        const specs: OpeningHoursSpec[] = []
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
        const specs = buildOpeningHoursSpecs(d)
        if (specs.length) Object.assign(schema, { openingHoursSpecification: specs })
        break
      }
    }

    if (rating && rating.reviewCount > 0) {
      Object.assign(schema, {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: rating.ratingValue,
          reviewCount: rating.reviewCount,
          bestRating: 5,
          worstRating: 1,
        },
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
      logo: `${SITE_URL}/icons/logo.webp`,
      description: '부동산 실거래가와 전국 생활시설 정보를 한곳에서 제공하는 생활 정보 서비스. 아파트·빌라·오피스텔 시세 조회와 학교·어린이집·공원 등 생활시설을 통합 검색합니다.',
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: 'contact@ilsangkit.co.kr',
        availableLanguage: 'Korean',
      },
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



  /**
   * Place 스키마 (부동산 건물 상세용)
   */
  function setBuildingPlaceSchema(options: {
    name: string
    address: string
    lat: number
    lng: number
    buildYear?: number | null
    propertyType: string
  }) {
    useHead({
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: options.name,
            address: {
              '@type': 'PostalAddress',
              streetAddress: options.address,
            },
            geo: {
              '@type': 'GeoCoordinates',
              latitude: options.lat,
              longitude: options.lng,
            },
            additionalProperty: [
              {
                '@type': 'PropertyValue',
                name: 'propertyType',
                value: options.propertyType,
              },
              ...(options.buildYear
                ? [{
                    '@type': 'PropertyValue',
                    name: 'buildYear',
                    value: String(options.buildYear),
                  }]
                : []),
            ],
          }),
        },
      ],
    })
  }

  /**
   * Place 스키마 (지역 리포트용)
   */
  function setAreaReportSchema(options: {
    city: string
    district: string
    facilityTotal: number
    topCategories: string[]
  }) {
    useHead({
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: `${options.city} ${options.district}`,
            address: {
              '@type': 'PostalAddress',
              addressLocality: options.district,
              addressRegion: options.city,
              addressCountry: 'KR',
            },
            additionalProperty: [
              {
                '@type': 'PropertyValue',
                name: 'publicFacilityCount',
                value: String(options.facilityTotal),
              },
              {
                '@type': 'PropertyValue',
                name: 'topFacilityCategories',
                value: options.topCategories.join(', '),
              },
            ],
          }),
        },
      ],
    })
  }


  /**
   * FAQPage 스키마 (가이드 howto/guide 유형용)
   */
  function setFAQSchema(faqs: Array<{ question: string; answer: string }>) {
    if (faqs.length === 0) return

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
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
   * HowTo 스키마 (가이드 howto 유형용)
   */
  function setHowToSchema(options: {
    name: string
    description: string
    steps: Array<{ name: string; text: string }>
    url: string
  }) {
    if (options.steps.length === 0) return

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: options.name,
      description: options.description,
      url: options.url.startsWith('http') ? options.url : `${SITE_URL}${options.url}`,
      step: options.steps.map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: step.name,
        text: step.text,
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

  return {
    setWebsiteSchema,
    setBreadcrumbSchema,
    setFacilitySchema,
    setItemListSchema,
    setOrganizationSchema,
    setWasteScheduleSchema,
    setBuildingPlaceSchema,
    setAreaReportSchema,
    setFAQSchema,
    setHowToSchema,
  }
}
