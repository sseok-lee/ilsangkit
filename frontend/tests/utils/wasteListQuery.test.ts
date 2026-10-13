import { describe, expect, it } from 'vitest'
import { parseWasteListQuery, wasteAreaFilterHref, wasteListPathForQuery, wasteListRequestKey } from '~/utils/wasteListQuery'

describe('parseWasteListQuery', () => {
  it('parses areaId-only filters and defaults page/limit', () => {
    expect(parseWasteListQuery({ areaId: '2', keyword: '예미2길', page: '2' })).toEqual({
      areaId: 2,
      keyword: '예미2길',
      page: 2,
      limit: 20,
    })
  })

  it('round-trips regional unresolved source filters', () => {
    const parsed = parseWasteListQuery({
      city: 'seoul',
      district: '강남구',
      keyword: '역삼',
      coverage: 'unresolved',
      page: '3',
    })

    expect(parsed).toEqual({
      city: '서울특별시',
      district: '강남구',
      keyword: '역삼',
      coverage: 'unresolved',
      page: 3,
      limit: 20,
    })
    expect(wasteListPathForQuery('/trash', parsed)).toBe('/trash?city=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&district=%EA%B0%95%EB%82%A8%EA%B5%AC&keyword=%EC%97%AD%EC%82%BC&coverage=unresolved&page=3')
  })

  it('rejects duplicate areaId, areaId+coverage, and path/query region conflicts', () => {
    expect(() => parseWasteListQuery({ areaId: ['1', '2'] })).toThrow(/areaId query/)
    expect(() => parseWasteListQuery({ areaId: '2', coverage: 'unresolved' })).toThrow(/areaId.*coverage/)
    expect(() => parseWasteListQuery({ city: 'busan' }, { city: '서울특별시', district: '강남구' })).toThrow(/city query/)
    expect(() => parseWasteListQuery({ district: '서초구' }, { city: '서울특별시', district: '강남구' })).toThrow(/district query/)
  })

  it('serializes only supported filter keys and omits page 1/default limit', () => {
    expect(wasteListPathForQuery('/trash', {
      areaId: 123,
      keyword: '예미2길',
      page: 1,
      limit: 20,
    })).toBe('/trash?areaId=123&keyword=%EC%98%88%EB%AF%B82%EA%B8%B8')
    expect(wasteAreaFilterHref(123)).toBe('/trash?areaId=123')
  })
})

describe('wasteListRequestKey', () => {
  it('uses a fixed-order source-list key for every supported filter', () => {
    expect(wasteListRequestKey({
      city: '서울특별시',
      district: '강남구',
      areaId: 2,
      keyword: '예미2길',
      coverage: 'unresolved',
      page: 2,
      limit: 50,
    })).toBe('waste-list:{"city":"서울특별시","district":"강남구","areaId":2,"keyword":"예미2길","coverage":"unresolved","page":2,"limit":50}')
  })
})
