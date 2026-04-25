import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { usePublicRental } from '~/composables/usePublicRental'
import PublicRentalListView from '~/components/subscription/PublicRentalListView.vue'
import type { PublicRentalListResponse, PublicRentalComplex } from '~/types/publicRental'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)
vi.stubGlobal('useApiBase', () => 'http://localhost:8000')
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8000' } }))
vi.stubGlobal('usePublicRental', usePublicRental)

const sample: PublicRentalComplex = {
  id: 1, complexCode: 'a', complexName: '강남 매입임대',
  city: '서울특별시', district: '강남구', rentalType: '매입임대',
  houseType: '아파트', householdCount: 50, exclusiveArea: 59.96,
  depositAmount: 50_000_000, monthlyRent: 200_000,
  landlordAgency: 'LH', sourceId: 'lh-1',
  createdAt: '', updatedAt: '',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PublicRentalListView', () => {
  it('renders cards for fetched items', async () => {
    mockFetch.mockResolvedValue({
      success: true,
      data: {
        items: [sample],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      } as PublicRentalListResponse,
    })

    const wrapper = mount(PublicRentalListView, {
      global: {
        stubs: {
          SectionBlock: { template: '<section><slot /></section>' },
          Pagination: { template: '<nav />' },
          PublicRentalCard: { template: '<div class="card-stub">{{ rental.complexName }}</div>', props: ['rental'] },
        },
      },
    })
    await flushPromises()
    expect(wrapper.html()).toContain('강남 매입임대')
  })

  it('shows empty state when items is []', async () => {
    mockFetch.mockResolvedValue({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      } as PublicRentalListResponse,
    })

    const wrapper = mount(PublicRentalListView, {
      global: {
        stubs: {
          SectionBlock: { template: '<section><slot /></section>' },
          Pagination: { template: '<nav />' },
          PublicRentalCard: true,
        },
      },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('조건에 맞는 매물이 없습니다')
  })

  it('shows error block when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('boom'))
    const wrapper = mount(PublicRentalListView, {
      global: {
        stubs: {
          SectionBlock: { template: '<section><slot /></section>' },
          Pagination: { template: '<nav />' },
          PublicRentalCard: true,
        },
      },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('오류가 발생했습니다')
  })
})
