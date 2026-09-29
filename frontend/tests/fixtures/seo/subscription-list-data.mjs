import { kstDate } from './housing-data.mjs'

export const subscriptionListRequests = []
export const subscriptionListControl = {
  failNextList: 0,
  delayMs: 0,
  failingListSignature: '',
  emptyNextList: 0,
  emptyListSignature: '',
}

export function resetSubscriptionListFixture() {
  subscriptionListControl.failNextList = 0
  subscriptionListControl.delayMs = 0
  subscriptionListControl.failingListSignature = ''
  subscriptionListControl.emptyNextList = 0
  subscriptionListControl.emptyListSignature = ''
  subscriptionListRequests.length = 0
}

function isoAtKstNoon(offsetDays = 0) {
  return `${kstDate(offsetDays)}T03:00:00.000Z`
}

function notice(id, overrides = {}) {
  const status = overrides.status ?? 'ongoing'
  const unknown = status === 'unknown'
  return {
    id,
    houseManageNo: `HM-${id}`,
    pblancNo: `PB-${id}`,
    sourceType: 'APT',
    houseName: `서울 강남 매입 공고 ${id}`,
    houseType: 'APT',
    houseDetailType: '민영',
    rentType: '분양주택',
    regionName: '서울특별시 강남구',
    supplyLocation: '서울특별시 강남구 테헤란로 900',
    totalSupplyCount: 100 + (id % 50),
    announcementDate: kstDate(-10 - (id % 7)),
    receptionStartDate: unknown ? null : status === 'upcoming' ? kstDate(4 + (id % 5)) : kstDate(-1),
    receptionEndDate: unknown ? null : status === 'closed' ? kstDate(-2) : kstDate(3 + (id % 4)),
    specialStartDate: null,
    specialEndDate: null,
    rank1AreaStartDate: null,
    rank1AreaEndDate: null,
    rank1OtherStartDate: null,
    rank1OtherEndDate: null,
    rank2AreaStartDate: null,
    rank2AreaEndDate: null,
    rank2OtherStartDate: null,
    rank2OtherEndDate: null,
    winnerDate: kstDate(20),
    contractStartDate: kstDate(30),
    contractEndDate: kstDate(35),
    moveInMonth: '202704',
    constructorName: '회복건설',
    developerName: '회복시행',
    homepage: 'https://www.applyhome.co.kr/',
    pblancUrl: `https://www.applyhome.co.kr/pblanc/${id}`,
    inquiryTel: '02-1234-9000',
    status,
    lat: 37.51,
    lng: 127.04,
    createdAt: isoAtKstNoon(-20),
    updatedAt: isoAtKstNoon(-1),
    publicRental: null,
    ...overrides,
  }
}

function publicRental(id, index, overrides = {}) {
  return notice(id, {
    sourceType: index % 2 === 0 ? 'PUBLIC_RENT' : 'APT',
    houseDetailType: '공공임대',
    rentType: index % 2 === 0 ? '국민임대' : '임대주택',
    houseName: `서울 강남 매입 공고 ${index}`,
    totalSupplyCount: index % 7 === 0 ? 0 : 80 + index,
    publicRental: {
      provider: index % 2 === 0 ? 'LH' : '마이홈',
      sources: ['LH'],
      sourceIds: { myhome: [], lh: [`lh-${id}`] },
      sourceStatus: null,
      lastSyncedAt: isoAtKstNoon(-1),
      isCorrection: false,
      supplies: [
        { key: `${id}-seoul`, name: '서울 공급', region: '서울특별시 강남구', address: '서울특별시 강남구 테헤란로', supplyCount: 20, deposit: null, monthlyRent: null, receptionStartDate: null, receptionEndDate: null },
        { key: `${id}-gyeonggi`, name: '경기 공급', region: '경기도 수원시', address: '경기도 수원시 팔달구', supplyCount: 30, deposit: null, monthlyRent: null, receptionStartDate: null, receptionEndDate: null },
      ],
    },
    ...overrides,
  })
}

const sales = Array.from({ length: 50 }, (_, index) => notice(index === 0 ? 90001 : 91001 + index, {
  houseName: index === 24
    ? '서울 강남 매입 공고 이름이 아주 길어서 태블릿과 모바일에서도 줄바꿈 안정성을 확인하는 분양 아파트'
    : `서울 강남 매입 공고 분양 ${index + 1}`,
  sourceType: index % 5 === 0 ? 'OFFITEL' : index % 7 === 0 ? 'REMAINING' : 'APT',
  status: index > 45 ? 'closed' : index > 42 ? 'upcoming' : 'ongoing',
}))

const rents = Array.from({ length: 50 }, (_, index) => publicRental(index === 0 ? 90002 : 92001 + index, index + 1, {
  houseName: index === 0 ? '회복공공임대' : `서울 강남 매입 공고 ${index + 1}`,
  ...(index === 0 ? { receptionEndDate: kstDate(0) } : {}),
  status: index === 3 ? 'unknown' : index > 45 ? 'closed' : index > 42 ? 'upcoming' : 'ongoing',
}))

const privateRent = notice(93001, {
  sourceType: 'PRIVATE_RENT',
  rentType: '공공지원 민간임대',
  houseName: '민간임대 확인 공고',
  regionName: '경기도 수원시',
  supplyLocation: '경기도 수원시 팔달구',
})

const allNotices = [...sales, ...rents, privateRent]

function selectedStatus(query) {
  return query.get('status') || ''
}


function regionAliases(region) {
  if (!region) return [region]
  return [
    region,
    region.replace(/^서울 /, '서울특별시 '),
    region.replace(/^경기 /, '경기도 '),
  ]
}

function matchesRegion(item, region) {
  if (!region) return true
  const haystack = [
    item.regionName,
    item.supplyLocation,
    ...(item.publicRental?.supplies ?? []).flatMap(supply => [supply.region, supply.address]),
  ].filter(Boolean).join(' ')
  return regionAliases(region).some(alias => haystack.includes(alias))
}

function matchesKeyword(item, q) {
  if (!q) return true
  const haystack = [
    item.houseName,
    item.regionName,
    item.supplyLocation,
    ...(item.publicRental?.supplies ?? []).flatMap(supply => [supply.region, supply.address, supply.name]),
  ].filter(Boolean).join(' ')
  return haystack.includes(q)
}

function statusRank(status) {
  return { ongoing: 0, upcoming: 1, unknown: 2, closed: 3 }[status] ?? 4
}

function sortNotices(items, sort) {
  return [...items].sort((a, b) => {
    if (sort === 'recent') return String(b.announcementDate).localeCompare(String(a.announcementDate)) || b.id - a.id
    const rank = statusRank(a.status) - statusRank(b.status)
    if (rank !== 0) return rank
    return String(a.receptionEndDate ?? '9999-12-31').localeCompare(String(b.receptionEndDate ?? '9999-12-31')) || b.id - a.id
  })
}


export function subscriptionListRequestSignature(query) {
  return [
    query.get('category') ?? '',
    query.get('sourceType') ?? '',
    query.get('rentType') ?? '',
    query.get('status') ?? '',
    query.get('sort') ?? '',
    query.get('page') ?? '',
    query.get('limit') ?? '',
    query.get('q') ?? '',
    query.get('region') ?? '',
  ].join('|')
}

export function shouldFailSubscriptionListRequest(query) {
  if (subscriptionListControl.failNextList <= 0) return false
  const signature = subscriptionListRequestSignature(query)
  if (!subscriptionListControl.failingListSignature) {
    subscriptionListControl.failingListSignature = signature
  }
  if (subscriptionListControl.failingListSignature !== signature) return false
  subscriptionListControl.failNextList -= 1
  if (subscriptionListControl.failNextList <= 0) {
    subscriptionListControl.failingListSignature = ''
  }
  return true
}


export function shouldEmptySubscriptionListRequest(query) {
  if (subscriptionListControl.emptyNextList <= 0) return false
  const signature = subscriptionListRequestSignature(query)
  if (!subscriptionListControl.emptyListSignature) {
    subscriptionListControl.emptyListSignature = signature
  }
  if (subscriptionListControl.emptyListSignature !== signature) return false
  subscriptionListControl.emptyNextList -= 1
  if (subscriptionListControl.emptyNextList <= 0) {
    subscriptionListControl.emptyListSignature = ''
  }
  return true
}

export function emptySubscriptionListFixture(query) {
  subscriptionListRequests.push(Object.fromEntries(query.entries()))
  const page = Math.max(1, Number(query.get('page') ?? 1))
  return {
    items: [],
    total: 0,
    page,
    totalPages: 1,
    now: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10),
  }
}

export function subscriptionListFixture(query) {
  const page = Math.max(1, Number(query.get('page') ?? 1))
  const limit = Math.max(1, Number(query.get('limit') ?? 20))
  const category = query.get('category')
  const sourceType = query.get('sourceType')
  const rentType = query.get('rentType')
  const status = selectedStatus(query)
  const q = (query.get('q') ?? '').trim()
  const region = query.get('region') ?? ''
  const sort = query.get('sort') ?? 'priority'

  subscriptionListRequests.push(Object.fromEntries(query.entries()))

  let filtered = allNotices.filter((item) => {
    if (category === 'sale' && item.rentType !== '분양주택') return false
    if (category === 'rent' && item.rentType === '분양주택') return false
    if (sourceType && item.sourceType !== sourceType) return false
    if (rentType === '임대주택' && item.rentType === '공공지원 민간임대') return false
    if (rentType && rentType !== '임대주택' && item.rentType !== rentType) return false
    if (status && item.status !== status) return false
    if (!matchesRegion(item, region)) return false
    if (!matchesKeyword(item, q)) return false
    return true
  })

  filtered = sortNotices(filtered, sort)
  const start = (page - 1) * limit
  const items = filtered.slice(start, start + limit)
  return {
    items,
    total: filtered.length,
    page,
    totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    now: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10),
  }
}
