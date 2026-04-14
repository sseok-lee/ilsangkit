import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RentalPriceStatsBox from '~/components/subscription/RentalPriceStatsBox.vue'

// Mock $fetch
vi.stubGlobal('$fetch', vi.fn())

describe('RentalPriceStatsBox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('전세/월세 데이터를 올바르게 표시하는지 확인', async () => {
    const mockData = {
      jeonsae: {
        avgDeposit: 30000,
        count: 5,
      },
      wolse: {
        avgDeposit: 5000,
        avgMonthlyRent: 45,
        count: 8,
      },
      period: '2026.01~2026.04',
    }

    const $fetch = vi.mocked(globalThis.$fetch)
    $fetch.mockResolvedValue({ success: true, data: mockData })

    const wrapper = mount(RentalPriceStatsBox, {
      props: {
        subscriptionId: 1,
        regionName: '서울 강남구',
      },
      global: {
        mocks: {
          $fetch,
        },
      },
    })

    await flushPromises()

    // 제목 확인
    expect(wrapper.text()).toContain('📊 주변 아파트 전월세 시세')
    expect(wrapper.text()).toContain('2026.01~2026.04')

    // 전세 정보 확인
    expect(wrapper.text()).toContain('전세')
    expect(wrapper.text()).toContain('3억')
    expect(wrapper.text()).toContain('거래 5건')

    // 월세 정보 확인
    expect(wrapper.text()).toContain('월세')
    expect(wrapper.text()).toContain('5,000만원')
    expect(wrapper.text()).toContain('월 45만원')
    expect(wrapper.text()).toContain('거래 8건')
  })

  it('데이터가 없을 때(count=0) 회색 텍스트로 표시하는지 확인', async () => {
    const mockData = {
      jeonsae: {
        avgDeposit: null,
        count: 0,
      },
      wolse: {
        avgDeposit: null,
        avgMonthlyRent: null,
        count: 0,
      },
      period: '',
    }

    const $fetch = vi.mocked(globalThis.$fetch)
    $fetch.mockResolvedValue({ success: true, data: mockData })

    const wrapper = mount(RentalPriceStatsBox, {
      props: {
        subscriptionId: 1,
        regionName: '서울 강남구',
      },
      global: {
        mocks: {
          $fetch,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('해당 지역 시세 데이터가 없습니다')
    expect(wrapper.html()).toMatch(/text-slate-400/)
  })

  it('로딩 중일 때 skeleton UI를 표시하는지 확인', () => {
    const $fetch = vi.mocked(globalThis.$fetch)
    $fetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    const wrapper = mount(RentalPriceStatsBox, {
      props: {
        subscriptionId: 1,
        regionName: '서울 강남구',
      },
      global: {
        mocks: {
          $fetch,
        },
      },
    })

    // animate-pulse 클래스가 있는지 확인
    expect(wrapper.html()).toMatch(/animate-pulse/)
  })

  it('API 호출 시 올바른 subscriptionId를 전달하는지 확인', async () => {
    const mockData = {
      jeonsae: { avgDeposit: null, count: 0 },
      wolse: { avgDeposit: null, avgMonthlyRent: null, count: 0 },
      period: '',
    }

    const $fetch = vi.mocked(globalThis.$fetch)
    $fetch.mockResolvedValue({ success: true, data: mockData })

    mount(RentalPriceStatsBox, {
      props: {
        subscriptionId: 42,
        regionName: '서울 강남구',
      },
      global: {
        mocks: {
          $fetch,
        },
      },
    })

    await flushPromises()

    expect($fetch).toHaveBeenCalledWith(
      '/api/subscription/42/rental-price-stats',
      expect.objectContaining({
        method: 'GET',
      })
    )
  })
})
