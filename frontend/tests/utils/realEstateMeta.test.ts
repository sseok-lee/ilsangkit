import { describe, it, expect } from 'vitest'
import { buildReRegionDescription, buildReCityDescription } from '~/utils/realEstateMeta'

describe('buildReRegionDescription (구·군 목록 설명문)', () => {
  it('데이터가 있으면 개수·대표단지·평균시세를 주입한다', () => {
    const d = buildReRegionDescription({
      cityName: '서울',
      districtName: '강남구',
      typeLabel: '아파트 매매',
      count: 1234,
      topComplexName: '은마아파트',
      topComplexTx: 56,
      avgPriceText: '25억 3,000만원',
    })
    expect(d).toContain('서울')
    expect(d).toContain('강남구')
    expect(d).toContain('아파트 매매')
    expect(d).toContain('1,234곳')
    expect(d).toContain('은마아파트')
    expect(d).toContain('56건')
    expect(d).toContain('25억 3,000만원')
    expect(d).toContain('국토교통부')
  })

  it('중복 보일러플레이트("유효 단지만 선별")를 더 이상 쓰지 않는다', () => {
    const d = buildReRegionDescription({
      cityName: '부산',
      districtName: '해운대구',
      typeLabel: '빌라 전월세',
      count: 88,
    })
    expect(d).not.toContain('유효 단지만 선별')
    expect(d).toContain('88곳')
  })

  it('대표단지/평균시세가 없어도 undefined 문자열이 새지 않는다', () => {
    const d = buildReRegionDescription({
      cityName: '대전',
      districtName: '유성구',
      typeLabel: '오피스텔 매매',
      count: 10,
    })
    expect(d).not.toMatch(/undefined|NaN/)
    expect(d).toContain('10곳')
  })

  it('count=0(빈 지역·noindex 대상)에서도 유효한 설명을 만든다', () => {
    const d = buildReRegionDescription({
      cityName: '세종',
      districtName: '세종시',
      typeLabel: '아파트 매매',
      count: 0,
    })
    expect(typeof d).toBe('string')
    expect(d.length).toBeGreaterThan(10)
    expect(d).not.toContain('유효 단지만 선별')
    expect(d).not.toMatch(/0곳|undefined|NaN/)
  })

  it('형제 구·군은 서로 다른 설명문을 만든다(중복 아님)', () => {
    const a = buildReRegionDescription({ cityName: '서울', districtName: '강남구', typeLabel: '아파트 매매', count: 1200, topComplexName: '은마아파트', topComplexTx: 56, avgPriceText: '25억' })
    const b = buildReRegionDescription({ cityName: '서울', districtName: '송파구', typeLabel: '아파트 매매', count: 900, topComplexName: '리센츠', topComplexTx: 40, avgPriceText: '22억' })
    expect(a).not.toBe(b)
  })
})

describe('buildReCityDescription (시 목록 설명문)', () => {
  it('구·군 개수와 대표단지를 주입한다', () => {
    const d = buildReCityDescription({
      cityName: '서울',
      typeLabel: '아파트 매매',
      districtCount: 25,
      topComplexName: '은마아파트',
    })
    expect(d).toContain('서울')
    expect(d).toContain('아파트 매매')
    expect(d).toContain('25개 구·군')
    expect(d).toContain('은마아파트')
    expect(d).toContain('국토교통부')
    expect(d).not.toContain('단지를 구/군별로 확인하세요. 국토교통부 공식 데이터 기반.')
  })

  it('대표단지가 없어도 undefined가 새지 않는다', () => {
    const d = buildReCityDescription({ cityName: '경기', typeLabel: '빌라 전월세', districtCount: 31 })
    expect(d).not.toMatch(/undefined|NaN/)
    expect(d).toContain('31개 구·군')
  })
})
