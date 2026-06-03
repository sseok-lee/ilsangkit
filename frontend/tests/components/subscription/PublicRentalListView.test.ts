import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense } from 'vue'
import { usePublicRental } from '~/composables/usePublicRental'
import PublicRentalListView from '~/components/subscription/PublicRentalListView.vue'
import type { PublicRentalListResponse, PublicRentalComplex } from '~/types/publicRental'

// RegionCascadingDropdown stub: exposes city/district selects via update:city / update:district emits
vi.mock('~/components/common/RegionCascadingDropdown.vue', () => ({
  default: defineComponent({
    name: 'RegionCascadingDropdown',
    props: ['city', 'district', 'cityValueMode'],
    emits: ['update:city', 'update:district'],
    template: `<div>
      <select data-testid="city-select" :value="city" @change="$emit('update:city', $event.target.value); $emit('update:district', '')">
        <option value="">전국</option>
        <option value="seoul">서울</option>
      </select>
      <select data-testid="district-select" :value="district" :disabled="!city" @change="$emit('update:district', $event.target.value)">
        <option value="">전체</option>
      </select>
    </div>`,
  }),
}))

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)
vi.stubGlobal('useApiBase', () => 'http://localhost:8000')
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8000' } }))
vi.stubGlobal('usePublicRental', usePublicRental)

// 컴포넌트가 useAsyncData(handler)로 SSR 시딩하므로 핸들러를 실제 실행시킨다
vi.stubGlobal('useAsyncData', (_key: string, handler: () => Promise<unknown>, opts?: { default?: () => unknown }) => {
  const data = ref<unknown>(opts?.default ? opts.default() : null)
  const error = ref<unknown>(null)
  const result = { data, pending: ref(false), error, refresh: vi.fn() }
  const p = handler()
    .then((r) => { data.value = r; return result })
    .catch((e) => { error.value = e; return result })
  return Object.assign(p, result)
})

const sample: PublicRentalComplex = {
  id: 1, complexCode: 'a', complexName: '강남 매입임대',
  city: '서울특별시', district: '강남구', rentalType: '매입임대',
  houseType: '아파트', householdCount: 50, exclusiveArea: 59.96,
  depositAmount: 50_000_000, monthlyRent: 200_000,
  landlordAgency: 'LH', sourceId: 'lh-1',
  createdAt: '', updatedAt: '',
}

// Helper to mount async components with Suspense
async function mountSuspended(props: Record<string, unknown> = {}, globalOpts?: Record<string, unknown>) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, {
          default: () => h(PublicRentalListView, props),
        })
      },
    }),
    { global: globalOpts },
  )
  await flushPromises()
  return wrapper
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

    const wrapper = await mountSuspended({}, {
      stubs: {
        SectionBlock: { template: '<section><slot /></section>' },
        Pagination: { template: '<nav />' },
        PublicRentalCard: { template: '<div class="card-stub">{{ rental.complexName }}</div>', props: ['rental'] },
      },
    })
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

    const wrapper = await mountSuspended({}, {
      stubs: {
        SectionBlock: { template: '<section><slot /></section>' },
        Pagination: { template: '<nav />' },
        PublicRentalCard: true,
      },
    })
    expect(wrapper.text()).toContain('조건에 맞는 매물이 없습니다')
  })

  it('필터 변경 reload 실패 시 에러 블록을 표시한다', async () => {
    mockFetch.mockResolvedValueOnce({
      success: true,
      data: { items: [], pagination: { page: 1, limit: 18, total: 0, totalPages: 0 } } as PublicRentalListResponse,
    })
    const wrapper = await mountSuspended({}, {
      stubs: {
        SectionBlock: { template: '<section><slot /></section>' },
        Pagination: { template: '<nav />' },
        PublicRentalCard: true,
      },
    })

    mockFetch.mockRejectedValueOnce(new Error('boom'))
    await wrapper.find('[data-testid="city-select"]').setValue('seoul')
    await flushPromises()

    expect(wrapper.text()).toContain('데이터를 불러오는 중 오류가 발생했습니다')
  })
})
