/**
 * 부동산 상세 meta 의 "문서 변별력" 회귀 테스트.
 *
 * 여기서 지키는 계약은 셋이다.
 * 1. 지역(시도·시군구·동)을 title 뒤에 유지해 같은 이름의 단지를 구별한다.
 * 2. 타입어(아파트/빌라/오피스텔)는 어떤 길이에서도 사라지지 않는다.
 * 3. 데이터가 0건이어도 지역·단지 실데이터만으로 문서가 서로 갈린다(URL·id 패딩 금지).
 */
import { describe, it, expect } from 'vitest'
import { buildRealEstateDetailMeta, type DetailMetaInput } from '~/composables/useRealEstateDetailMeta'

const 현대_강남: DetailMetaInput = {
  buildingName: '현대',
  region: { city: '서울특별시', district: '강남구', dong: '역삼동' },
  propertyType: 'villa',
  transactionMode: 'sale',
  summary: { totalCount: 12, recentDeal: { amount: 95000, dealDate: '2026년 6월' } },
  buildYear: 1998,
  areaRange: { min: 45, max: 72 },
  facilitySummary: '학교 3곳·병원 5곳',
}

const 현대_해운대: DetailMetaInput = {
  ...현대_강남,
  region: { city: '부산광역시', district: '해운대구', dong: '우동' },
  summary: { totalCount: 4, recentDeal: { amount: 31000, dealDate: '2026년 2월' } },
  buildYear: 1991,
  areaRange: { min: 59 },
  facilitySummary: '공원 2곳',
}

const 현대_서귀포: DetailMetaInput = {
  ...현대_강남,
  region: { city: '제주특별자치도', district: '서귀포시', dong: '동홍동' },
  summary: { totalCount: 27, recentDeal: { amount: 21500, dealDate: '2026년 7월' } },
  buildYear: 2004,
  areaRange: { min: 39, max: 84 },
  facilitySummary: '학교 1곳',
}

describe('title 변별력 — 같은 단지명, 다른 지역', () => {
  it('단지명·타입·거래 뒤에 지역과 브랜드를 배치한다', () => {
    const { title } = buildRealEstateDetailMeta({
      ...현대_강남,
      buildingName: '래미안강남',
      propertyType: 'apt',
      region: { city: '서울특별시', district: '강남구', dong: null },
    })
    expect(title).toBe('래미안강남 아파트 매매 실거래가·시세 | 서울 강남구 | 일상킷')
  })

  it("전국 '현대' 세 문서의 title 이 서로 다르다 (프로덕션 중복 사례)", () => {
    const titles = [현대_강남, 현대_해운대, 현대_서귀포].map(i => buildRealEstateDetailMeta(i).title)
    expect(new Set(titles).size).toBe(3)
  })

  it('같은 구 안 동명이 단지는 동(洞)으로 갈린다', () => {
    const 역삼 = buildRealEstateDetailMeta({ ...현대_강남, region: { city: '서울특별시', district: '강남구', dong: '역삼동' } })
    const 논현 = buildRealEstateDetailMeta({ ...현대_강남, region: { city: '서울특별시', district: '강남구', dong: '논현동' } })
    expect(역삼.title).not.toBe(논현.title)
    expect(역삼.title).toContain('역삼동')
    expect(논현.title).toContain('논현동')
  })

  it('단지명이 이미 동 이름을 품고 있으면 동을 중복해 넣지 않는다', () => {
    const { title } = buildRealEstateDetailMeta({
      ...현대_강남,
      buildingName: '역삼래미안',
      region: { city: '서울특별시', district: '강남구', dong: '역삼동' },
    })
    expect(title).toBe('역삼래미안 빌라 매매 실거래가·시세 | 서울 강남구 | 일상킷')
  })
})

describe('title 타입어 — 길이와 무관하게 유지', () => {
  const 긴이름 = '헬리오시티푸르지오써밋레지던스'

  it('긴 이름의 빌라와 아파트 title 이 서로 다르고 타입어가 남는다', () => {
    const apt = buildRealEstateDetailMeta({ ...현대_강남, buildingName: 긴이름, propertyType: 'apt' }).title
    const villa = buildRealEstateDetailMeta({ ...현대_강남, buildingName: 긴이름, propertyType: 'villa' }).title
    expect(apt).toContain('아파트')
    expect(villa).toContain('빌라')
    expect(apt).not.toBe(villa)
  })

  it('오피스텔도 긴 이름에서 타입어가 남는다', () => {
    const offitel = buildRealEstateDetailMeta({ ...현대_강남, buildingName: 긴이름, propertyType: 'offitel' }).title
    expect(offitel).toContain('오피스텔')
  })
})

describe('description 변별력', () => {
  it('같은 단지명·다른 지역·다른 데이터면 description 이 서로 다르다', () => {
    const descs = [현대_강남, 현대_해운대, 현대_서귀포].map(i => buildRealEstateDetailMeta(i).description)
    expect(new Set(descs).size).toBe(3)
  })

  it('거래 0건이어도 지역·동만으로 description 이 갈린다', () => {
    const zero = (input: DetailMetaInput): DetailMetaInput => ({
      ...input,
      summary: { totalCount: 0 },
      areaRange: null,
      facilitySummary: null,
      buildYear: null,
    })
    const descs = [현대_강남, 현대_해운대, 현대_서귀포].map(i => buildRealEstateDetailMeta(zero(i)).description)
    expect(new Set(descs).size).toBe(3)
    expect(descs[0]).toContain('서울 강남구 역삼동 현대')
    expect(descs[1]).toContain('부산 해운대구 우동 현대')
  })

  it('실데이터 토큰(거래건수·최근 거래가·전용면적)으로 채운다 — URL·id 패딩 없음', () => {
    const { description } = buildRealEstateDetailMeta(현대_해운대)
    expect(description).toContain('실거래 4건')
    expect(description).toContain('3억 1,000만원(2026년 2월)')
    expect(description).toContain('전용 59㎡')
    expect(description).not.toContain('http')
    expect(description).not.toContain('/real-estate')
  })

  it('120자 상한을 넘으면 준공년도부터 떨어뜨리되 지역·단지·거래 축은 남긴다', () => {
    const { description } = buildRealEstateDetailMeta({
      ...현대_서귀포,
      buildingName: '서귀포혁신도시엘에이치천년나무아파트',
      facilitySummary: '학교 4곳·병원 6곳·어린이집 9곳·공원 3곳',
    })
    expect(description.length).toBeLessThanOrEqual(120)
    expect(description).toContain('제주 서귀포시')
    expect(description).toContain('실거래 27건')
  })
})
