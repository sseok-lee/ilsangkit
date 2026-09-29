const ok = data => ({ status: 200, body: { success: true, data } })
const missing = () => ({ status: 404, body: { success: false, error: 'Not found' } })

const city = '서울특별시'
const district = '강남구'
const secondCity = '경기'
const secondDistrict = '수원시'
const syncedAt = '2026-09-20T00:00:00.000Z'

const categoryLabels = {
  parking: '공영주차장',
  'ev-charger': '전기차충전소',
  subway: '지하철역',
  wifi: '무료와이파이',
  trash: '쓰레기배출',
  library: '공공도서관',
}

function facilityBase(category, id, name, index, overrides = {}) {
  return {
    id,
    category,
    name,
    address: `${city} ${district} 검증동 ${index}`,
    roadAddress: `${city} ${district} 검증로 ${index}`,
    lat: 37.5001 + index / 10000,
    lng: 127.0301 + index / 10000,
    city,
    district,
    extras: {},
    ...overrides,
  }
}

const parkingItems = Array.from({ length: 25 }, (_, index) => {
  const no = index + 1
  return facilityBase('parking', `parking-lifestyle-${no}`, `검증주차장${no}`, no, {
    extras: { capacity: 100 + no },
  })
})

const secondRegionParking = Array.from({ length: 3 }, (_, index) => {
  const no = index + 1
  return facilityBase('parking', `parking-suwon-${no}`, `수원검증주차장${no}`, no, {
    address: `${secondCity} ${secondDistrict} 검증동 ${no}`,
    roadAddress: `${secondCity} ${secondDistrict} 검증로 ${no}`,
    city: secondCity,
    district: secondDistrict,
    lat: 37.2636 + no / 10000,
    lng: 127.0286 + no / 10000,
    extras: { capacity: 80 + no },
  })
})

const evStations = [
  facilityBase('ev-charger', 'ev-lifestyle-1', '검증충전소A', 31, { extras: { statId: 'EV-A', totalChargers: 4 } }),
  facilityBase('ev-charger', 'ev-lifestyle-2', '검증충전소B', 32, { extras: { statId: 'EV-B', totalChargers: 4 } }),
]

const subwayItems = [
  facilityBase('subway', 'gangnam-lifestyle', '검증강남역', 41, {
    extras: { lines: ['2호선', '신분당선'], primaryLine: '2호선', operator: '서울교통공사' },
  }),
]

const wifiItems = [
  facilityBase('wifi', 'wifi-lifestyle-1', '검증와이파이존', 51, { extras: { accessPointCount: 3 } }),
]

const trashItems = [
  facilityBase('trash', '901', '검증1동 배출 일정', 61, { extras: { dayOfWeek: '월 · 수 · 금' } }),
]

const allGroups = [
  { category: 'parking', label: categoryLabels.parking, unit: '시설', count: parkingItems.length, items: parkingItems.slice(0, 3) },
  { category: 'ev-charger', label: categoryLabels['ev-charger'], unit: '충전소', count: evStations.length, items: evStations },
  { category: 'subway', label: categoryLabels.subway, unit: '역', count: subwayItems.length, items: subwayItems },
  { category: 'wifi', label: categoryLabels.wifi, unit: '장소', count: wifiItems.length, items: wifiItems },
  { category: 'trash', label: categoryLabels.trash, unit: '일정', count: trashItems.length, items: trashItems },
]

function pageOf(rows, q, limitFallback = 20) {
  const page = Math.max(1, Number(q.get('page') || 1))
  const limit = Math.max(1, Number(q.get('limit') || limitFallback))
  return {
    items: rows.slice((page - 1) * limit, page * limit),
    total: rows.length,
    page,
    totalPages: Math.max(1, Math.ceil(rows.length / limit)),
  }
}

function matchesRegion(q, row) {
  const citySlug = q.get('city') || ''
  const districtSlug = q.get('district') || ''
  if (!citySlug || !districtSlug) return false
  if (citySlug === 'seoul' && districtSlug === 'gangnam') return row.city === city && row.district === district
  if (citySlug === 'gyeonggi' && districtSlug === 'suwon') return row.city === secondCity && row.district === secondDistrict
  return false
}

function categoryRows(category, q) {
  if (category === 'parking') {
    return [...parkingItems, ...secondRegionParking].filter(row => matchesRegion(q, row))
  }
  if (category === 'ev-charger') return evStations.filter(row => matchesRegion(q, row))
  if (category === 'subway') return subwayItems.filter(row => matchesRegion(q, row))
  if (category === 'wifi') return wifiItems.filter(row => matchesRegion(q, row))
  if (category === 'trash') return trashItems.filter(row => matchesRegion(q, row))
  return []
}

function browseResult(q) {
  const category = q.get('category') || ''
  const keyword = (q.get('keyword') || '').trim()
  if (!category) {
    const groups = allGroups
      .map(group => {
        const rows = categoryRows(group.category, q)
          .filter(item => !keyword || [item.name, item.address, item.roadAddress].some(value => value?.includes(keyword)))
        return {
          ...group,
          count: rows.length,
          items: rows.slice(0, 3),
        }
      })
      .filter(group => group.count > 0)
    return { mode: 'grouped', groups }
  }
  const rows = categoryRows(category, q).filter(item => !keyword || [item.name, item.address, item.roadAddress].some(value => value?.includes(keyword)))
  const unit = category === 'ev-charger' ? '충전소' : category === 'subway' ? '역' : category === 'trash' ? '일정' : '시설'
  return { mode: 'list', category, unit, ...pageOf(rows, q) }
}

function detailFor(category, id) {
  const item = [...parkingItems, ...secondRegionParking, ...evStations, ...wifiItems].find(row => row.category === category && row.id === id)
  if (!item) return null
  const detail = {
    ...item,
    bjdCode: item.city === city ? '1168010100' : '4111110000',
    sourceId: 'remaining-lifestyle-fixture',
    sourceUrl: 'https://www.data.go.kr/',
    viewCount: 7,
    createdAt: syncedAt,
    updatedAt: syncedAt,
    syncedAt,
  }
  if (category === 'parking') {
    detail.details = {
      parkingType: '노외', lotType: '공영', capacity: item.extras.capacity,
      baseFee: 1200, baseTime: 30, additionalFee: 600, additionalTime: 10,
      dailyMaxFee: 12000, operatingHours: '평일 09:00~21:00', phone: '02-555-0121',
      paymentMethod: '카드', managingOrg: '강남구청', dataDate: '2026-09-20',
    }
  } else if (category === 'ev-charger') {
    detail.details = {
      statId: item.extras.statId, statNm: item.name, chgerType: '급속', addr: item.roadAddress,
      useTime: '24시간', busiNm: '검증에너지', totalChargers: item.extras.totalChargers,
      dataDate: '2026-09-20',
    }
  } else {
    detail.details = { dataDate: '2026-09-20' }
  }
  return detail
}

const station = {
  id: 'station-lifestyle-1',
  sourceId: 'subway-fixture',
  name: '검증강남',
  nameSlug: 'gangnam-lifestyle',
  line: '2호선',
  transferLines: ['신분당선'],
  operator: '서울교통공사',
  lat: 37.4979,
  lng: 127.0276,
  address: `${city} ${district} 역삼동`,
  roadAddress: `${city} ${district} 강남대로 396`,
  city,
  district,
  regionSlug: 'seoul/gangnam/subway',
  phoneNumber: '02-6110-2221',
  dataDate: '2026-09-20',
  updatedAt: syncedAt,
}

const schedules = Array.from({ length: 41 }, (_, index) => ({
  id: 901 + index,
  city,
  district,
  targetRegion: index === 20 ? '역삼검증21동' : `검증${index + 1}동`,
  emissionPlace: '문전 배출',
  sourceUrl: 'https://www.gangnam.go.kr/waste-fixture',
  govCode: '1168000000',
  sourceStatus: 'active',
  appliesTo: index === 0
    ? [{ areaId: 101, name: '검증1동', href: '/trash/areas/101', scope: 'whole', conditionText: '일반 월+수+금' }]
    : index === 1
      ? [{ areaId: 101, name: '검증1동', href: '/trash/areas/101', scope: 'conditional', conditionText: '음식물 화+목' }]
      : index === 20
        ? [{ areaId: 102, name: '검증2동', href: '/trash/areas/102', scope: 'conditional', conditionText: '역삼 조건부' }]
        : [],
  details: {
    emissionPlaceType: '문전',
    managementZone: `검증권역 ${index + 1}`,
    livingWaste: { dayOfWeek: '월+수+금', beginTime: '18:00', endTime: '22:00', method: '종량제 봉투 사용' },
    foodWaste: { dayOfWeek: '화+목', beginTime: '18:00', endTime: '22:00', method: '전용 용기 배출' },
    recyclable: { dayOfWeek: '수', beginTime: '18:00', endTime: '22:00', method: '품목별 분리 배출' },
    bulkWaste: { beginTime: '09:00', endTime: '18:00', method: '온라인 신고 후 배출', place: '지정 장소' },
    uncollectedDay: '일요일',
    manageDepartment: '강남구 청소행정과',
    managePhone: '02-3423-1234',
    dataCreatedDate: '2026-09-20',
    lastModified: syncedAt,
  },
}))

const wasteAreas = [
  {
    areaId: 101,
    name: '검증1동',
    city,
    district,
    href: '/trash/areas/101',
    matchReason: 'region',
    scheduleCount: 2,
    conditionalCount: 1,
    summary: '일반 월+수+금 18:00~22:00 · 음식물 화+목 18:00~22:00',
    dataDate: '2026-09-20T00:00:00.000Z',
  },
  {
    areaId: 102,
    name: '검증2동',
    city,
    district,
    href: '/trash/areas/102',
    matchReason: 'region',
    scheduleCount: 1,
    conditionalCount: 0,
    summary: '재활용 수 18:00~22:00',
    dataDate: '2026-09-20T00:00:00.000Z',
  },
]

function wasteScheduleRows(q) {
  return schedules.filter(row => {
    if (q.get('coverage') === 'unresolved' && row.id % 2 !== 1) return false
    if (q.get('city') && q.get('city') !== row.city) return false
    if (q.get('district') && q.get('district') !== row.district) return false
    const keyword = (q.get('keyword') || '').trim()
    if (keyword && !row.targetRegion.includes(keyword)) return false
    return true
  })
}

function wasteAreaList(q) {
  const keyword = (q.get('keyword') || '').trim()
  const rows = wasteAreas.filter(row => !keyword || row.name.includes(keyword))
  return {
    generationId: 'fixture-generation-id',
    ...pageOf(rows, q),
    unresolved: {
      count: 1,
      href: `/trash?coverage=unresolved&city=${encodeURIComponent(city)}&district=${encodeURIComponent(district)}`,
    },
  }
}

function handleAreaSummary(path) {
  const match = path.match(/^\/api\/area\/([^/]+)\/([^/]+)\/([^/]+)\/summary$/)
  if (!match) return null
  const [, citySlug, districtSlug, category] = match
  const q = new URLSearchParams({ city: citySlug, district: districtSlug })
  const count = categoryRows(category, q).length
  return ok({
    count,
    countDiff: 0,
    highlights: count ? [{ key: 'sample', label: '검증 표본', count, percent: 100 }] : [],
    nearbyDistricts: [{ slug: 'suwon', district: secondDistrict, count: secondRegionParking.length }],
    lastSyncedAt: syncedAt,
  })
}

export function handleLifestyleFixture(url) {
  const path = url.pathname
  const q = url.searchParams

  const area = handleAreaSummary(path)
  if (area) return area

  if (path === '/api/facilities/browse') return ok(browseResult(q))

  const regionMatch = path.match(/^\/api\/facilities\/region\/([^/]+)\/([^/]+)\/([^/]+)$/)
  if (regionMatch) {
    const [, citySlug, districtSlug, category] = regionMatch
    const params = new URLSearchParams(q)
    params.set('city', citySlug)
    params.set('district', districtSlug)
    return ok(pageOf(categoryRows(category, params), params))
  }

  if (path === '/api/subway/stations') return ok({ items: [station], total: 1, page: Number(q.get('page') || 1), limit: Number(q.get('limit') || 20) })
  if (path === '/api/subway/stations/nearby') return ok({ items: [{ id: 'station-lifestyle-2', name: '검증역삼', nameSlug: 'yeoksam-lifestyle', line: '2호선', lat: 37.5006, lng: 127.0365, distance: 820 }] })
  if (path === '/api/subway/stations/gangnam-lifestyle') return ok(station)

  if (path === '/api/waste-schedules') return ok(pageOf(wasteScheduleRows(q), q))
  if (path === '/api/waste-areas') return ok(wasteAreaList(q))
  const wasteAreaMatch = path.match(/^\/api\/waste-areas\/(\d+)$/)
  if (wasteAreaMatch) {
    const area = wasteAreas.find(row => row.areaId === Number(wasteAreaMatch[1]))
    return area
      ? ok({
        generationId: 'fixture-generation-id',
        area,
        schedules: schedules
          .filter(schedule => (area.areaId === 101 ? [901, 902].includes(schedule.id) : schedule.id === 921))
          .map((schedule, scheduleIndex) => ({
            schedule,
            scope: scheduleIndex === 0 ? 'whole' : 'conditional',
            conditionText: scheduleIndex === 0 ? '일반 월+수+금' : '음식물 화+목',
            evidence: [{
              url: 'https://www.gangnam.go.kr/waste-fixture',
              version: 'fixture-generation-id',
              effectiveFrom: '2026-09-20',
              effectiveTo: null,
              note: 'remaining lifestyle fixture',
            }],
          })),
        unresolved: { count: 1, href: '/trash?coverage=unresolved&city=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&district=%EA%B0%95%EB%82%A8%EA%B5%AC' },
        indexEligible: false,
        indexReason: 'fixture',
        contentUpdatedAt: syncedAt,
        predecessorOrSuccessorLinks: [{ name: '강남구 원문 미분류', href: '/trash?coverage=unresolved&city=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&district=%EA%B0%95%EB%82%A8%EA%B5%AC' }],
      })
      : missing()
  }
  const wasteMatch = path.match(/^\/api\/waste-schedules\/(\d+)$/)
  if (wasteMatch) {
    const item = schedules.find(row => row.id === Number(wasteMatch[1]))
    return item ? ok(item) : missing()
  }

  const nearbyMatch = path.match(/^\/api\/facilities\/([^/]+)\/([^/]+)\/nearby$/)
  if (nearbyMatch) return ok({ items: parkingItems.slice(0, 3) })

  const detailMatch = path.match(/^\/api\/facilities\/([^/]+)\/([^/]+)$/)
  if (detailMatch) {
    const detail = detailFor(detailMatch[1], decodeURIComponent(detailMatch[2]))
    return detail ? ok(detail) : missing()
  }

  if (path === '/api/facilities/search') return ok({ items: parkingItems.slice(0, 2), total: 2 })
  if (path.endsWith('/nearby-counts')) return ok({ radius: 300, counts: {} })
  if (path.includes('/guides') || path.includes('/blog')) return ok({ items: [], total: 0 })

  return null
}
