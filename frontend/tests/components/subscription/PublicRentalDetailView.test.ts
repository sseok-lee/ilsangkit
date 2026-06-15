import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PublicRentalDetailView from '~/components/subscription/PublicRentalDetailView.vue'
import type { PublicRentalComplex } from '~/types/publicRental'

const baseRental: PublicRentalComplex = {
  id: 42,
  complexCode: 'lh-42',
  complexName: '서울특별시 강남구 역삼로 123',
  complexNameKor: '강남 매입임대 1단지',
  city: '서울특별시',
  district: '강남구',
  rentalType: '매입임대',
  houseType: '아파트',
  householdCount: 240,
  exclusiveArea: 49.5,
  commonArea: 12.3,
  depositAmount: 120_000_000,
  monthlyRent: 180_000,
  conversionDeposit: 5_000_000,
  landlordAgency: '한국토지주택공사(LH)',
  pnu: null,
  completionDate: '20180615',
  heatingMethod: '개별/도시가스',
  buildingStyle: '아파트',
  hasElevator: '있음',
  parkingCount: 280,
  lat: 37.5,
  lng: 127.04,
  sourceId: 'lh-42-매입임대-49.5',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-25T00:00:00Z',
}

const stubs = {
  ClientOnly: { template: '<div><slot /></div>' },
  FacilityMap: { template: '<div class="stub-map" />' },
  NearbyFacilities: { template: '<div class="stub-nearby-facilities" />' },
  AdBanner: { template: '<div class="stub-ad" />' },
}

describe('PublicRentalDetailView', () => {
  it('renders header, price card, spec grid, and rental type guide', () => {
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    const text = wrapper.text()
    expect(text).toContain('강남 매입임대 1단지')
    expect(text).toContain('매입임대')
    expect(text).toContain('보증금')
    expect(text).toContain('1억 2,000만원')
    expect(text).toContain('단지 정보')
    expect(text).toContain('전용면적')
    expect(text).toContain('49.5㎡')
    expect(text).toContain('자주 묻는 질문')
  })

  it('falls back to "정보없음" for null spec fields instead of hiding them', () => {
    const sparse: PublicRentalComplex = {
      ...baseRental,
      heatingMethod: null,
      hasElevator: null,
      buildingStyle: null,
      parkingCount: null,
      commonArea: null,
      completionDate: null,
    }
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: sparse, siblings: [], nearby: [] },
      global: { stubs },
    })
    const text = wrapper.text()
    // Spec labels still visible
    expect(text).toContain('난방방식')
    expect(text).toContain('승강기')
    expect(text).toContain('주차대수')
    expect(text).toContain('준공일')
    // Each null field shows the fallback string
    const occurrences = text.match(/정보없음/g) ?? []
    expect(occurrences.length).toBeGreaterThanOrEqual(6)
  })

  it('전세임대 매물(monthlyRent=0)에서 월 임대료를 "없음 (전세)"로 표시', () => {
    const jeonse: PublicRentalComplex = {
      ...baseRental,
      rentalType: '전세임대',
      monthlyRent: 0,
    }
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: jeonse, siblings: [], nearby: [] },
      global: { stubs },
    })
    const text = wrapper.text()
    expect(text).toContain('전세보증금')
    expect(text).toContain('없음 (전세)')
  })

  it('siblings가 비어있으면 단일 공급유형 안내 메시지를 표시 (섹션 숨기지 않음)', () => {
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('같은 단지 다른 평형/유형')
    expect(wrapper.text()).toContain('단일 공급유형')
  })

  it('lat/lng가 없을 때 지도 자리에 안내 메시지를 노출 (섹션 유지)', () => {
    const noCoords: PublicRentalComplex = { ...baseRental, lat: null, lng: null }
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: noCoords, siblings: [], nearby: [] },
      global: { stubs },
    })
    const text = wrapper.text()
    expect(text).toContain('위치')
    expect(text).toContain('좌표 정보가 등록되지 않아')
    expect(text).toContain('주변 생활시설')
  })

  it('renders rental-type guide section with summary text', () => {
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('매입임대 안내')
    expect(wrapper.text()).toContain('주요 특징')
    expect(wrapper.text()).toContain('신청 대상')
  })

  it('renders eligibility + apply guide + FAQ sections', () => {
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    const text = wrapper.text()
    expect(text).toContain('자격 요건과 신청 절차')
    expect(text).toContain('신청 바로가기')
    expect(text).toContain('LH 청약플러스')
    expect(text).toContain('마이홈 포털')
    expect(text).toContain('자주 묻는 질문')
  })

  it('단일 h1 불변식: literal h1이 정확히 1개다 (모바일 헤더가 소유)', () => {
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    expect(wrapper.findAll('h1')).toHaveLength(1)
  })

  it('데스크톱 헤더는 h1이 아니라 role="heading" aria-level="1"로 강등된다', () => {
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    const desktopHeading = wrapper.find('[role="heading"][aria-level="1"]')
    expect(desktopHeading.exists()).toBe(true)
    expect(desktopHeading.element.tagName).not.toBe('H1')
    expect(desktopHeading.text()).toContain('강남 매입임대 1단지')
  })

  it('모바일 공용 헤더가 보증금/월세/전용/세대 stat 칩을 노출한다', () => {
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    const text = wrapper.text()
    // stat 라벨
    expect(text).toContain('보증금')
    expect(text).toContain('월세')
    expect(text).toContain('전용')
    expect(text).toContain('세대')
    // stat 값 (보증금 1.2억, 세대 240)
    expect(text).toContain('1억 2,000만원')
    expect(text).toContain('240세대')
  })

  it('공유 pill 클릭이 크래시 없이 동작한다(navigator.share 폴백)', async () => {
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    const share = wrapper.find('[data-test="share-pill"]')
    expect(share.exists()).toBe(true)
    await expect(share.trigger('click')).resolves.not.toThrow()
  })

  it('AdBanner는 정확히 3개 유지된다 (재배치 후 개수 불변)', () => {
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    expect(wrapper.findAll('.stub-ad')).toHaveLength(3)
  })

  it('재배치: T1 가격카드(order-2)·위치(order-5)·FAQ(order-11)·출처(order-12) wrapper에 order 클래스가 있다', () => {
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    const html = wrapper.html()
    // 대표 order 토큰이 존재 (전체 스케일 중 일부 샘플)
    expect(html).toContain('order-2')   // 가격카드 (T1)
    expect(html).toContain('md:order-2')
    expect(html).toContain('order-12')  // 데이터 출처 wrapper (T6)
    expect(html).toContain('md:order-12')
  })

  it('재배치 후에도 핵심 섹션이 모두 렌더된다 (콘솔 에러 없음)', () => {
    const errSpy = vi.spyOn(console, 'error')
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    const text = wrapper.text()
    expect(text).toContain('가격 정보')
    expect(text).toContain('단지 정보')
    expect(text).toContain('위치')
    expect(text).toContain('주변 생활시설')
    expect(text).toContain('매입임대 안내')
    expect(text).toContain('자주 묻는 질문')
    expect(errSpy).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
