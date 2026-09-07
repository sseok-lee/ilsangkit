import { describe, it, expect } from 'vitest'
import { buildRealEstateDetailMeta, type DetailMetaInput } from '~/composables/useRealEstateDetailMeta'
import { formatKoreanPrice } from '~/utils/formatters'

const base: DetailMetaInput = {
  buildingName: '래미안대치팰리스',
  region: { city: '서울특별시', district: '강남구', dong: '대치동' },
  propertyType: 'apt',
  transactionMode: 'sale',
  summary: { totalCount: 312, recentDeal: { amount: 285000, dealDate: '2025.3' } },
  buildYear: 2015,
  areaRange: { min: 84, max: 114 },
  facilitySummary: '학교 4곳·병원 6곳',
}

describe('buildRealEstateDetailMeta - title', () => {
  it('브랜드 | 일상킷 가 1회 붙는다', () => {
    const { title } = buildRealEstateDetailMeta(base)
    expect(title.endsWith(' | 일상킷')).toBe(true)
    expect(title.match(/일상킷/g)).toHaveLength(1)
  })
  it('아파트도 타입어를 유지하고 지역과 브랜드를 뒤에 둔다', () => {
    expect(buildRealEstateDetailMeta(base).title).toBe('래미안대치팰리스 아파트 매매 실거래가·시세 | 서울 강남구 | 일상킷')
  })
  it('타이틀에 시세 인텐트가 포함된다', () => {
    expect(buildRealEstateDetailMeta(base).title).toContain('실거래가·시세')
  })
  it('빌라/오피스텔은 타입어를 유지한다', () => {
    const { title } = buildRealEstateDetailMeta({ ...base, buildingName: '역삼e편한세상', propertyType: 'villa', transactionMode: 'rent' })
    expect(title).toBe('역삼e편한세상 빌라 전월세 실거래가·시세 | 서울 강남구 대치동 | 일상킷')
  })
  // 회귀: 예전 22자 가드가 타입어를 조용히 지워, 같은 구의 동명이 빌라/오피스텔이
  // 아파트와 완전히 같은 title 을 갖게 만들었다(중복 문서 1건 추가 생산).
  it('이름이 길어도 타입어를 생략하지 않는다', () => {
    const { title } = buildRealEstateDetailMeta({ ...base, buildingName: '강남역푸르지오시티', propertyType: 'offitel', transactionMode: 'rent' })
    expect(title).toBe('강남역푸르지오시티 오피스텔 전월세 실거래가·시세 | 서울 강남구 대치동 | 일상킷')
  })
  it.each([
    ['apt', 'sale', '현대 아파트 매매 실거래가·시세 | 대전 동구 인동 | 일상킷'],
    ['apt', 'rent', '현대 아파트 전월세 실거래가·시세 | 대전 동구 인동 | 일상킷'],
    ['villa', 'sale', '현대 빌라 매매 실거래가·시세 | 대전 동구 인동 | 일상킷'],
    ['villa', 'rent', '현대 빌라 전월세 실거래가·시세 | 대전 동구 인동 | 일상킷'],
    ['offitel', 'sale', '현대 오피스텔 매매 실거래가·시세 | 대전 동구 인동 | 일상킷'],
    ['offitel', 'rent', '현대 오피스텔 전월세 실거래가·시세 | 대전 동구 인동 | 일상킷'],
  ] as const)('%s %s 상세는 단지명 뒤에 지역을 배치한다', (propertyType, transactionMode, expected) => {
    const { title } = buildRealEstateDetailMeta({
      ...base,
      buildingName: '현대',
      region: { city: '대전광역시', district: '동구', dong: '인동' },
      propertyType,
      transactionMode,
    })
    expect(title).toBe(expected)
  })
  it('지역 정보가 없으면 지역 세그먼트를 생략한다', () => {
    const { title } = buildRealEstateDetailMeta({ ...base, region: { city: '', district: '', dong: null } })
    expect(title).toBe('래미안대치팰리스 아파트 매매 실거래가·시세 | 일상킷')
  })
  it('도 단위 시도는 사이트 공용 축약형으로 표기한다 (경상남도 → 경남)', () => {
    const { title } = buildRealEstateDetailMeta({ ...base, region: { city: '경상남도', district: '창원시', dong: null } })
    expect(title).toContain(' | 경남 창원시 | ')
    expect(title).not.toContain('경상남 ')
  })
})

describe('buildRealEstateDetailMeta - description', () => {
  it('주변 생활시설(학교·병원)을 면적/마무리보다 앞에 배치한다', () => {
    const { description } = buildRealEstateDetailMeta(base)
    const facIdx = description.indexOf('주변 생활시설')
    const areaIdx = description.indexOf('면적별')
    expect(facIdx).toBeGreaterThan(-1)
    expect(facIdx).toBeLessThan(areaIdx)
    expect(description).toContain('학교 4곳·병원 6곳 등 주변 생활시설')
  })
  // 준공년도는 같은 이름·같은 구의 두 단지를 가르는 실데이터 토큰이라 다시 싣는다.
  it('준공년도를 description 에 싣는다', () => {
    expect(buildRealEstateDetailMeta(base).description).toContain('2015년 준공')
  })
  it('전체 길이 120자 이하', () => {
    expect(buildRealEstateDetailMeta(base).description.length).toBeLessThanOrEqual(120)
  })
  it('가격이 있어도 전용 면적 범위를 포함한다', () => {
    expect(buildRealEstateDetailMeta(base).description).toContain('전용 84~114㎡')
  })
  it('facilitySummary 없으면 "주변 생활시설과"로 일반화', () => {
    expect(buildRealEstateDetailMeta({ ...base, facilitySummary: null }).description).toContain('주변 생활시설과')
  })

  // 결함4: meta 가격 포맷을 헤더(utils formatKoreanPrice)와 동일 함수로 통일.
  // 억 단위(만원=0) 거래가는 "N억"으로만 표기 → 헤더와 완전 일치("N억원" 불일치 제거).
  it('억 단위 거래가는 헤더(utils formatKoreanPrice)와 동일하게 "N억"으로 표기한다', () => {
    const { description } = buildRealEstateDetailMeta({
      ...base,
      summary: { totalCount: 30, recentDeal: { amount: 50000, dealDate: '2026년 5월' } },
    })
    expect(description).toContain(`최근 ${formatKoreanPrice(50000)}(2026년 5월)`)
    expect(description).toContain('최근 5억(2026년 5월)')
    expect(description).not.toContain('5억원')
  })
})

describe('buildRealEstateDetailMeta - legacy cases (updated to new format)', () => {
  const legacyBase: DetailMetaInput = {
    buildingName: '새한A',
    region: { city: '광주', district: '북구', dong: '용봉동' },
    propertyType: 'apt',
    transactionMode: 'sale',
    buildYear: 1996,
    areaRange: { min: 60 },
    facilitySummary: '학교 5곳, 병원 12곳 등 생활시설',
    summary: null,
  }

  it('full payload — title has brand suffix and region segment', () => {
    const { title } = buildRealEstateDetailMeta({
      ...legacyBase,
      summary: {
        totalCount: 30,
        recentDeal: { amount: 10700, dealDate: '2026년 5월' },
      },
    })
    expect(title).toBe('새한A 아파트 매매 실거래가·시세 | 광주 북구 용봉동 | 일상킷')
  })

  it('full payload — description has 실거래 count and recent price', () => {
    const { description } = buildRealEstateDetailMeta({
      ...legacyBase,
      summary: {
        totalCount: 30,
        recentDeal: { amount: 10700, dealDate: '2026년 5월' },
      },
    })
    expect(description).toContain('광주 북구 용봉동 새한A 아파트 매매 실거래 30건')
    expect(description).toContain('1억 700만원(2026년 5월)')
    expect(description).toContain('전용 60㎡')
    expect(description).toContain('1996년 준공')
  })

  it('totalCount 0 — description omits count clause', () => {
    const { description } = buildRealEstateDetailMeta({
      ...legacyBase,
      summary: { totalCount: 0 },
    })
    expect(description).not.toMatch(/실거래 \d+건/)
    expect(description).toContain('면적별 시세를 함께 확인하세요')
  })

  it('buildYear null — description omits 준공', () => {
    const { description } = buildRealEstateDetailMeta({
      ...legacyBase,
      buildYear: null,
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(description).not.toContain('준공')
    expect(description).toContain('1억 700만원(2026년 5월)')
  })

  it('areaRange range — formats as min~max', () => {
    const { description } = buildRealEstateDetailMeta({
      ...legacyBase,
      areaRange: { min: 39, max: 59 },
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(description).toContain('전용 39~59㎡')
  })

  it('facilitySummary null — no "인근" but has 주변 생활시설과', () => {
    const { description } = buildRealEstateDetailMeta({
      ...legacyBase,
      facilitySummary: null,
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(description).not.toContain('인근')
    expect(description).toContain('주변 생활시설과')
  })

  it('all optionals missing — minimal description has 면적별 시세', () => {
    const { description } = buildRealEstateDetailMeta({
      buildingName: '새한A',
      region: { city: '광주', district: '북구' },
      propertyType: 'apt',
      transactionMode: 'sale',
      buildYear: null,
      areaRange: null,
      facilitySummary: null,
      summary: null,
    })
    expect(description).toContain('광주 북구 새한A 아파트 매매 실거래가')
    expect(description).toContain('주변 생활시설과')
    expect(description).toContain('면적별 시세를 함께 확인하세요')
  })

  it('rent mode — uses 전월세 label', () => {
    const { title, description } = buildRealEstateDetailMeta({
      ...legacyBase,
      transactionMode: 'rent',
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(title).toContain('전월세 실거래가')
    expect(description).toContain('전월세 실거래 30건')
  })

  it('villa — uses 빌라 label', () => {
    const { title } = buildRealEstateDetailMeta({
      ...legacyBase,
      propertyType: 'villa',
      summary: null,
    })
    expect(title).toContain('빌라')
  })

  it('offitel — uses 오피스텔 label', () => {
    const { title } = buildRealEstateDetailMeta({
      ...legacyBase,
      propertyType: 'offitel',
      summary: null,
    })
    expect(title).toContain('오피스텔')
  })
})
