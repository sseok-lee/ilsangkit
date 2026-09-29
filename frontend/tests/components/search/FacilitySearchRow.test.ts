import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FacilitySearchRow from '~/components/search/FacilitySearchRow.vue'
import type { Facility } from '~/types/facility'

function facility(overrides: Partial<Facility> = {}): Facility {
  return {
    id: 'parking-test',
    name: '검증주차장',
    category: 'parking',
    address: '서울 강남구',
    roadAddress: null,
    lat: 37.5,
    lng: 127,
    city: '서울',
    district: '강남구',
    extras: { feeType: '유료' },
    ...overrides,
  } as Facility
}

describe('FacilitySearchRow', () => {
  it('쓰레기 지역은 explicit waste-area destination으로 이동한다', () => {
    const w = mount(FacilitySearchRow, {
      props: {
        facility: facility({
          id: '7',
          category: 'trash',
          name: '역삼1동',
          address: null,
          roadAddress: null,
          lat: null,
          lng: null,
          destination: { kind: 'waste-area', href: '/trash/areas/7' },
        }),
      },
    })

    expect(w.get('a').attributes('href')).toBe('/trash/areas/7')
  })


  it('flag-off legacy trash source rows keep source detail links without a waste-area destination', () => {
    const w = mount(FacilitySearchRow, {
      props: {
        facility: facility({
          id: '10343',
          category: 'trash',
          name: '강남구 생활폐기물 배출',
          address: '서울 강남구',
          lat: 37.5,
          lng: 127,
        }),
      },
    })

    expect(w.get('a').attributes('href')).toBe('/trash/10343')
  })

  it('상세 링크 안에서 이름·주소·원본 유료 구분만 표시한다', () => {
    const w = mount(FacilitySearchRow, { props: { facility: facility() } })

    expect(w.get('a').attributes('href')).toBe('/parking/parking-test')
    expect(w.text()).toContain('검증주차장')
    expect(w.text()).toContain('서울 강남구')
    expect(w.text()).toContain('유료')
    expect(w.text()).not.toContain('0원')
    expect(w.text()).not.toContain('무료')
  })

  it('도서관 운영시간은 시작·종료 원본이 모두 있을 때만 범위로 만든다', () => {
    const complete = mount(FacilitySearchRow, {
      props: {
        facility: facility({
          category: 'library',
          extras: { weekdayOpenTime: '09:00', weekdayCloseTime: '18:00' },
        }),
      },
    })
    const incomplete = mount(FacilitySearchRow, {
      props: {
        facility: facility({
          category: 'library',
          extras: { weekdayOpenTime: '09:00' },
        }),
      },
    })

    expect(complete.text()).toContain('평일 09:00–18:00')
    expect(incomplete.text()).not.toContain('09:00')
    expect(incomplete.text()).not.toContain('18:00')
  })

  it('전화번호를 중첩 tel 링크가 아닌 행 링크 내부의 일반 텍스트로 표시한다', () => {
    const w = mount(FacilitySearchRow, {
      props: { facility: facility({ category: 'pharmacy', extras: { phone: '02-1234-5678' } }) },
    })

    expect(w.findAll('a')).toHaveLength(1)
    expect(w.find('a[href^="tel:"]').exists()).toBe(false)
    expect(w.text()).toContain('전화 02-1234-5678')
  })
})
