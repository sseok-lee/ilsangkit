import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import SubscriptionListView from '~/components/subscription/SubscriptionListView.vue'
import type { Subscription } from '~/types/subscription'
import type { SubscriptionListFilters } from '~/types/subscriptionList'

const applyFilters = vi.fn()
const resetFilters = vi.fn()
const loadMore = vi.fn()
const retry = vi.fn()
const saveForDetail = vi.fn()

const filters = ref<SubscriptionListFilters>({
  q: '',
  city: '',
  district: '',
  status: 'all',
  sort: 'priority',
})
const items = ref<Subscription[]>([])
const total = ref(0)
const page = ref(1)
const totalPages = ref(1)
const pending = ref(false)
const pendingMore = ref(false)
const error = ref<string | null>(null)
const moreError = ref<string | null>(null)
const keywordError = ref<string | null>(null)
const regionError = ref<string | null>(null)

vi.mock('~/composables/useSubscriptionList', () => ({
  useSubscriptionList: vi.fn(async () => ({
    filters,
    items,
    total,
    page,
    totalPages,
    pending,
    pendingMore,
    error,
    moreError,
    keywordError,
    regionError,
    firstFetchedAt: ref(Date.now()),
    applyFilters,
    resetFilters,
    loadMore,
    retry,
    saveForDetail,
  })),
}))

function notice(id: number, regionName = '서울특별시 강남구'): Subscription {
  return {
    id,
    houseManageNo: `HM-${id}`,
    pblancNo: `PB-${id}`,
    sourceType: 'APT',
    houseName: `테스트 청약 ${id}`,
    houseType: 'APT',
    houseDetailType: null,
    rentType: null,
    regionName,
    supplyLocation: regionName,
    totalSupplyCount: id === 1 ? 0 : null,
    announcementDate: null,
    receptionStartDate: '2026-09-24',
    receptionEndDate: null,
    specialStartDate: null,
    specialEndDate: null,
    rank1AreaStartDate: null,
    rank1AreaEndDate: null,
    rank1OtherStartDate: null,
    rank1OtherEndDate: null,
    rank2AreaStartDate: null,
    rank2AreaEndDate: null,
    rank2OtherStartDate: null,
    rank2OtherEndDate: null,
    winnerDate: null,
    contractStartDate: null,
    contractEndDate: null,
    moveInMonth: null,
    constructorName: null,
    developerName: null,
    homepage: null,
    pblancUrl: null,
    inquiryTel: null,
    status: 'ongoing',
    publicRental: null,
  }
}

const global = {
  stubs: {
    NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
    AdBanner: { template: '<div data-testid="ad-slot" />' },
    RegionCascadingDropdown: { template: '<div data-testid="region-filter" />', props: ['city', 'district'] },
    DataSourceSection: { template: '<div data-testid="source" />' },
  },
}

function mountList(props: { scope: { category: 'sale' | 'rent' } }) {
  return mount({
    components: { SubscriptionListView },
    template: '<Suspense><SubscriptionListView v-bind="props" /></Suspense>',
    setup: () => ({ props }),
  }, { global, attachTo: document.body })
}

describe('SubscriptionListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    filters.value = { q: '', city: '', district: '', status: 'all', sort: 'priority' }
    items.value = [notice(1), notice(2, '경기도 수원시')]
    total.value = 42
    page.value = 1
    totalPages.value = 3
    pending.value = false
    pendingMore.value = false
    error.value = null
    moreError.value = null
    keywordError.value = null
    regionError.value = null
  })

  it('공급유형은 링크 세그먼트, 접수 상태는 라디오 세그먼트다', async () => {
    const wrapper = mountList({ scope: { category: 'sale' } })
    await flushPromises()

    const typeNav = wrapper.get('[aria-label="공급유형"]')
    expect(typeNav.findAll('a').length).toBeGreaterThan(1)
    expect(typeNav.find('a[aria-current="page"]').exists()).toBe(true)
    const statusGroup = wrapper.get('[aria-label="접수 상태"]')
    const radios = statusGroup.findAll('[role="radio"]')
    expect(radios.length).toBeGreaterThan(1)
    expect(radios.filter((r) => r.attributes('aria-checked') === 'true')).toHaveLength(1)

    await radios[1].trigger('click')
    expect(applyFilters).toHaveBeenCalledWith({ status: 'ongoing' })
  })

  it('renders current input from state without querying while typing', async () => {
    const wrapper = mountList({ scope: { category: 'sale' } })
    await flushPromises()

    await wrapper.get('#subscription-keyword').setValue('서울')

    expect(applyFilters).not.toHaveBeenCalled()
    expect(wrapper.find('#subscription-results').exists()).toBe(true)
    expect(wrapper.text()).toContain('42건')
  })

  it('hides stale result counts while a new filter result is pending', async () => {
    const wrapper = mountList({ scope: { category: 'sale' } })
    await flushPromises()

    expect(wrapper.get('#subscription-results').text()).toContain('총 42건')
    expect(wrapper.get('section.subscription-list').text()).toContain('총 42건')

    pending.value = true
    await wrapper.vm.$nextTick()

    expect(wrapper.get('#subscription-results').text()).not.toContain('총 42건')
    expect(wrapper.get('section.subscription-list').text()).not.toContain('20건 표시')
    expect(wrapper.get('section.subscription-list').text()).not.toContain('총 42건')
    expect(wrapper.findAll('[data-testid="list-skeleton"]')).toHaveLength(5)
  })

  it('hides stale result counts and accessible title text on first-page errors', async () => {
    const wrapper = mountList({ scope: { category: 'rent' } })
    await flushPromises()

    expect(wrapper.get('#subscription-results').text()).toContain('총 42건')

    error.value = '청약 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
    await wrapper.vm.$nextTick()

    expect(wrapper.get('#subscription-list-title').text()).toBe('조회 결과를 불러오지 못했습니다')
    expect(wrapper.get('#subscription-results').text()).not.toContain('42건')
    expect(wrapper.get('section.subscription-list').text()).not.toContain('총 42건')
    expect(wrapper.get('[role="alert"]').text()).toContain('잠시 후 다시 시도해 주세요')
  })

  it('hides stale counts for keyword and region errors', async () => {
    const wrapper = mountList({ scope: { category: 'sale' } })
    await flushPromises()

    keywordError.value = '검색어는 100자 이하로 입력해 주세요.'
    await wrapper.vm.$nextTick()
    expect(wrapper.get('#subscription-list-title').text()).toBe('검색 조건을 확인해 주세요')
    expect(wrapper.get('#subscription-results').text()).not.toContain('42건')

    keywordError.value = null
    regionError.value = '지역 정보를 불러오지 못했습니다.'
    await wrapper.vm.$nextTick()
    expect(wrapper.get('#subscription-list-title').text()).toBe('지역 정보를 확인할 수 없습니다')
    expect(wrapper.get('#subscription-results').text()).not.toContain('42건')
  })

  it('keeps the reset control a non-wrapping 44px target at tablet width', async () => {
    const wrapper = mountList({ scope: { category: 'sale' } })
    await flushPromises()

    const reset = wrapper.get('[data-testid="reset-filters"]')
    const src = readFileSync(resolve(process.cwd(), 'components/subscription/SubscriptionListView.vue'), 'utf8')
    const resetBlock = src.match(/\.reset\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? ''

    expect(reset.classes()).toContain('reset')
    expect(reset.text()).toBe('조건 초기화')
    expect(resetBlock).toContain('min-height: 44px')
    expect(resetBlock).toContain('white-space: nowrap')
    expect(resetBlock).toMatch(/min-width:\s*(9[2-9]|[1-9]\d{2,})px/)
  })

  it('submits search, retries load-more failure, resets filters, and saves before detail navigation', async () => {
    const wrapper = mountList({ scope: { category: 'sale' } })
    await flushPromises()

    await wrapper.get('#subscription-keyword').setValue('강남')
    await wrapper.get('form').trigger('submit')
    expect(applyFilters).toHaveBeenCalledWith({ q: '강남' })

    moreError.value = '추가 공고를 불러오지 못했습니다.'
    await wrapper.vm.$nextTick()
    expect(wrapper.get('#subscription-results').text()).toContain('총 42건')
    await wrapper.get('[data-testid="load-more-retry"]').trigger('click')
    expect(loadMore).toHaveBeenCalledTimes(1)

    await wrapper.get('[data-testid="reset-filters"]').trigger('click')
    expect(resetFilters).toHaveBeenCalledTimes(1)

    await wrapper.get('a[href="/subscription/1"]').trigger('click')
    expect(saveForDetail).toHaveBeenCalledTimes(1)
  })

  it('mounts two ads only for unfiltered successful listings and keeps them stable on load more', async () => {
    const wrapper = mountList({ scope: { category: 'rent' } })
    await flushPromises()

    expect(wrapper.findAll('[data-testid="ad-slot"]')).toHaveLength(2)
    await wrapper.get('[data-testid="load-more"]').trigger('click')
    expect(loadMore).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('[data-testid="ad-slot"]')).toHaveLength(2)

    filters.value = { ...filters.value, city: '서울특별시' }
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-testid="ad-slot"]')).toHaveLength(0)

    filters.value = { q: '', city: '', district: '', status: 'all', sort: 'priority' }
    error.value = '청약 목록을 불러오지 못했습니다.'
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-testid="ad-slot"]')).toHaveLength(0)
  })

  it('announces load-more success and focuses the first newly added title', async () => {
    const focus = vi.fn()
    const wrapper = mountList({ scope: { category: 'sale' } })
    await flushPromises()
    HTMLElement.prototype.focus = focus
    loadMore.mockImplementationOnce(async () => {
      items.value = [...items.value, notice(3)]
      page.value = 2
    })

    await wrapper.get('[data-testid="load-more"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="status"]').text()).toContain('총 42건 중 3건 표시, 1건을 더 불러왔습니다')
    expect(focus).toHaveBeenCalled()
    wrapper.unmount()
  })
})
