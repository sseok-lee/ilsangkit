const sourceUrl = 'https://www.gangnam.go.kr/waste-fixture'

const ok = data => ({ status: 200, body: { success: true, data } })
const fail = (status, error) => ({ status, body: { success: false, error } })

const control = {
  active: false,
  failNext: 0,
  delayMs: 0,
  sourceDelayMs: 0,
  optionsDelayMs: 0,
  generation: 'before',
  status: null,
  sourceStatus: null,
  sourcePayload: 'valid',
  optionsStatus: null,
  areaVariant: 'multiple',
  requests: [],
}

export function resetWasteAreaFixture() {
  control.active = false
  control.failNext = 0
  control.delayMs = 0
  control.sourceDelayMs = 0
  control.optionsDelayMs = 0
  control.generation = 'before'
  control.status = null
  control.sourceStatus = null
  control.sourcePayload = 'valid'
  control.optionsStatus = null
  control.areaVariant = 'multiple'
  control.requests = []
}

export function setWasteAreaFixtureControl(body = {}) {
  if (body.reset) resetWasteAreaFixture()
  if (body.active != null) control.active = Boolean(body.active)
  if (body.failNext != null) control.failNext = Math.max(0, Number(body.failNext) || 0)
  if (body.delayMs != null) control.delayMs = Math.max(0, Math.min(5000, Number(body.delayMs) || 0))
  if (body.sourceDelayMs != null) control.sourceDelayMs = Math.max(0, Math.min(5000, Number(body.sourceDelayMs) || 0))
  if (body.optionsDelayMs != null) control.optionsDelayMs = Math.max(0, Math.min(5000, Number(body.optionsDelayMs) || 0))
  if (['before', 'after'].includes(body.generation)) control.generation = body.generation
  if ([400, 404, 410, 503].includes(Number(body.status))) control.status = Number(body.status)
  if ([400, 404, 410, 503, null].includes(body.sourceStatus ?? null)) control.sourceStatus = body.sourceStatus == null ? null : Number(body.sourceStatus)
  if ([400, 404, 410, 503, null].includes(body.optionsStatus ?? null)) control.optionsStatus = body.optionsStatus == null ? null : Number(body.optionsStatus)
  if (['valid', 'failure', 'malformed'].includes(body.sourcePayload)) control.sourcePayload = body.sourcePayload
  if (['single', 'multiple', 'empty'].includes(body.areaVariant)) control.areaVariant = body.areaVariant
  return wasteAreaFixtureState()
}

export function wasteAreaFixtureState() {
  return { ...control, requests: control.requests.slice() }
}

function generationId() {
  return control.generation === 'after' ? 'w10-generation-after' : 'w10-generation-before'
}

function dateText() {
  return control.generation === 'after' ? '2026-09-29T00:00:00.000Z' : '2026-09-28T00:00:00.000Z'
}

function areaName(base) {
  return control.generation === 'after' ? `${base} 최신` : base
}

function area(areaId, name, city, district, scheduleCount, extra = {}) {
  return {
    areaId,
    name,
    city,
    district,
    href: `/trash/areas/${areaId}`,
    matchReason: 'exact',
    scheduleCount,
    conditionalCount: extra.conditionalCount ?? 0,
    summary: extra.summary ?? `${generationId()} 검증 fixture`,
    dataDate: dateText(),
  }
}

function applies(areaId, name, city, district, conditionText = '전체 적용', scope = 'whole') {
  return { areaId, name, city, district, href: `/trash/areas/${areaId}`, scope, conditionText }
}

function schedule(id, city, district, targetRegion, details = {}) {
  const applicableAreas = details.applicableAreas || []
  return {
    id,
    city,
    district,
    targetRegion,
    emissionPlace: details.emissionPlace ?? '문전 배출',
    sourceUrl: details.sourceUrl ?? sourceUrl,
    govCode: details.govCode ?? '1168000000',
    sourceStatus: details.sourceStatus || 'active',
    applicableAreas,
    appliesTo: applicableAreas.map(entry => ({
      areaId: entry.areaId,
      districtCode: null,
      scope: entry.scope,
      conditionText: entry.conditionText,
      state: 'verified',
      reason: 'fixture',
      evidence: [{ url: sourceUrl, version: generationId(), effectiveFrom: dateText().slice(0, 10), effectiveTo: null, note: 'source guide fixture' }],
    })),
    details: {
      emissionPlaceType: details.emissionPlaceType || '문전',
      managementZone: details.zone || `${district || city} 검증권역`,
      livingWaste: { dayOfWeek: details.livingDay || '월+수+금', beginTime: details.livingBegin || '18:00', endTime: details.livingEnd || '22:00', method: details.livingMethod || '종량제 봉투 사용' },
      foodWaste: { dayOfWeek: details.foodDay || '화+목', beginTime: details.foodBegin || '18:00', endTime: details.foodEnd || '22:00', method: details.foodMethod || '전용 용기 배출' },
      recyclable: { dayOfWeek: details.recycleDay || '수', beginTime: details.recycleBegin || '20:00', endTime: details.recycleEnd || '02:00', method: details.recycleMethod || '품목별 분리 배출' },
      bulkWaste: { beginTime: '09:00', endTime: '18:00', method: details.bulkMethod || '온라인 신고 후 배출', place: details.bulkPlace || '지정 장소' },
      uncollectedDay: details.uncollectedDay || '일요일',
      manageDepartment: details.department || `${district || city} 청소행정과`,
      managePhone: details.phone || '02-3423-1234',
      dataCreatedDate: dateText().slice(0, 10),
      lastModified: dateText(),
    },
  }
}

function uiwangSchedules() {
  return Array.from({ length: 348 }, (_, index) => schedule(
    30001 + index,
    '경기도',
    '의왕시',
    index === 0 ? '가나무로' : index === 1 ? '갈뫼초등학교' : `의왕 원본구역 ${String(index + 1).padStart(3, '0')}`,
    { zone: `의왕 ${index + 1}권역`, emissionPlace: index % 2 ? '거점 배출' : '문전 배출' }
  ))
}

const gangnamCommonAreas = Array.from({ length: 22 }, (_, index) =>
  applies(100 + index, `강남공통${index + 1}동`, '서울특별시', '강남구', '강남구 22개 동 공통 원본')
)

function gangnamSchedules() {
  const longTarget = '요양원,칠량면소재지,초등학교.칠량시장,덕동,봉황(월궁),보련,달동내,마량면소재지,청자박물관,항골,정수사,계치,청룡,난산,수동,대구면사무소,중학교,초등학교,대구면소재지 등'
  const htmlLike = '<script>alert(1)</script> 검증검색 안전문구'
  const conditions = Array.from({ length: 21 }, (_, index) => schedule(
    2101 + index,
    '서울특별시',
    '강남구',
    index === 0 ? `${htmlLike} 조건검증동` : '조건검증동',
    {
      livingDay: ['월', '화', '수', '목', '금', '토', '일'][index % 7],
      zone: `조건 ${index + 1}`,
      applicableAreas: [applies(210, '조건검증동', '서울특별시', '강남구', `21조건 ${index + 1}`, index === 0 ? 'whole' : 'conditional')],
    }
  ))
  return [
    schedule(1001, '서울특별시', '강남구', '역삼1동+역삼2동', {
      applicableAreas: [
        applies(1, areaName('역삼1동'), '서울특별시', '강남구', '공통 원본 전체 적용'),
        applies(2, '역삼2동', '서울특별시', '강남구', '공통 원본 전체 적용'),
      ],
    }),
    schedule(1002, '서울특별시', '강남구', '역삼1동', {
      applicableAreas: [applies(1, areaName('역삼1동'), '서울특별시', '강남구', '음식물 화+목', 'conditional')],
    }),
    schedule(1003, '서울특별시', '강남구', '강남구 전체', { applicableAreas: gangnamCommonAreas }),
    schedule(1004, '전국', '', '전국 공통 배출 안전 안내', { emissionPlace: '전국 공통' }),
    schedule(1005, '서울특별시', '', '서울시 공통 배출 안내', { emissionPlace: '시도 공통' }),
    schedule(1006, '서울특별시', '강남구', longTarget, { zone: '칠량, 대구, 마량(화)', bulkMethod: '미운영' }),
    schedule(1007, '강원특별자치도', '정선군', '신동읍', { emissionPlace: '예미2길 26-49', zone: '정선 거점' }),
    schedule(1410, '서울특별시', '강남구', '종료검증동', { sourceStatus: 'inactive' }),
    schedule(2201, '서울특별시', '강남구', '페이지2검증동', {
      applicableAreas: [applies(220, '페이지2검증동', '서울특별시', '강남구', '페이지2 복원 검증')],
    }),
    ...conditions,
  ]
}

function gapyeongSchedules() {
  return [
    schedule(4001, '경기도', '가평군', '가평읍', { applicableAreas: [applies(401, '가평읍', '경기도', '가평군', '가평읍 전체')] }),
    schedule(4002, '경기도', '가평군', '청평면', { applicableAreas: [applies(402, '청평면', '경기도', '가평군', '청평면 전체')] }),
  ]
}

function allSchedules() {
  return [...gangnamSchedules(), ...uiwangSchedules(), ...gapyeongSchedules()]
}

function fillerAreas() {
  return Array.from({ length: 96 }, (_, index) =>
    area(500 + index, `페이지채움동 ${index + 1}`, '서울특별시', '강남구', 0, { summary: '101개 선택지 페이지네이션 검증용 행' })
  )
}

function areaSummaries() {
  return [
    area(1, areaName('역삼1동'), '서울특별시', '강남구', 2, { conditionalCount: 1, summary: `${generationId()} · 공통 원본과 조건별 음식물 일정을 함께 확인` }),
    area(2, '역삼2동', '서울특별시', '강남구', 1, { summary: '역삼1동과 같은 원본을 공유' }),
    area(210, '조건검증동', '서울특별시', '강남구', 21, { conditionalCount: 20, summary: '21개 조건 일정 렌더링 검증' }),
    area(301, '색인보류동', '서울특별시', '강남구', 0, { summary: '원문 검토가 끝나지 않아 색인 보류' }),
    ...fillerAreas(),
    area(220, '페이지2검증동', '서울특별시', '강남구', 1, { summary: '두 번째 페이지에서 상세·원문·목록 복원을 검증' }),
    area(401, '가평읍', '경기도', '가평군', 1),
    area(402, '청평면', '경기도', '가평군', 1),
    area(230, '빈검증동', '서울특별시', '강남구', 0),
    area(410, '종료검증동', '서울특별시', '강남구', 0),
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
  return areaSummaries().filter((item) => {
    if (q.get('city') && q.get('city') !== item.city) return false
    if (q.get('district') && q.get('district') !== item.district) return false
    return !keyword || item.name.includes(keyword)
  })
}

function selectedArea(areaId) {
  return areaSummaries().find(item => item.areaId === areaId) || null
}

function scheduleMatchesArea(item, areaId) {
  if (areaId === 230) return false
  return item.applicableAreas?.some(entry => entry.areaId === areaId)
}

function filteredSchedules(q) {
  const keyword = (q.get('keyword') || '').trim()
  const areaId = q.get('areaId') ? Number(q.get('areaId')) : null
  return allSchedules().filter((item) => {
    if (q.get('city') && q.get('city') !== item.city) return false
    if (q.get('district') && q.get('district') !== item.district) return false
    if (areaId && !scheduleMatchesArea(item, areaId)) return false
    if (q.get('coverage') === 'unresolved' && item.applicableAreas?.length) return false
    if (keyword) {
      const haystack = [
        item.targetRegion,
        item.emissionPlace,
        item.details?.managementZone,
        item.city,
        item.district,
        ...(item.applicableAreas ?? []).map(entry => entry.name),
      ].filter(Boolean).join(' ')
      if (!haystack.includes(keyword)) return false
    }
    return item.sourceStatus !== 'inactive'
  })
}

function areaIdsFor(areaId) {
  if (areaId === 1) return control.generation === 'after' ? [1001] : [1001, 1002]
  if (areaId === 2) return [1001]
  if (areaId === 210) return Array.from({ length: 21 }, (_, index) => 2101 + index)
  if (areaId === 220) return [2201]
  if (areaId === 230) return []
  if (areaId === 401) return [4001]
  if (areaId === 402) return [4002]
  if (areaId >= 500 && areaId < 596) return []
  return null
}

function areaDetail(areaId) {
  if (areaId === 410) return { inactive: true }
  if ([302, 303].includes(areaId)) return null
  const area = selectedArea(areaId)
  if (!area) return null
  const ids = control.areaVariant === 'single'
    ? [1001]
    : control.areaVariant === 'empty'
      ? []
      : areaIdsFor(areaId)
  if (!ids) return null
  const schedules = allSchedules()
    .filter((item) => ids.includes(item.id))
    .map((item, index) => {
      const match = item.applicableAreas?.find(entry => entry.areaId === areaId)
      return {
        schedule: item,
        scope: match?.scope || (index === 0 ? 'whole' : 'conditional'),
        conditionText: match?.conditionText || `21조건 ${index + 1}`,
        evidence: [{ url: sourceUrl, version: generationId(), effectiveFrom: dateText().slice(0, 10), effectiveTo: null, note: 'source guide fixture' }],
      }
    })
  return {
    generationId: generationId(),
    area,
    schedules,
    unresolved: { count: 2, href: `/trash?coverage=unresolved&city=${encodeURIComponent(area.city)}&district=${encodeURIComponent(area.district)}` },
    indexEligible: areaId === 1,
    indexReason: areaId === 1 ? 'verified-distinct-content' : 'fixture-held-or-nonadmin',
    contentUpdatedAt: dateText(),
    predecessorOrSuccessorLinks: [],
  }
}

function schedulePage(q) {
  const areaId = q.get('areaId') ? Number(q.get('areaId')) : null
  const page = pageOf(filteredSchedules(q), q)
  if (!areaId) return page
  const item = selectedArea(areaId)
  return { ...page, selectedArea: item ? { areaId: item.areaId, name: item.name, city: item.city, district: item.district } : undefined, generationId: generationId() }
}

function browseTrash(q) {
  const rows = areaSummaries().filter(item => !q.get('city') || q.get('city') === 'seoul' || item.city === q.get('city'))
  return {
    mode: 'list',
    category: 'trash',
    unit: '일정',
    ...pageOf(rows.map((item) => ({
      id: String(item.areaId),
      category: 'trash',
      name: `${item.name} 배출 안내`,
      address: `${item.city} ${item.district}`,
      roadAddress: `${item.city} ${item.district}`,
      city: item.city,
      district: item.district,
      lat: null,
      lng: null,
      destination: { kind: 'waste-area', href: item.href },
      href: item.href,
      extras: { summary: item.summary },
    })), q),
  }
}

function groupedSearch() {
  const items = areaSummaries().slice(0, 3).map((item) => ({
    id: String(item.areaId),
    category: 'trash',
    name: `${item.name} 배출 안내`,
    address: `${item.city} ${item.district}`,
    roadAddress: `${item.city} ${item.district}`,
    city: item.city,
    district: item.district,
    lat: null,
    lng: null,
    destination: { kind: 'waste-area', href: item.href },
    extras: { summary: item.summary },
  }))
  return { categories: [{ category: 'trash', label: '쓰레기배출', count: areaSummaries().length, unit: '지역', items }], totalCount: areaSummaries().length }
}

export function handleWasteAreaFixture(url) {
  if (!control.active) return null
  const path = url.pathname
  const q = url.searchParams
  const isOptions = path === '/api/waste-areas'
  const isAreaDetail = /^\/api\/waste-areas\/\d+$/.test(path)
  const isSourceList = path === '/api/waste-schedules'
  const isSourceDetail = /^\/api\/waste-schedules\/\d+$/.test(path)
  if (isOptions || isAreaDetail || isSourceList || isSourceDetail) control.requests.push(`${path}?${q.toString()}`)

  if ((isOptions || isAreaDetail) && control.status) {
    const status = control.status
    control.status = null
    return fail(status, `waste area fixture forced ${status}`)
  }
  if (isOptions && control.optionsStatus) return fail(control.optionsStatus, `waste area options forced ${control.optionsStatus}`)
  if ((isOptions || isAreaDetail) && control.failNext > 0) {
    control.failNext -= 1
    return fail(503, 'waste area fixture transient failure')
  }
  if ((isSourceList || isSourceDetail) && control.sourceStatus) return fail(control.sourceStatus, `waste source fixture forced ${control.sourceStatus}`)

  if (isOptions) {
    return ok({
      generationId: generationId(),
      ...pageOf(filteredAreas(q), q),
      unresolved: { count: 2, href: `/trash?coverage=unresolved&city=${encodeURIComponent('서울특별시')}&district=${encodeURIComponent('강남구')}` },
    })
  }
  const areaMatch = path.match(/^\/api\/waste-areas\/(\d+)$/)
  if (areaMatch) {
    const id = Number(areaMatch[1])
    if (id === 302 || id === 303) return fail(404, 'legal/staged area not public')
    if (id === 410) return fail(410, 'waste area inactive')
    const detail = areaDetail(id)
    return detail ? ok(detail) : fail(404, 'waste area not found')
  }
  if (isSourceList) {
    if (control.sourcePayload === 'failure') return { status: 200, body: { success: false, error: 'source payload failure' } }
    if (control.sourcePayload === 'malformed') return { status: 200, body: { success: true, data: { items: [], total: 'bad', page: 1, totalPages: 1 } } }
    return ok(schedulePage(q))
  }
  const scheduleMatch = path.match(/^\/api\/waste-schedules\/(\d+)$/)
  if (scheduleMatch) {
    const id = Number(scheduleMatch[1])
    if (id === 1410) return fail(410, 'waste source inactive')
    const item = allSchedules().find((item) => item.id === id)
    return item ? ok(item) : fail(404, 'waste source not found')
  }
  if (path === '/api/facilities/browse' && (!q.get('category') || q.get('category') === 'trash')) return ok(browseTrash(q))
  if (path === '/api/facilities/search') return ok(groupedSearch())
  return null
}
