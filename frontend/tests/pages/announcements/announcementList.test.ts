import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense } from 'vue'
import ListPage from '~/pages/public-rental/announcements/index.vue'

const mockState = {
  items: ref<any[]>([]),
  total: ref(0),
  totalPages: ref(1),
  loading: ref(false),
  error: ref<string | null>(null),
  fetchList: vi.fn(async () => {}),
}
vi.mock('~/composables/useRentalAnnouncements', () => ({
  useRentalAnnouncements: () => mockState,
}))

const setItemListSchema = vi.fn()
const setBreadcrumbSchema = vi.fn()
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setItemListSchema, setBreadcrumbSchema }),
}))

vi.stubGlobal('useHead', vi.fn())

const stubs = {
  NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
  Pagination: { template: '<nav />' },
  PublicRentalFilterTabs: true,
}

async function mountSuspended() {
  const wrapper = mount(
    defineComponent({ render() { return h(Suspense, null, { default: () => h(ListPage) }) } }),
    { global: { stubs } },
  )
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  mockState.items.value = [
    { pblancId: 'A-1', pblancNm: '공고 A', status: 'ongoing', variantCount: 1, beginDe: null, endDe: null },
    { pblancId: 'B-2', pblancNm: '공고 B', status: 'ongoing', variantCount: 1, beginDe: null, endDe: null },
  ]
})

describe('announcements 목록 구조화 데이터', () => {
  it('Breadcrumb 스키마를 설정한다', async () => {
    await mountSuspended()
    expect(setBreadcrumbSchema).toHaveBeenCalled()
  })

  it('목록 항목으로 ItemList 스키마를 설정한다', async () => {
    await mountSuspended()
    expect(setItemListSchema).toHaveBeenCalledWith([
      { name: '공고 A', url: '/public-rental/announcements/A-1', position: 1 },
      { name: '공고 B', url: '/public-rental/announcements/B-2', position: 2 },
    ])
  })
})
