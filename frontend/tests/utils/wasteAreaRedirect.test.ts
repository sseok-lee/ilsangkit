import { describe, expect, it } from 'vitest'
import type { AreaDetail } from '~/types/wasteArea'
import { wasteAreaRedirectTarget } from '~/utils/wasteAreaRedirect'

const condition = (id: number, text: string): AreaDetail['schedules'][number] => ({
  schedule: {
    id,
    city: '서울특별시',
    district: '강남구',
    targetRegion: '역삼1동',
    emissionPlace: null,
    details: null,
  },
  scope: 'conditional',
  conditionText: text,
  evidence: [],
})

const areaDetail: AreaDetail = {
  generationId: 'fixture',
  area: {
    areaId: 1,
    name: '역삼1동',
    city: '서울특별시',
    district: '강남구',
    href: '/trash/areas/1',
    matchReason: 'exact',
    scheduleCount: 1,
    conditionalCount: 2,
    summary: '조건별 안내',
    dataDate: null,
  },
  schedules: [],
  unresolved: { count: 0, href: null },
  indexEligible: false,
  indexReason: 'shared source',
  contentUpdatedAt: null,
  predecessorOrSuccessorLinks: [],
}

describe('wasteAreaRedirectTarget', () => {
  it('dedupes several coverage rows for one source and carries an area return fragment', () => {
    const sameSource = { ...areaDetail, schedules: [condition(1001, '월'), condition(1001, '목'), condition(1001, '토')] }

    const target = wasteAreaRedirectTarget(sameSource)

    expect(target.split('#')[0]).toBe('/trash/1001')
    expect(decodeURIComponent(target.split('#from=')[1])).toBe('/trash?areaId=1')
  })

  it('uses the area-filtered source list for zero or multiple source ids', () => {
    expect(wasteAreaRedirectTarget(areaDetail)).toBe('/trash?areaId=1')
    expect(wasteAreaRedirectTarget({ ...areaDetail, schedules: [condition(1001, '월'), condition(1002, '수')] }))
      .toBe('/trash?areaId=1')
  })

  it('counts unique source ids rather than schedule rows', () => {
    const schedules = [condition(1001, '월'), condition(1001, '목'), condition(1002, '수')]

    expect(wasteAreaRedirectTarget({ ...areaDetail, schedules })).toBe('/trash?areaId=1')
  })

  it('does not derive destinations from area title or keyword-like content', () => {
    const renamed = {
      ...areaDetail,
      area: { ...areaDetail.area, name: '1001동', summary: '원문 7777 안내' },
    }

    expect(wasteAreaRedirectTarget(renamed)).toBe('/trash?areaId=1')
  })

  it('throws for malformed area ids or schedule entries instead of treating them as empty', () => {
    expect(() => wasteAreaRedirectTarget({ ...areaDetail, area: { ...areaDetail.area, areaId: 0 } })).toThrow(/areaId/)
    expect(() => wasteAreaRedirectTarget({
      ...areaDetail,
      schedules: [{ ...condition(1001, '월'), schedule: { ...condition(1001, '월').schedule, id: 0 } }],
    })).toThrow(/schedule id/)
  })
})
