import { describe, expect, it } from 'vitest'
import { buildFacilityListHead } from '~/utils/facilityListHead'
import { shouldNoindexFacilityList } from '~/utils/facilityListRobots'

const canonicalHref = 'https://ilsangkit.co.kr/toilet'

describe('facility list explicit query URL policy', () => {
  for (const key of ['lat', 'lng', 'q']) {
    it.each(['37.5', '', '  ', null, ['a', 'b'], [null, ''], '%broken'].map(value => [value]))('%s: key presence excludes even blank/repeated/malformed values', (value) => {
      const input = { page: 1, query: { [key]: value }, canonicalHref }
      expect(shouldNoindexFacilityList(input)).toBe(true)
      const head = buildFacilityListHead(input)
      expect(head.meta).toEqual([{ name: 'robots', content: 'noindex, follow' }])
      expect(head.link).toBeUndefined()
    })
  }

  it.each([{}, { city: 'seoul' }, { district: 'gangnam' }, { city: 'seoul', district: 'gangnam' }, { schedule: '13343' }, { unrelated: 'value' }])('preserves stable and unrelated query policy: %j', (query) => {
    expect(buildFacilityListHead({ page: 1, query, canonicalHref }).link)
      .toEqual([{ rel: 'canonical', href: canonicalHref, key: 'canonical' }])
  })

  it('preserves page/keyword conditions with schedule', () => {
    for (const input of [{ page: 2 }, { page: 1, keyword: 'test' }]) {
      expect(buildFacilityListHead({ ...input, query: { schedule: '13343' }, canonicalHref }).link).toBeUndefined()
    }
    expect(shouldNoindexFacilityList({ page: 1, keyword: '  ' })).toBe(false)
  })
})
