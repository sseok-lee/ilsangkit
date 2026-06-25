import type { FacilityDetail, FacilityCategory } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'
import { SITE_NAME, SITE_URL, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { resolveDataSource, ensureDatasetDescription, type DataSourceDomain, type DataSourceInfo } from '~/utils/dataSource'
import { formatKstDate } from '~/utils/formatters'

/**
 * BreadcrumbList 스키마
 */
interface BreadcrumbItem {
  name: string
  url: string
}

type OpeningHoursSpec = { '@type': string; dayOfWeek: string; opens: string; closes: string }

/** "900" / "0900" → "09:00" (schema.org HH:MM 형식) */
function formatTime(t: string): string {
  const s = String(t).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)}`
}

/**
 * dutyTime 패턴(Monday~Sunday)으로 OpeningHoursSpecification 배열 생성
 * pharmacy와 hospital이 공유하는 헬퍼
 */
function buildOpeningHoursSpecs(d: Record<string, unknown>, fieldMap?: Array<[string, string, string]>): OpeningHoursSpec[] {
  const specs: OpeningHoursSpec[] = []
  const dayMap = fieldMap ?? [
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
      specs.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: day, opens: formatTime(String(d[sKey])), closes: formatTime(String(d[cKey])) })
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
      description: '아파트·빌라·오피스텔·토지 실거래가와 청약 정보, 내 주변 병원·약국·주차장 등 생활시설을 한곳에서 확인하세요.',
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
          key: 'jsonld-website',
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
          key: 'jsonld-breadcrumb',
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
      toilet: 'CivicStructure',
      trash: 'CivicStructure',
      wifi: 'LocalBusiness',
      clothes: 'CivicStructure',
      parking: 'CivicStructure',
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
      subway: 'TrainStation',
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
      ...(facility.lat && facility.lng
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: facility.lat,
              longitude: facility.lng,
            },
          }
        : {}),
      url: `${SITE_URL}/${facility.category}/${facility.id}`,
      isAccessibleForFree: true,
    }

    // 카테고리별 상세 필드 추가
    const d = facility.details as Record<string, unknown>

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
          const normalizeTime = (v: unknown): string => {
            const s = String(v)
            return s.includes(':') ? s : formatTime(s)
          }
          const openStr = normalizeTime(d.weekdayOpenTime)
          const closeStr = normalizeTime(d.weekdayCloseTime)
          Object.assign(schema, { openingHours: `Mo-Fr ${openStr}-${closeStr}` })
        }
        break
      }
      case 'pharmacy': {
        const specs = buildOpeningHoursSpecs(d)
        if (specs.length) Object.assign(schema, { openingHoursSpecification: specs })
        break
      }
      case 'aed': {
        const aedDays: Array<[string, string, string]> = [
          ['Monday', 'monSttTme', 'monEndTme'],
          ['Tuesday', 'tueSttTme', 'tueEndTme'],
          ['Wednesday', 'wedSttTme', 'wedEndTme'],
          ['Thursday', 'thuSttTme', 'thuEndTme'],
          ['Friday', 'friSttTme', 'friEndTme'],
          ['Saturday', 'satSttTme', 'satEndTme'],
          ['Sunday', 'sunSttTme', 'sunEndTme'],
        ]
        const specs = buildOpeningHoursSpecs(d, aedDays)
        if (specs.length) Object.assign(schema, { openingHoursSpecification: specs })
        break
      }
      case 'hospital': {
        if (d?.clCdNm) Object.assign(schema, { medicalSpecialty: d.clCdNm })
        const hospitalDayMap: Array<[string, string, string]> = [
          ['Monday', 'trmtMonStart', 'trmtMonEnd'],
          ['Tuesday', 'trmtTueStart', 'trmtTueEnd'],
          ['Wednesday', 'trmtWedStart', 'trmtWedEnd'],
          ['Thursday', 'trmtThuStart', 'trmtThuEnd'],
          ['Friday', 'trmtFriStart', 'trmtFriEnd'],
          ['Saturday', 'trmtSatStart', 'trmtSatEnd'],
          ['Sunday', 'trmtSunStart', 'trmtSunEnd'],
        ]
        const specs = buildOpeningHoursSpecs(d, hospitalDayMap)
        if (specs.length) Object.assign(schema, { openingHoursSpecification: specs })
        break
      }
    }

    useHead({
      script: [
        {
          key: 'jsonld-facility',
          type: 'application/ld+json',
          innerHTML: JSON.stringify(schema),
        },
      ],
    })
  }

  /**
   * ItemList 스키마 (검색 결과/목록용)
   *
   * 확장된 ItemListItem 타입:
   *  - type/address 를 전달하면 nested item 객체(Apartment, Place 등)로 풍부하게 생성
   *  - 미전달 시 기존 방식(ListItem with name/url at top level) 유지 — backward compat
   */
  type ItemListItem = {
    name: string
    url: string
    position?: number
    type?: 'Apartment' | 'Place'
    address?: {
      addressLocality?: string
      addressRegion?: string
      addressCountry?: string
    }
  }

  function setItemListSchema(
    items: ItemListItem[],
    options?: { name?: string; description?: string; key?: string },
  ) {
    const resolveUrl = (url: string) =>
      url.startsWith('http') ? url : `${SITE_URL}${url}`

    const schema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      ...(options?.name ? { name: options.name } : {}),
      ...(options?.description ? { description: options.description } : {}),
      itemListElement: items.map((item, index) => {
        const base = {
          '@type': 'ListItem',
          position: item.position ?? index + 1,
        }
        if (item.type || item.address) {
          return {
            ...base,
            item: {
              '@type': item.type ?? 'Place',
              name: item.name,
              url: resolveUrl(item.url),
              ...(item.address
                ? {
                    address: {
                      '@type': 'PostalAddress',
                      addressCountry: 'KR',
                      ...item.address,
                    },
                  }
                : {}),
            },
          }
        }
        return { ...base, name: item.name, url: resolveUrl(item.url) }
      }),
    }

    useHead({
      script: [
        {
          key: options?.key ?? 'jsonld-itemlist',
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
      description: '부동산 실거래가와 청약 정보, 전국 생활시설을 한곳에서 제공하는 생활 정보 서비스. 아파트·빌라·오피스텔·토지 실거래가 조회와 청약 일정 확인, 학교·어린이집·공원 등 생활시설 통합 검색을 지원합니다.',
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: 'contact@ilsangkit.co.kr',
        availableLanguage: 'Korean',
      },
    }

    useHead({
      script: [
        {
          key: 'jsonld-organization',
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
          key: 'jsonld-waste',
          type: 'application/ld+json',
          innerHTML: JSON.stringify(schema),
        },
      ],
    })
  }

  /**
   * Place 스키마 (부동산 건물 상세용).
   * SSR-safe: 호출부는 `() => options` 형태의 getter 를 전달해 reactive 의존성을 유지한다.
   * 옵션 오브젝트를 직접 전달해도 동작하지만 이 경우 값이 고정된다 (비반응형).
   */
  type BuildingPlaceOptions = {
    name: string
    address: string
    city?: string
    district?: string
    lat?: number | null
    lng?: number | null
    buildYear?: number | null
    propertyType: string
    propertySlug?: 'apt' | 'villa' | 'offitel'
    image?: string
  }

  function resolveBuildingSchemaType(slug?: string): string {
    if (slug === 'apt') return 'ApartmentComplex'
    if (slug === 'offitel') return 'Apartment'
    return 'Residence'
  }

  function setBuildingPlaceSchema(
    input: BuildingPlaceOptions | (() => BuildingPlaceOptions),
  ) {
    const resolve = (): BuildingPlaceOptions => (typeof input === 'function' ? input() : input)
    useHead(() => {
      const options = resolve()
      const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': resolveBuildingSchemaType(options.propertySlug),
        name: options.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: options.address,
          ...(options.district ? { addressLocality: options.district } : {}),
          ...(options.city ? { addressRegion: options.city } : {}),
          addressCountry: 'KR',
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
      }
      if (options.lat != null && options.lng != null) {
        schema.geo = {
          '@type': 'GeoCoordinates',
          latitude: options.lat,
          longitude: options.lng,
        }
      }
      if (options.image) schema.image = options.image
      return {
        script: [
          {
            key: 'jsonld-building',
            type: 'application/ld+json',
            innerHTML: JSON.stringify(schema),
          },
        ],
      }
    })
  }

  /**
   * RealEstateListing 스키마 (부동산 거래 실거래가 상세용).
   * url 은 호출부가 SSR-safe canonical URL 을 전달해야 하며, 더 이상 window.location.href 에 의존하지 않는다.
   * 호출부는 `() => options` getter 를 전달해 reactive 의존성을 유지한다.
   */
  type RealEstateListingOptions = {
    name: string
    address: string
    city: string
    district: string
    propertyType: string
    url: string
    buildYear?: number | null
    totalCount?: number
    lat?: number | null
    lng?: number | null
    image?: string
    recentAvg?: number
    latestDealDate?: string
  }

  function setRealEstateListingSchema(
    input: RealEstateListingOptions | (() => RealEstateListingOptions),
  ) {
    const resolve = (): RealEstateListingOptions => (typeof input === 'function' ? input() : input)
    useHead(() => {
      const options = resolve()
      const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        name: options.name,
        description: `${options.city} ${options.district} ${options.name} 실거래가 정보`,
        url: options.url,
        address: {
          '@type': 'PostalAddress',
          streetAddress: options.address,
          addressLocality: options.district,
          addressRegion: options.city,
          addressCountry: 'KR',
        },
        additionalProperty: [
          { '@type': 'PropertyValue', name: 'propertyType', value: options.propertyType },
          ...(options.buildYear ? [{ '@type': 'PropertyValue', name: 'yearBuilt', value: String(options.buildYear) }] : []),
          ...(options.totalCount ? [{ '@type': 'PropertyValue', name: 'numberOfTransactions', value: String(options.totalCount) }] : []),
        ],
      }
      if (options.lat != null && options.lng != null) {
        schema.geo = {
          '@type': 'GeoCoordinates',
          latitude: options.lat,
          longitude: options.lng,
        }
      }
      schema.mainEntityOfPage = options.url
      if (options.image) schema.image = options.image
      if (options.recentAvg != null) {
        ;(schema.additionalProperty as unknown[]).push({ '@type': 'PropertyValue', name: 'recentAveragePrice', value: String(options.recentAvg) })
      }
      if (options.latestDealDate) schema.datePosted = options.latestDealDate
      return {
        script: [
          {
            key: 'jsonld-realestate-listing',
            type: 'application/ld+json',
            innerHTML: JSON.stringify(schema),
          },
        ],
      }
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
    // 시 단위 페이지(/[city])는 district 가 빈 문자열로 들어와 trailing space 와
    // 빈 addressLocality 를 출력하던 문제가 있었다. 빈 값은 필드 자체에서 제외한다.
    const hasDistrict = !!options.district
    const placeName = hasDistrict ? `${options.city} ${options.district}` : options.city
    const address: Record<string, unknown> = {
      '@type': 'PostalAddress',
      addressRegion: options.city,
      addressCountry: 'KR',
    }
    if (hasDistrict) {
      address.addressLocality = options.district
    }
    const additionalProperty: Array<Record<string, unknown>> = [
      {
        '@type': 'PropertyValue',
        name: 'publicFacilityCount',
        value: String(options.facilityTotal),
      },
    ]
    if (options.topCategories.length > 0) {
      additionalProperty.push({
        '@type': 'PropertyValue',
        name: 'topFacilityCategories',
        value: options.topCategories.join(', '),
      })
    }

    useHead({
      script: [
        {
          key: 'jsonld-area-report',
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: placeName,
            address,
            additionalProperty,
          }),
        },
      ],
    })
  }

  /**
   * Article 스키마 (가이드 상세용)
   */
  function setArticleSchema(options: {
    headline: string
    description: string
    datePublished: string
    dateModified?: string
    url: string
    image?: string
  }) {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: options.headline,
      description: options.description,
      datePublished: options.datePublished,
      ...(options.dateModified ? { dateModified: options.dateModified } : {}),
      url: options.url.startsWith('http') ? options.url : `${SITE_URL}${options.url}`,
      image: options.image ?? DEFAULT_OG_IMAGE,
      author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/logo.webp` },
      },
    }
    useHead({
      script: [{ key: 'jsonld-article', type: 'application/ld+json', innerHTML: JSON.stringify(schema) }],
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
          key: 'jsonld-faq',
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
          key: 'jsonld-howto',
          type: 'application/ld+json',
          innerHTML: JSON.stringify(schema),
        },
      ],
    })
  }

  /**
   * Event 스키마 (청약 상세용)
   *
   * Google Event 가이드: eventStatus 와 eventAttendanceMode 는 2021 년부터 필수.
   * 누락 시 리치결과 자격 박탈. 청약 접수는 온라인 신청(청약홈) 이 표준이라
   * OnlineEventAttendanceMode 를 기본값으로 사용한다.
   */
  function setEventSchema(options: {
    name: string
    description: string
    startDate: string
    endDate: string
    location?: string
    url: string
    eventStatus?: 'EventScheduled' | 'EventCancelled' | 'EventPostponed' | 'EventRescheduled' | 'EventMovedOnline'
    eventAttendanceMode?: 'OnlineEventAttendanceMode' | 'OfflineEventAttendanceMode' | 'MixedEventAttendanceMode'
  }) {
    const eventStatus = options.eventStatus ?? 'EventScheduled'
    const eventAttendanceMode = options.eventAttendanceMode ?? 'OnlineEventAttendanceMode'
    const fullUrl = options.url.startsWith('http') ? options.url : `${SITE_URL}${options.url}`

    // Google 가이드: OnlineEventAttendanceMode 면 VirtualLocation + url 이 필수,
    // OfflineEventAttendanceMode 면 Place + 주소/이름이 필수.
    // 청약처럼 온라인 접수가 표준인 이벤트는 옵션의 location 을 부동산 소재지 라벨로 보고,
    // VirtualLocation 의 url 은 이벤트 페이지 자체로 안내한다.
    let location: Record<string, unknown> | Array<Record<string, unknown>> | undefined
    if (eventAttendanceMode === 'OnlineEventAttendanceMode') {
      location = { '@type': 'VirtualLocation', url: fullUrl }
    } else if (eventAttendanceMode === 'MixedEventAttendanceMode') {
      location = [
        { '@type': 'VirtualLocation', url: fullUrl },
        ...(options.location ? [{ '@type': 'Place', name: options.location }] : []),
      ]
    } else if (options.location) {
      location = { '@type': 'Place', name: options.location }
    }

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: options.name,
      description: options.description,
      startDate: options.startDate,
      endDate: options.endDate,
      eventStatus: `https://schema.org/${eventStatus}`,
      eventAttendanceMode: `https://schema.org/${eventAttendanceMode}`,
      ...(location ? { location } : {}),
      url: fullUrl,
    }

    useHead({
      script: [
        {
          key: 'jsonld-event',
          type: 'application/ld+json',
          innerHTML: JSON.stringify(schema),
        },
      ],
    })
  }

  /**
   * VideoObject ItemList 스키마 (시설 YouTube 영상 캐시 히트용)
   */
  function setVideoListSchema(videos: { videoId: string; title: string; channelTitle: string; thumbnail: string; publishedAt: string }[]) {
    if (!videos.length) return
    const itemListElement = videos.slice(0, 6).map((v, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'VideoObject',
        name: v.title,
        description: `${v.channelTitle} 채널 영상`,
        thumbnailUrl: v.thumbnail,
        uploadDate: v.publishedAt,
        embedUrl: `https://www.youtube-nocookie.com/embed/${v.videoId}`,
        contentUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
      },
    }))
    useHead({
      script: [{
        key: 'jsonld-videolist',
        type: 'application/ld+json',
        innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement }),
      }],
    })
  }

  /**
   * Dataset 스키마 — 공공데이터 출처를 명시해 AI 검색(GEO) 인용성 강화
   *
   * 일상킷은 공공데이터를 가공해서 제공하는 서비스이므로,
   * 각 페이지가 사용하는 원천 데이터셋과 제공기관을 schema.org Dataset으로 노출.
   * KOGL 유형이 지정된 경우 distribution.license에 KOGL 라이선스 URL을 포함.
   */
  function setDatasetSchema(options: {
    name: string
    description: string
    url: string
    sources: DataSourceInfo[]
    keywords?: string[]
    spatialCoverage?: string
    dateModified?: string
    datePublished?: string
    isBasedOn?: string
    sourceOrganization?: { '@type': 'Organization'; name: string }
    citation?: { '@type': 'CreativeWork'; name: string; url: string }
  }) {
    const { name, description, url, sources, keywords, spatialCoverage,
      dateModified, datePublished, isBasedOn, sourceOrganization, citation } = options
    const koglLicenseUrl = (kogl?: 1 | 2 | 3 | 4) =>
      kogl ? `https://www.kogl.or.kr/info/licenseType0${kogl}.do` : 'https://www.kogl.or.kr/info/license.do'

    const schema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name,
      description,
      url: url.startsWith('http') ? url : `${SITE_URL}${url}`,
      isAccessibleForFree: true,
      inLanguage: 'ko',
      spatialCoverage: {
        '@type': 'Place',
        name: spatialCoverage ?? '대한민국',
      },
      creator: sources.map((s) => ({
        '@type': 'Organization',
        name: s.provider,
        url: s.url,
      })),
      distribution: sources.map((s) => ({
        '@type': 'DataDownload',
        name: s.datasetName,
        contentUrl: s.url,
        ...(s.kogl ? { license: koglLicenseUrl(s.kogl) } : {}),
      })),
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
      },
      ...(dateModified ? { dateModified } : {}),
      ...(datePublished ? { datePublished } : {}),
      ...(isBasedOn ? { isBasedOn } : {}),
      ...(sourceOrganization ? { sourceOrganization } : {}),
      ...(citation ? { citation } : {}),
    }
    if (keywords && keywords.length > 0) {
      schema.keywords = keywords.join(',')
    }

    useHead({
      script: [
        {
          key: 'jsonld-dataset',
          type: 'application/ld+json',
          innerHTML: JSON.stringify(schema),
        },
      ],
    })
  }

  /**
   * 상세 페이지 출처 Dataset (provenance) 일괄 출력 헬퍼.
   * 엔티티 스키마(Place/Event 등)는 페이지가 따로 출력하고, 여기서는
   * 이 페이지가 가공한 "원본 공공데이터셋"을 별도 Dataset 노드로 선언한다.
   * noindex 페이지/출처 미상이면 아무것도 출력하지 않는다.
   */
  function setDetailProvenance(opts: {
    domain: DataSourceDomain
    category?: FacilityCategory
    path: string
    description: string
    updatedAt?: string | null
    createdAt?: string | null
    noindex?: boolean
  }) {
    if (opts.noindex) return
    if (!opts.path) return        // no URL → no Dataset (prevents undefined.startsWith crash)
    const src = resolveDataSource({ domain: opts.domain, category: opts.category })
    if (!src) return
    setDatasetSchema({
      name: src.datasetName,
      description: ensureDatasetDescription(opts.description, src),
      url: opts.path,
      sources: [src],
      isBasedOn: src.url,
      sourceOrganization: { '@type': 'Organization', name: src.provider },
      // 출처 인용은 CreativeWork로 선언 — @type:Dataset이면 Google이 중첩 Dataset으로
      // 파싱해 description 누락 리치결과 오류가 발생(페이지당 Dataset은 메인 하나만 유지).
      citation: { '@type': 'CreativeWork', name: src.datasetName, url: src.url },
      ...(opts.updatedAt ? { dateModified: formatKstDate(opts.updatedAt) } : {}),
      ...(opts.createdAt ? { datePublished: formatKstDate(opts.createdAt) } : {}),
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
    setRealEstateListingSchema,
    setAreaReportSchema,
    setArticleSchema,
    setFAQSchema,
    setHowToSchema,
    setEventSchema,
    setDatasetSchema,
    setVideoListSchema,
    setDetailProvenance,
  }
}
