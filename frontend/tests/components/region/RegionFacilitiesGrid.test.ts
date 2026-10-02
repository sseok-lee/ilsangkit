import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RegionFacilitiesGrid from '~/components/region/RegionFacilitiesGrid.vue'

const facilities = [
  {
    id: 'parking-1',
    name: '강남 공영주차장',
    category: 'parking' as const,
    address: '서울특별시 강남구 테헤란로 1',
    roadAddress: '서울특별시 강남구 테헤란로 1',
    lat: 37.5,
    lng: 127.0,
    city: '서울특별시',
    district: '강남구',
    distance: 120,
    extras: { capacity: 80, feeType: '무료' },
  },
]

const baseProps = {
  categoryName: '공영주차장',
  districtName: '강남구',
  total: 1,
  loading: false,
  error: null,
  facilities,
  currentPage: 1,
  totalPages: 1,
  categorySlug: 'parking',
}

const globalConfig = {
  stubs: {
    SectionBlock: { template: '<section><header><slot name="right" /></header><slot /></section>', props: ['heading', 'subtext'] },
    Pagination: { template: '<nav data-testid="pagination" />', props: ['currentPage', 'totalPages', 'hrefFor'] },
    EmptyState: { template: '<div data-testid="empty"><slot /></div>', props: ['title', 'description'] },
    CategoryIcon: { template: '<span data-testid="category-icon" />', props: ['categoryId', 'size'] },
    OperatingStatusBadge: { template: '<span data-testid="status" />', props: ['status'] },
  },
}

describe('RegionFacilitiesGrid', () => {
  it('기본 variant 는 기존 카드 렌더를 유지한다', () => {
    const wrapper = mount(RegionFacilitiesGrid, {
      props: baseProps,
      global: {
        stubs: {
          ...globalConfig.stubs,
          FacilityCard: { template: '<article class="facility-card">{{ facility.name }}</article>', props: ['facility'] },
        },
      },
    })

    expect(wrapper.findAll('.facility-card')).toHaveLength(1)
    expect(wrapper.find('[data-testid="facility-row"]').exists()).toBe(false)
  })

  it('rows variant 는 지역 카테고리 시설 상세 링크와 주요 정보를 행으로 보여준다', () => {
    const wrapper = mount(RegionFacilitiesGrid, {
      props: { ...baseProps, variant: 'rows' },
      global: globalConfig,
    })

    const row = wrapper.get('[data-testid="facility-row"]')
    expect(row.attributes('href')).toBe('/parking/parking-1')
    expect(row.text()).toContain('강남 공영주차장')
    expect(row.text()).toContain('서울특별시 강남구 테헤란로 1')
    expect(row.text()).toContain('120m')
    expect(row.text()).toContain('80면')
  })

  it('rows variant 빈 결과는 컴포넌트 소유 빈 상태만 한 번 보여준다', () => {
    const wrapper = mount(RegionFacilitiesGrid, {
      props: { ...baseProps, facilities: [], total: 0, variant: 'rows' },
      global: globalConfig,
    })

    expect(wrapper.findAll('[data-testid="empty"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="facility-row"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('검색 결과가 없습니다')
  })

  it('평면 섹션 + 제목 옆 개수 글자 "N곳"(알약 배지 없음)', () => {
    const wrapper = mount(RegionFacilitiesGrid, {
      props: { ...baseProps, total: 2431 },
      global: { stubs: { ...globalConfig.stubs, FacilityCard: { template: '<article />', props: ['facility'] } } },
    })
    expect(wrapper.get('section').attributes('variant')).toBe('flat')
    expect(wrapper.html()).not.toMatch(/rounded-full bg-primary\/10|slate-/)
    expect(wrapper.text()).toContain('2,431곳')
  })
})
