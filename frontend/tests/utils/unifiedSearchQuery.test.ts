import { describe, expect, it } from 'vitest'
import { parseUnifiedSearchQuery, toUnifiedSearchQuery } from '~/utils/unifiedSearchQuery'

describe('unifiedSearchQuery', () => {
  it('legacy keyword를 정리하고 유효한 시설 탭 필터를 복원한다', () => {
    expect(parseUnifiedSearchQuery({
      keyword: ' 삼성 ',
      tab: 'facilities',
      facilityCategory: 'parking',
    })).toEqual({
      q: '삼성',
      tab: 'facilities',
      property: null,
      page: 1,
      facilityCategory: 'parking',
    })
  })

  it('q 키가 있으면 빈 값이어도 legacy keyword보다 우선한다', () => {
    expect(parseUnifiedSearchQuery({ q: '', keyword: '삼성' }).q).toBe('')
  })

  it('배열 쿼리의 첫 문자열만 사용하고 유효하지 않은 값은 기본값으로 정규화한다', () => {
    expect(parseUnifiedSearchQuery({
      q: [' 삼성 ', '잠실'],
      tab: 'invalid',
      property: 'store',
      page: '-2',
      facilityCategory: 'kiosk',
    })).toEqual({
      q: '삼성',
      tab: 'all',
      property: null,
      page: 1,
      facilityCategory: null,
    })
  })

  it('trash를 포함한 기존 시설 카테고리와 양의 정수 page를 허용한다', () => {
    expect(parseUnifiedSearchQuery({
      q: '강남',
      tab: 'facilities',
      page: '3',
      facilityCategory: 'trash',
    })).toEqual({
      q: '강남',
      tab: 'facilities',
      property: null,
      page: 3,
      facilityCategory: 'trash',
    })
  })

  it('기본값과 현재 탭에 속하지 않는 필드를 URL에서 제거한다', () => {
    expect(toUnifiedSearchQuery({
      q: ' 삼성 ',
      tab: 'facilities',
      property: 'apt',
      page: 4,
      facilityCategory: 'parking',
    })).toEqual({ q: '삼성', tab: 'facilities', facilityCategory: 'parking' })

    expect(toUnifiedSearchQuery({
      q: '',
      tab: 'all',
      property: 'villa',
      page: 1,
      facilityCategory: 'trash',
    })).toEqual({})
  })

  it('건물 탭의 유형과 2페이지 이상만 직렬화한다', () => {
    expect(toUnifiedSearchQuery({
      q: '잠실',
      tab: 'buildings',
      property: 'offitel',
      page: 2,
      facilityCategory: 'parking',
    })).toEqual({ q: '잠실', tab: 'buildings', property: 'offitel', page: '2' })
  })
})
