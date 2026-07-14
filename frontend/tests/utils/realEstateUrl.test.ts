import { describe, it, expect } from 'vitest'
import {
  REAL_ESTATE_URL_TYPES,
  isRealEstateUrlType,
  toRealEstateUrl,
  toRealEstateListUrl,
  toAbsoluteRealEstateUrl,
  toCitySlug,
  toDistrictSlug,
} from '../../utils/realEstateUrl'

describe('toCitySlug / toDistrictSlug (frontend)', () => {
  it('maps full names and short names to same slug', () => {
    expect(toCitySlug('서울특별시')).toBe('seoul')
    expect(toCitySlug('서울')).toBe('seoul')
    expect(toCitySlug('경기도')).toBe('gyeonggi')
    expect(toCitySlug('경기')).toBe('gyeonggi')
  })

  it('maps district names to slugs', () => {
    expect(toDistrictSlug('강남구')).toBe('gangnam')
    expect(toDistrictSlug('수원시 장안구')).toBe('suwon-jangan')
    expect(toDistrictSlug('세종시')).toBe('sejong')
  })

  it('falls back for unknown inputs', () => {
    expect(toCitySlug('Unknown')).toBe('unknown')
    expect(toDistrictSlug('Nowhere City')).toBe('nowhere-city')
  })
})

describe('toRealEstateUrl (frontend mirror)', () => {
  it('matches backend contract for canonical Seoul Gangnam apt-sale', () => {
    expect(
      toRealEstateUrl({
        type: 'apt-sale',
        city: '서울특별시',
        district: '강남구',
        buildingName: '래미안강남',
      }),
    ).toBe(
      `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('래미안강남')}`,
    )
  })

  it('sejong city produces /sejong/sejong/{bldg} (G3)', () => {
    expect(
      toRealEstateUrl({
        type: 'apt-rent',
        city: '세종특별자치시',
        district: '세종시',
        buildingName: '세종첫마을',
      }),
    ).toBe(
      `/real-estate/apt-rent/sejong/sejong/${encodeURIComponent('세종첫마을')}`,
    )
  })

  it('NFC normalizes NFD input', () => {
    const nfd = '래미안'.normalize('NFD')
    const url = toRealEstateUrl({
      type: 'apt-sale',
      city: '서울',
      district: '강남구',
      buildingName: nfd,
    })
    expect(url).toContain(encodeURIComponent('래미안'.normalize('NFC')))
    expect(url).not.toContain(encodeURIComponent(nfd))
  })

  it('all 6 types validate', () => {
    for (const t of REAL_ESTATE_URL_TYPES) {
      expect(isRealEstateUrlType(t)).toBe(true)
    }
    expect(isRealEstateUrlType('apt')).toBe(false)
  })
})

describe('toRealEstateListUrl / toAbsoluteRealEstateUrl (frontend)', () => {
  it('list url has no buildingName segment', () => {
    expect(toRealEstateListUrl({ type: 'villa-sale', city: '서울', district: '송파구' })).toBe(
      '/real-estate/villa-sale/seoul/songpa',
    )
  })

  it('absolute url prepends origin', () => {
    expect(
      toAbsoluteRealEstateUrl('https://ilsangkit.co.kr', {
        type: 'apt-sale',
        city: '서울',
        district: '강남구',
        buildingName: 'X',
      }),
    ).toBe(
      `https://ilsangkit.co.kr/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('X')}`,
    )
  })
})

describe('전남광주통합특별시 disambiguate (frontend)', () => {
  it('광주 자치구는 gwangju로', () => {
    expect(toRealEstateUrl({ type: 'apt-sale', city: '전남광주통합특별시', district: '서구', buildingName: '더샵염주센트럴파크' }))
      .toBe(`/real-estate/apt-sale/gwangju/seo/${encodeURIComponent('더샵염주센트럴파크')}`)
    expect(toRealEstateUrl({ type: 'apt-sale', city: '전남광주통합특별시', district: '광산구', buildingName: 'X' }))
      .toBe(`/real-estate/apt-sale/gwangju/gwangsan/${encodeURIComponent('X')}`)
  })

  it('전남 시·군은 jeonnam으로', () => {
    expect(toRealEstateUrl({ type: 'apt-sale', city: '전남광주통합특별시', district: '나주시', buildingName: '빛가람코오롱하늘채' }))
      .toBe(`/real-estate/apt-sale/jeonnam/naju/${encodeURIComponent('빛가람코오롱하늘채')}`)
    expect(toRealEstateListUrl({ type: 'apt-rent', city: '전남광주통합특별시', district: '여수시' }))
      .toBe('/real-estate/apt-rent/jeonnam/yeosu')
  })

  it('citySlug 세그먼트에 한글을 남기지 않는다 (404 방지)', () => {
    const url = toRealEstateUrl({ type: 'apt-sale', city: '전남광주통합특별시', district: '서구', buildingName: 'X' })
    expect(url).not.toContain('전남광주통합특별시')
    expect(url.split('/')[3]).toMatch(/^[a-z]+$/)
  })

  it('일반 도시(부산 서구)는 통합시 아니라 영향 없음', () => {
    expect(toRealEstateListUrl({ type: 'apt-sale', city: '부산광역시', district: '서구' }))
      .toBe('/real-estate/apt-sale/busan/seo')
  })
})
