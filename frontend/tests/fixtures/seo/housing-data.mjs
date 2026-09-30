const MS_PER_DAY = 86_400_000

export const typeIdentities = {
  'apt-sale': {
    property: 'apt',
    buildingName: '회복아파트',
    bjdCode: '1168010100',
    dongName: '역삼동',
    jibun: '123',
    roadName: '테헤란로 123',
  },
  'apt-rent': {
    property: 'apt',
    buildingName: '회복아파트',
    bjdCode: '1168010100',
    dongName: '역삼동',
    jibun: '123',
    roadName: '테헤란로 123',
  },
  'villa-sale': {
    property: 'villa',
    buildingName: '회복빌라',
    bjdCode: '1168010200',
    dongName: '역삼동',
    jibun: '123-4',
    roadName: null,
  },
  'villa-rent': {
    property: 'villa',
    buildingName: '회복빌라',
    bjdCode: '1168010200',
    dongName: '역삼동',
    jibun: '123-4',
    roadName: null,
  },
  'offitel-sale': {
    property: 'offitel',
    buildingName: '회복오피스텔',
    bjdCode: '1168010300',
    dongName: '역삼동',
    jibun: '125, 125-1',
    roadName: '테헤란로 125',
  },
  'offitel-rent': {
    property: 'offitel',
    buildingName: '회복오피스텔',
    bjdCode: '1168010300',
    dongName: '역삼동',
    jibun: '125, 125-1',
    roadName: '테헤란로 125',
  },
}

export function kstDate(offsetDays = 0) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date(Date.now() + offsetDays * MS_PER_DAY))
}

function isoAtKstNoon(offsetDays = 0) {
  return `${kstDate(offsetDays)}T03:00:00.000Z`
}

export function dateWindow(days) {
  return { from: kstDate(-days + 1), to: kstDate(0) }
}

export function baseBuilding(
  type = 'apt-sale',
  name = typeIdentities[type]?.buildingName ?? '회복아파트'
) {
  const identity = typeIdentities[type] ?? typeIdentities['apt-sale']
  const broken = name === '고장아파트'
  const missing = name === '없는아파트'
  const ambiguous = name === '모호아파트'
  const neighbor = name.startsWith('이웃')
  if (broken) return { status: 503 }
  if (missing) return null
  return {
    type,
    buildingName: name,
    bjdCode: ambiguous ? '1168010400' : identity.bjdCode,
    city: '서울특별시',
    district: '강남구',
    dongName: identity.dongName,
    roadName: ambiguous ? '테헤란로 200' : identity.roadName,
    jibun: ambiguous ? '124' : identity.jibun,
    buildYear: 2000,
    minArea: 84.9,
    maxArea: 84.91,
    latestDealAmount: neighbor ? 85000 : 87000,
    latestMonthlyRent: type.endsWith('-rent') ? 120 : 0,
    latestDealYear: Number(kstDate(-2).slice(0, 4)),
    latestDealMonth: Number(kstDate(-2).slice(5, 7)),
    lat: ambiguous ? null : 37.5,
    lng: ambiguous ? null : 127.03,
    transactionCount: 21,
    latestPrice: neighbor ? 85000 : 87000,
    jeonseCount: 6,
    wolseCount: 4,
    regionMatched: true,
  }
}

function dealParts(offsetDays = -2) {
  const [year, month, day] = kstDate(offsetDays).split('-').map(Number)
  return { year, month, day }
}

function saleRow(id, type = 'apt-sale', overrides = {}) {
  const identity = typeIdentities[type] ?? typeIdentities['apt-sale']
  const parts = dealParts(-2)
  return {
    id,
    city: '서울특별시',
    district: '강남구',
    bjdCode: identity.bjdCode,
    dongName: identity.dongName,
    buildingName: identity.buildingName,
    buildYear: 2000,
    floor: (id % 20) + 1,
    exclusiveArea: overrides.exclusiveArea ?? 84.9,
    jibun: overrides.jibun ?? identity.jibun,
    roadName: overrides.roadName ?? identity.roadName,
    lat: 37.5,
    lng: 127.03,
    dealYear: 'dealYear' in overrides ? overrides.dealYear : parts.year,
    dealMonth: 'dealMonth' in overrides ? overrides.dealMonth : parts.month,
    dealDay: 'dealDay' in overrides ? overrides.dealDay : parts.day,
    dealAmount: overrides.dealAmount ?? 86000 + id * 100,
    dealType: id % 5 === 0 ? '직거래' : '중개거래',
    cancelDealDay: overrides.cancelDealDay ?? null,
    cancelDealType: overrides.cancelDealType ?? null,
    buyerType: '개인',
    sellerType: '개인',
  }
}

function rentRow(id, type = 'apt-rent', rentType = '전세', overrides = {}) {
  const identity = typeIdentities[type] ?? typeIdentities['apt-rent']
  const parts = dealParts(-2)
  const wolse = rentType === '월세'
  return {
    id,
    city: '서울특별시',
    district: '강남구',
    bjdCode: identity.bjdCode,
    dongName: identity.dongName,
    buildingName: identity.buildingName,
    buildYear: 2000,
    floor: (id % 18) + 1,
    exclusiveArea: overrides.exclusiveArea ?? 84.9,
    jibun: overrides.jibun ?? identity.jibun,
    roadName: overrides.roadName ?? identity.roadName,
    lat: 37.5,
    lng: 127.03,
    dealYear: parts.year,
    dealMonth: parts.month,
    dealDay: parts.day,
    rentType,
    deposit: overrides.deposit ?? (wolse ? 10000 : 62000),
    monthlyRent: wolse ? (overrides.monthlyRent ?? 120) : 0,
    contractTerm: 24,
    contractType: '신규',
    preDeposit: null,
    preMonthlyRent: null,
    useRenewalRight: null,
  }
}

function rowYmd(row) {
  if (row.dealDay == null) return null
  return `${row.dealYear}-${String(row.dealMonth).padStart(2, '0')}-${String(row.dealDay).padStart(2, '0')}`
}

function isEligibleSaleRow(row) {
  const ymd = rowYmd(row)
  if (!ymd) return false
  if (row.cancelDealDay != null || row.cancelDealType != null) return false
  return ymd <= kstDate(0)
}

function saleIneligibleRows(type, exclusiveArea) {
  const future = dealParts(7)
  return [
    saleRow(99_001, type, { exclusiveArea, dealAmount: 99001, cancelDealDay: 1, cancelDealType: '해제' }),
    saleRow(99_002, type, {
      exclusiveArea,
      dealAmount: 99002,
      dealYear: future.year,
      dealMonth: future.month,
      dealDay: future.day,
    }),
    saleRow(99_003, type, { exclusiveArea, dealAmount: 99003, dealDay: null }),
  ]
}

function rowsFor(type, mode, area = '84.90', deposit = null) {
  const numericArea = Number(area)
  if (mode === 'sale') {
    if (area === '84.91') {
      return Array.from({ length: 7 }, (_, index) =>
        saleRow(11_000 + index, type, {
          exclusiveArea: 84.91,
          dealAmount: index < 2 ? 91000 : 90000 + index * 120,
          jibun: index === 2 ? null : undefined,
        })
      )
    }
    return [
      ...Array.from({ length: 21 }, (_, index) =>
        saleRow(10_000 + index, type, {
          exclusiveArea: numericArea,
          dealAmount: index < 2 ? 87000 : 85000 + index * 75,
          jibun: index === 2 ? null : undefined,
        })
      ),
      ...saleIneligibleRows(type, numericArea),
    ].filter(isEligibleSaleRow)
  }
  if (mode === 'jeonse') {
    return Array.from({ length: 9 }, (_, index) =>
      rentRow(20_000 + index, type, '전세', {
        exclusiveArea: index === 0 ? 84.91 : numericArea,
        deposit: 61000 + index * 200,
      })
    )
  }
  const chosenDeposit = deposit == null ? 10000 : Number(deposit)
  if (![0, 10000].includes(chosenDeposit)) return []
  return Array.from({ length: chosenDeposit === 0 ? 6 : 8 }, (_, index) =>
    rentRow(30_000 + chosenDeposit + index, type, '월세', {
      exclusiveArea: numericArea,
      deposit: chosenDeposit,
      monthlyRent: chosenDeposit === 0 ? 160 + index : 120 + index,
    })
  )
}

function pointFromRow(row, mode) {
  const amount =
    mode === 'sale' ? row.dealAmount : mode === 'jeonse' ? row.deposit : row.monthlyRent
  return {
    id: row.id,
    date: `${row.dealYear}-${String(row.dealMonth).padStart(2, '0')}-${String(row.dealDay).padStart(2, '0')}`,
    amount,
    area: Number(row.exclusiveArea).toFixed(2),
    floor: row.floor,
    deposit: 'deposit' in row ? row.deposit : null,
  }
}

export function detailOverview(type, buildingName) {
  const info = baseBuilding(type, buildingName)
  if (info?.status === 503) return { status: 503 }
  if (!info) return { status: 404 }
  const ambiguous = buildingName === '모호아파트'
  return {
    identity: { bjdCode: info.bjdCode, buildingName },
    latestSale:
      buildingName === '회복빌라' && type.endsWith('-rent')
        ? null
        : {
            id: 9001,
            amount: 87000,
            year: info.latestDealYear,
            month: info.latestDealMonth,
            day: Number(kstDate(-2).slice(8, 10)),
            area: '84.90',
            floor: 10,
          },
    buildYear: 2000,
    minArea: '84.90',
    maxArea: '84.91',
    saleCount6m: 21,
    window6m: dateWindow(183),
    addresses: ambiguous
      ? [
          { dongName: info.dongName, jibun: '124', roadName: '테헤란로 200' },
          { dongName: info.dongName, jibun: '124-1', roadName: '테헤란로 200' },
        ]
      : [
          { dongName: info.dongName, jibun: info.jibun, roadName: info.roadName },
          { dongName: info.dongName, jibun: '124-1', roadName: null },
        ],
    location: ambiguous ? null : { lat: 37.5, lng: 127.03 },
    locationAmbiguous: ambiguous,
    generatedAt: isoAtKstNoon(),
  }
}

export function detailSnapshot(type, query) {
  const mode = query.get('mode') ?? (type.endsWith('-sale') ? 'sale' : 'jeonse')
  let area = query.get('area') ?? '84.90'
  let adjustment = null
  if (!['84.90', '84.91'].includes(area)) {
    area = '84.90'
    adjustment = 'area-reset'
  }
  let deposit = query.has('deposit')
    ? Number(query.get('deposit'))
    : mode === 'wolse'
      ? 10000
      : null
  if (mode === 'wolse' && ![0, 10000].includes(deposit)) {
    deposit = 10000
    adjustment = 'deposit-reset'
  }
  if (mode !== 'wolse') deposit = null
  const rows = rowsFor(type, mode, area, deposit)
  const pageRows = rows.slice(0, 20)
  const months = Number(query.get('months') ?? 0)
  const window = months === 0
    ? { from: rows.map(rowYmd).filter(Boolean).sort()[0] ?? kstDate(0), to: kstDate(0) }
    : dateWindow(months * 31)
  return {
    filters: {
      bjdCode: query.get('bjdCode') ?? typeIdentities[type]?.bjdCode ?? '1168010100',
      buildingName: query.get('buildingName') ?? typeIdentities[type]?.buildingName ?? '회복아파트',
      mode,
      months,
      area: rows.length > 0 ? area : null,
      deposit,
    },
    window,
    options: {
      areas: ['84.90', '84.91'],
      deposits:
        mode === 'wolse'
          ? [
              { amount: 0, count: 6 },
              { amount: 10000, count: 8 },
            ]
          : [],
    },
    points: rows.map((row) => pointFromRow(row, mode)),
    table: {
      items: pageRows,
      total: rows.length,
      page: 1,
      totalPages: Math.ceil(rows.length / 20),
    },
    generatedAt: isoAtKstNoon(),
    adjustment,
  }
}

export function detailPage(type, query) {
  const mode = query.get('mode') ?? (type.endsWith('-sale') ? 'sale' : 'jeonse')
  const area = query.get('area') ?? '84.90'
  const deposit = query.has('deposit')
    ? Number(query.get('deposit'))
    : mode === 'wolse'
      ? 10000
      : null
  const page = Number(query.get('page') ?? 1)
  const rows = rowsFor(type, mode, area, deposit)
  return {
    items: rows.slice((page - 1) * 20, page * 20),
    total: rows.length,
    page,
    totalPages: Math.ceil(rows.length / 20),
  }
}

export function homeMarket(city, district) {
  const label = district === 'gangnam' ? '강남구' : district === 'gangbuk' ? '강북구' : '전국'
  const daily = Array.from({ length: 30 }, (_, index) => ({
    date: kstDate(index - 29),
    count: (index % 5) + (district === 'gangbuk' ? 2 : 4),
  }))
  return {
    region: { city: city || null, district: district || null, label },
    window: dateWindow(30),
    generatedAt: isoAtKstNoon(),
    counts: {
      apt: {
        status: 'ok',
        data: { total: daily.reduce((sum, item) => sum + item.count, 0), daily },
      },
      villa: {
        status: 'ok',
        data: {
          total: 23,
          daily: daily.map((item) => ({ ...item, count: Math.max(0, item.count - 3) })),
        },
      },
      offitel: {
        status: 'ok',
        data: {
          total: 17,
          daily: daily.map((item) => ({ ...item, count: Math.max(0, item.count - 4) })),
        },
      },
    },
    recent: {
      status: 'ok',
      data: ['회복아파트', '회복빌라', '회복오피스텔', '이웃아파트', '강북회복아파트'].map(
        (buildingName, index) => ({
          type: index === 1 ? 'villa' : index === 2 ? 'offitel' : 'apt',
          transactionId: 70_000 + index,
          city: '서울특별시',
          district: label,
          bjdCode: '1168010100',
          buildingName,
          jibun: index === 1 ? null : '123',
          date: kstDate(-index),
          amount: 85000 + index * 1000,
          area: '84.90',
        })
      ),
    },
  }
}

export function homeDashboard() {
  return {
    total: 12345,
    buildingCount: 654,
    realEstateBuildings: { apt: 321, villa: 210, offitel: 123 },
    subscriptionActiveCount: 6,
    newlyListedToday: 3,
    realEstateTrends: [],
    realEstateHotspots: {
      apt: {
        sale: { rising: [], falling: [], active: [] },
        jeonse: { rising: [], falling: [], active: [] },
        wolse: { active: [] },
      },
    },
    trendingBuildings: { sale: [], jeonse: [], wolse: [] },
    subscriptionSummary: {
      closingThisWeek: 2,
      upcomingNextWeek: 4,
      avgSupplyPrice: 72000,
      imminent: [],
    },
  }
}

function subscriptionBase(id, overrides = {}) {
  const publicRent = id === 90002
  return {
    id,
    houseManageNo: `HM-${id}`,
    pblancNo: `PB-${id}`,
    sourceType: 'APT',
    houseName: publicRent ? '회복공공임대' : '회복청약 아파트',
    houseType: 'APT',
    houseDetailType: publicRent ? '공공임대' : '민영',
    rentType: publicRent ? '분양전환 가능임대' : '분양주택',
    regionName: '서울특별시 강남구',
    supplyLocation: '서울특별시 강남구 테헤란로 900',
    totalSupplyCount: publicRent ? 180 : 320,
    announcementDate: kstDate(-10),
    receptionStartDate: kstDate(-1),
    receptionEndDate: kstDate(3),
    specialStartDate: kstDate(-1),
    specialEndDate: kstDate(0),
    rank1AreaStartDate: kstDate(1),
    rank1AreaEndDate: kstDate(1),
    rank1OtherStartDate: kstDate(2),
    rank1OtherEndDate: kstDate(2),
    rank2AreaStartDate: kstDate(3),
    rank2AreaEndDate: kstDate(3),
    rank2OtherStartDate: kstDate(4),
    rank2OtherEndDate: kstDate(4),
    winnerDate: kstDate(20),
    contractStartDate: kstDate(30),
    contractEndDate: kstDate(35),
    moveInMonth: '202704',
    constructorName: '회복건설',
    developerName: '회복시행',
    homepage: 'https://www.applyhome.co.kr/',
    pblancUrl: `https://www.applyhome.co.kr/pblanc/${id}`,
    inquiryTel: '02-1234-9000',
    status: 'ongoing',
    lat: publicRent ? null : 37.51,
    lng: publicRent ? null : 127.04,
    createdAt: isoAtKstNoon(-20),
    updatedAt: isoAtKstNoon(-1),
    ...overrides,
  }
}

export function subscriptionList(query) {
  const category = query.get('category')
  const status = query.get('status') ?? 'ongoing'
  const rent = category === 'rent'
  const base = rent ? subscriptionBase(90002) : subscriptionBase(90001)
  const second = rent
    ? subscriptionBase(90012, { houseName: '회복장기임대', rentType: '분양전환 불가임대', status })
    : subscriptionBase(90011, { houseName: '회복오피스텔 청약', sourceType: 'OFFITEL', status })
  const third = rent
    ? subscriptionBase(90013, { houseName: '회복행복주택', rentType: '분양전환 불가임대', status })
    : subscriptionBase(90014, { houseName: '회복무순위 청약', sourceType: 'REMAINING', status })
  const items = [base, second, third].map((item) => ({ ...item, status }))
  return { items, total: items.length, page: 1, totalPages: 1 }
}

export function subscriptionDetail(id) {
  if (id === 999404) return { status: 404 }
  if (id === 999503) return { status: 503 }
  if (![90001, 90002].includes(id)) return { status: 404 }
  const sub = subscriptionBase(id)
  return {
    ...sub,
    unitTypes: [
      {
        id: id * 10 + 1,
        modelNo: '01',
        houseType: '084.9421A',
        supplyArea: '112.40',
        generalCount: 80,
        specialCount: 40,
        topAmount: id === 90002 ? null : 87000,
        newlywedsCount: 12,
        multiChildCount: 8,
        firstLifeCount: 10,
        elderlyCount: 4,
        institutionCount: 6,
        youthCount: null,
        newbornCount: null,
        transferCount: null,
        etcCount: null,
      },
      {
        id: id * 10 + 2,
        modelNo: '02',
        houseType: '059.9800B',
        supplyArea: '84.10',
        generalCount: 70,
        specialCount: 30,
        topAmount: id === 90002 ? null : 65000,
        newlywedsCount: 8,
        multiChildCount: 5,
        firstLifeCount: 7,
        elderlyCount: 3,
        institutionCount: 4,
        youthCount: null,
        newbornCount: null,
        transferCount: null,
        etcCount: null,
      },
    ],
    competitions: [
      {
        id: id * 100 + 1,
        modelNo: '01',
        houseType: '084.9421A',
        rank: 1,
        regionCode: '01',
        regionName: '해당지역',
        supplyCount: 80,
        applicantCount: 960,
        competitionRate: '12.0',
      },
      {
        id: id * 100 + 2,
        modelNo: '01',
        houseType: '084.9421A',
        rank: 1,
        regionCode: '02',
        regionName: '기타지역',
        supplyCount: 80,
        applicantCount: 640,
        competitionRate: '8.0',
      },
    ],
    scores: [
      {
        id: id * 1000 + 1,
        modelNo: '01',
        houseType: '084.9421A',
        regionCode: '01',
        regionName: '해당지역',
        minScore: '61',
        maxScore: '74',
        avgScore: '68',
      },
    ],
    specialStatuses: [
      {
        id: id * 10000 + 1,
        houseType: '084.9421A',
        resultName: '접수',
        specialSupplyCount: 40,
        newlywedsSupply: 12,
        multiChildSupply: 8,
        firstLifeSupply: 10,
        elderlySupply: 4,
        institutionSupply: 6,
        youthSupply: null,
        newbornSupply: null,
        transferSupply: null,
        newlywedsAreaCount: 120,
        multiChildAreaCount: 64,
        firstLifeAreaCount: 110,
        elderlyAreaCount: 18,
        youthAreaCount: null,
        newbornAreaCount: null,
        newlywedsOtherCount: 30,
        multiChildOtherCount: 12,
        firstLifeOtherCount: 24,
        elderlyOtherCount: 5,
        youthOtherCount: null,
        newbornOtherCount: null,
        institutionDecisionCount: 6,
        institutionPrepareCount: 3,
        transferCount: null,
      },
    ],
  }
}

export function rentalPriceStats() {
  return {
    jeonsae: { avgDeposit: 52000, count: 8 },
    wolse: { avgDeposit: 10000, avgMonthlyRent: 120, count: 6 },
    period: '최근 6개월',
  }
}
