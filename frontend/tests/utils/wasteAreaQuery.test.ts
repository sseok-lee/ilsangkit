import { describe, expect, it } from 'vitest'
import { parseWasteAreaQuery, wasteAreaPathForQuery, wasteAreaRequestKey, wasteSourceScheduleQuery } from '~/utils/wasteAreaQuery'

describe('parseWasteAreaQuery', () => {
  it('defaults only a missing page to 1', () => {
    expect(parseWasteAreaQuery({ city: 'seoul', district: '강남구' })).toMatchObject({
      city: '서울특별시',
      district: '강남구',
      page: 1,
      limit: 20,
    })
  })

  it('rejects malformed page values instead of normalizing them to page 1', () => {
    for (const page of ['0', '-1', 'abc', '1.5', '', null, '9007199254740993']) {
      expect(() => parseWasteAreaQuery({ page })).toThrow(/page query/)
    }
  })

  it('rejects duplicated array query values', () => {
    expect(() => parseWasteAreaQuery({ city: ['seoul', 'busan'] })).toThrow(/city query/)
    expect(() => parseWasteAreaQuery({ keyword: ['역삼', '삼성'] })).toThrow(/keyword query/)
  })

  it('rejects district without city and overlong keyword', () => {
    expect(() => parseWasteAreaQuery({ district: '강남구' })).toThrow(/district/)
    expect(() => parseWasteAreaQuery({ keyword: '가'.repeat(101) })).toThrow(/100/)
  })
})

describe('wasteAreaRequestKey', () => {
  it('keeps page and keyword in the async-data key', () => {
    const a = { city: '서울특별시', district: '강남구', keyword: '역삼', page: 1, limit: 20 }
    expect(wasteAreaRequestKey(a)).not.toBe(wasteAreaRequestKey({ ...a, page: 2 }))
    expect(wasteAreaRequestKey(a)).not.toBe(wasteAreaRequestKey({ ...a, keyword: '삼성' }))
  })

  it('keeps city and district in the async-data key', () => {
    const a = { city: '서울특별시', district: '강남구', page: 1, limit: 20 }
    expect(wasteAreaRequestKey(a)).not.toBe(wasteAreaRequestKey({ ...a, city: '부산광역시' }))
    expect(wasteAreaRequestKey(a)).not.toBe(wasteAreaRequestKey({ ...a, district: '서초구' }))
  })

  it('does not collide with literal sentinel-like values', () => {
    expect(wasteAreaRequestKey({ city: 'all', page: 1, limit: 20 })).not.toBe(wasteAreaRequestKey({ page: 1, limit: 20 }))
    expect(wasteAreaRequestKey({ keyword: 'none', page: 1, limit: 20 })).not.toBe(wasteAreaRequestKey({ page: 1, limit: 20 }))
  })
})

describe('wasteAreaPathForQuery', () => {
  it('builds real URLs for search and pagination while omitting page 1', () => {
    const query = { city: '서울특별시', district: '강남구', keyword: '역삼', page: 1, limit: 20 }
    expect(wasteAreaPathForQuery('/trash', query)).toBe('/trash?city=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&district=%EA%B0%95%EB%82%A8%EA%B5%AC&keyword=%EC%97%AD%EC%82%BC')
    expect(wasteAreaPathForQuery('/trash', { ...query, page: 2 })).toContain('page=2')
  })
})

describe('wasteSourceScheduleQuery', () => {
  it('preserves district for unresolved /trash source fetch params', () => {
    const params = wasteSourceScheduleQuery({
      city: '서울특별시',
      district: '강남구',
      coverage: 'unresolved',
      page: 2,
      limit: 20,
    })

    expect(params).toEqual({ city: '서울특별시', district: '강남구', coverage: 'unresolved', page: 2, limit: 20 })
  })

  it('preserves keyword for regional unresolved source fetch params', () => {
    const params = wasteSourceScheduleQuery({
      city: '서울특별시',
      district: '강남구',
      keyword: '역삼',
      coverage: 'unresolved',
      page: 1,
      limit: 20,
    })

    expect(params).toEqual({ city: '서울특별시', district: '강남구', keyword: '역삼', coverage: 'unresolved', page: 1, limit: 20 })
  })
})
