const city = '서울특별시'
const district = '강남구'
const sourceUrl = 'https://www.gangnam.go.kr/waste-fixture'
const syncedAt = '2026-09-28T00:00:00.000Z'

const ok = data => ({ status: 200, body: { success: true, data } })
const fail = (status, error) => ({ status, body: { success: false, error } })

const control = {
  active: false,
  failNext: 0,
  delayMs: 0,
  generation: 'before',
  status: null,
  requests: [],
}

export function resetWasteAreaFixture() {
  control.active = false
  control.failNext = 0
  control.delayMs = 0
  control.generation = 'before'
  control.status = null
  control.requests = []
}

export function setWasteAreaFixtureControl(body = {}) {
  if (body.reset) resetWasteAreaFixture()
  if (body.active != null) control.active = Boolean(body.active)
  if (body.failNext != null) control.failNext = Math.max(0, Number(body.failNext) || 0)
  if (body.delayMs != null) control.delayMs = Math.max(0, Math.min(5000, Number(body.delayMs) || 0))
  if (['before', 'after'].includes(body.generation)) control.generation = body.generation
  if ([400, 404, 410, 503].includes(Number(body.status))) control.status = Number(body.status)
  return wasteAreaFixtureState()
}

export function wasteAreaFixtureState() {
  return { ...control }
}

function generationId() {
  return control.generation === 'after' ? 'w10-generation-after' : 'w10-generation-before'
}

function areaName(base) {
  return control.generation === 'after' ? `${base} 최신` : base
}

function dateText() {
  return control.generation === 'after' ? '2026-09-29T00:00:00.000Z' : '2026-09-28T00:00:00.000Z'
}

function schedule(id, targetRegion, details = {}) {
  return {
    id,
    city,
    district,
    targetRegion,
    emissionPlace: '문전 배출',
    sourceUrl,
    govCode: '1168000000',
    sourceStatus: details.sourceStatus || 'active',
    applicableAreas: details.applicableAreas || details.appliesTo || [],
    appliesTo: [],
    details: {
      emissionPlaceType: '문전',
      managementZone: details.zone || '강남 검증권역',
      livingWaste: { dayOfWeek: details.livingDay || '월+수+금', beginTime: '18:00', endTime: '22:00', method: '종량제 봉투 사용' },
      foodWaste: { dayOfWeek: details.foodDay || '화+목', beginTime: '18:00', endTime: '22:00', method: '전용 용기 배출' },
      recyclable: { dayOfWeek: details.recycleDay || '수', beginTime: '18:00', endTime: '22:00', method: '품목별 분리 배출' },
      bulkWaste: { beginTime: '09:00', endTime: '18:00', method: '온라인 신고 후 배출', place: '지정 장소' },
      uncollectedDay: '일요일',
      manageDepartment: '강남구 청소행정과',
      managePhone: '02-3423-1234',
      dataCreatedDate: dateText().slice(0, 10),
      lastModified: dateText(),
    },
  }
}

function allSchedules() {
  const conditions = Array.from({ length: 21 }, (_, index) => schedule(
    2101 + index,
    '조건검증동',
    {
      livingDay: ['월', '화', '수', '목', '금', '토', '일'][index % 7],
      zone: `조건 ${index + 1}`,
      applicableAreas: [{
        areaId: 210,
        name: '조건검증동',
        href: '/trash/areas/210',
        scope: index === 0 ? 'whole' : 'conditional',
        conditionText: `21조건 ${index + 1}`,
      }],
    }
  ))
  return [
    schedule(1001, '역삼1동+역삼2동', {
      applicableAreas: [
        { areaId: 1, name: areaName('역삼1동'), href: '/trash/areas/1', scope: 'whole', conditionText: '공통 원본 전체 적용' },
        { areaId: 2, name: '역삼2동', href: '/trash/areas/2', scope: 'whole', conditionText: '공통 원본 전체 적용' },
      ],
    }),
    schedule(1002, '역삼1동', {
      applicableAreas: [{ areaId: 1, name: areaName('역삼1동'), href: '/trash/areas/1', scope: 'conditional', conditionText: '음식물 화+목' }],
    }),
    schedule(1003, '역삼동', {
      applicableAreas: [{ areaId: 3, name: '역삼동 법정동 후보', href: '/trash/areas/3', scope: 'partial', conditionText: '법정동 관계 후보' }],
    }),
    schedule(1410, '종료검증동', { sourceStatus: 'inactive' }),
    schedule(2201, '페이지2검증동', {
      applicableAreas: [{ areaId: 220, name: '페이지2검증동', href: '/trash/areas/220', scope: 'whole', conditionText: '페이지2 복원 검증' }],
    }),
    ...conditions,
  ]
}

function fillerAreas() {
  return Array.from({ length: 15 }, (_, index) => ({
    areaId: 500 + index,
    name: `페이지채움동 ${index + 1}`,
    city,
    district,
    href: `/trash/areas/${500 + index}`,
    matchReason: 'exact',
    scheduleCount: 0,
    conditionalCount: 0,
    summary: '페이지네이션 검증용 색인 보류 행',
    dataDate: dateText(),
  }))
}

function areaSummaries() {
  return [
    {
      areaId: 1,
      name: areaName('역삼1동'),
      city,
      district,
      href: '/trash/areas/1',
      matchReason: 'exact',
      scheduleCount: 2,
      conditionalCount: 1,
      summary: `${generationId()} · 공통 원본과 조건별 음식물 일정을 함께 확인`,
      dataDate: dateText(),
    },
    {
      areaId: 2,
      name: '역삼2동',
      city,
      district,
      href: '/trash/areas/2',
      matchReason: 'exact',
      scheduleCount: 1,
      conditionalCount: 0,
      summary: '역삼1동과 같은 원본을 공유하되 동별 안내는 별도로 제공',
      dataDate: dateText(),
    },
    {
      areaId: 3,
      name: '역삼동 법정동 후보',
      city,
      district,
      href: '/trash/areas/3',
      matchReason: 'relation',
      scheduleCount: 1,
      conditionalCount: 1,
      summary: '법정동 표기 원문은 행정동 전체 적용으로 확정하지 않음',
      dataDate: dateText(),
    },
    {
      areaId: 210,
      name: '조건검증동',
      city,
      district,
      href: '/trash/areas/210',
      matchReason: 'exact',
      scheduleCount: 21,
      conditionalCount: 20,
      summary: '21개 조건 일정 렌더링 검증',
      dataDate: dateText(),
    },
    {
      areaId: 301,
      name: '색인보류동',
      city,
      district,
      href: '/trash/areas/301',
      matchReason: 'exact',
      scheduleCount: 0,
      conditionalCount: 0,
      summary: '원문 검토가 끝나지 않아 색인 보류',
      dataDate: dateText(),
    },
    ...fillerAreas(),
    {
      areaId: 220,
      name: '페이지2검증동',
      city,
      district,
      href: '/trash/areas/220',
      matchReason: 'exact',
      scheduleCount: 1,
      conditionalCount: 0,
      summary: '두 번째 페이지에서 상세·원문·목록 복원을 검증',
      dataDate: dateText(),
    },
  ]
}

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

function filteredAreas(q) {
  const keyword = (q.get('keyword') || '').trim()
  return areaSummaries().filter((area) => {
    if (q.get('city') && q.get('city') !== area.city) return false
    if (q.get('district') && q.get('district') !== area.district) return false
    return !keyword || area.name.includes(keyword)
  })
}

function filteredSchedules(q) {
  const keyword = (q.get('keyword') || '').trim()
  return allSchedules().filter((item) => {
    if (q.get('city') && q.get('city') !== item.city) return false
    if (q.get('district') && q.get('district') !== item.district) return false
    if (q.get('coverage') === 'unresolved' && item.applicableAreas?.length) return false
    if (keyword && !String(item.targetRegion || '').includes(keyword)) return false
    return true
  })
}

function areaDetail(areaId) {
  const area = areaSummaries().find((item) => item.areaId === areaId)
  if (!area) return null
  if (areaId === 410) return { inactive: true }
  const ids = areaId === 1 ? [1001, 1002] : areaId === 2 ? [1001] : areaId === 3 ? [1003] : areaId === 210 ? Array.from({ length: 21 }, (_, index) => 2101 + index) : areaId === 220 ? [2201] : []
  const schedules = allSchedules()
    .filter((item) => ids.includes(item.id))
    .map((item, index) => ({
      schedule: item,
      scope: item.applicableAreas?.find((entry) => entry.areaId === areaId)?.scope || (index === 0 ? 'whole' : 'conditional'),
      conditionText: item.applicableAreas?.find((entry) => entry.areaId === areaId)?.conditionText || `21조건 ${index + 1}`,
      evidence: [{ url: sourceUrl, version: generationId(), effectiveFrom: dateText().slice(0, 10), effectiveTo: null, note: 'w10 fixture' }],
    }))
  return {
    generationId: generationId(),
    area,
    schedules,
    unresolved: { count: 2, href: `/trash?coverage=unresolved&city=${encodeURIComponent(city)}&district=${encodeURIComponent(district)}` },
    indexEligible: areaId === 1,
    indexReason: areaId === 1 ? 'verified-distinct-content' : 'fixture-held-or-nonadmin',
    contentUpdatedAt: dateText(),
    predecessorOrSuccessorLinks: areaId === 3 ? [{ name: '법정동 후보 원문', href: '/trash/1003' }] : [],
  }
}

function browseTrash(q) {
  if (q.get('city') && q.get('city') !== 'seoul') return { mode: 'list', category: 'trash', unit: '일정', items: [], total: 0, page: 1, totalPages: 1 }
  return {
    mode: 'list',
    category: 'trash',
    unit: '일정',
    ...pageOf(areaSummaries().map((area) => ({
      id: String(area.areaId),
      category: 'trash',
      name: `${area.name} 배출 안내`,
      address: `${area.city} ${area.district}`,
      roadAddress: `${area.city} ${area.district}`,
      city: area.city,
      district: area.district,
      lat: null,
      lng: null,
      destination: { kind: 'waste-area', href: area.href },
      href: area.href,
      extras: { summary: area.summary },
    })), q),
  }
}

function groupedSearch() {
  const items = areaSummaries().slice(0, 3).map((area) => ({
    id: String(area.areaId),
    category: 'trash',
    name: `${area.name} 배출 안내`,
    address: `${area.city} ${area.district}`,
    roadAddress: `${area.city} ${area.district}`,
    city: area.city,
    district: area.district,
    lat: null,
    lng: null,
    destination: { kind: 'waste-area', href: area.href },
    extras: { summary: area.summary },
  }))
  return {
    categories: [{
      category: 'trash',
      label: '쓰레기배출',
      count: areaSummaries().length,
      unit: '지역',
      items,
    }],
    totalCount: areaSummaries().length,
  }
}

export function handleWasteAreaFixture(url) {
  if (!control.active) return null
  const path = url.pathname
  const q = url.searchParams
  if (path === '/api/waste-areas' || /^\/api\/waste-areas\/\d+$/.test(path)) {
    control.requests.push(`${path}?${q.toString()}`)
  }
  if ((path === '/api/waste-areas' || /^\/api\/waste-areas\/\d+$/.test(path)) && control.status) {
    const status = control.status
    control.status = null
    return fail(status, `waste fixture forced ${status}`)
  }
  if ((path === '/api/waste-areas' || /^\/api\/waste-areas\/\d+$/.test(path)) && control.failNext > 0) {
    control.failNext -= 1
    return fail(503, 'waste fixture transient failure')
  }
  if (path === '/api/waste-areas') {
    return ok({
      generationId: generationId(),
      ...pageOf(filteredAreas(q), q),
      unresolved: {
        count: 2,
        href: `/trash?coverage=unresolved&city=${encodeURIComponent(city)}&district=${encodeURIComponent(district)}`,
      },
    })
  }
  const areaMatch = path.match(/^\/api\/waste-areas\/(\d+)$/)
  if (areaMatch) {
    const id = Number(areaMatch[1])
    if (id === 410) return fail(410, 'waste area inactive')
    const detail = areaDetail(id)
    return detail ? ok(detail) : fail(404, 'waste area not found')
  }
  if (path === '/api/waste-schedules') return ok(pageOf(filteredSchedules(q), q))
  const scheduleMatch = path.match(/^\/api\/waste-schedules\/(\d+)$/)
  if (scheduleMatch) {
    const id = Number(scheduleMatch[1])
    if (id === 1410) return fail(410, 'waste source inactive')
    const item = allSchedules().find((schedule) => schedule.id === id)
    return item ? ok(item) : fail(404, 'waste source not found')
  }
  if (path === '/api/facilities/browse' && (!q.get('category') || q.get('category') === 'trash')) return ok(browseTrash(q))
  if (path === '/api/facilities/search') return ok(groupedSearch())
  return null
}
