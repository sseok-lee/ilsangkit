import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WasteAreaList from '~/components/trash/WasteAreaList.vue'
import type { AreaList, AreaQuery } from '~/types/wasteArea'

const list: AreaList = {
  generationId: 'g1',
  items: [
    {
      areaId: 101,
      name: '역삼1동',
      city: '서울특별시',
      district: '강남구',
      href: '/trash/areas/101',
      matchReason: 'region',
      scheduleCount: 2,
      conditionalCount: 1,
      summary: '월 18:00, 조건별 1건',
      dataDate: '2026-09-28T00:00:00.000Z',
    },
  ],
  total: 1,
  page: 1,
  totalPages: 1,
  unresolved: { count: 3, href: '/trash?coverage=unresolved&city=서울특별시' },
}

const query: AreaQuery = { city: '서울특별시', district: '강남구', page: 1, limit: 20 }
const navigateToMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('useRoute', () => ({
    path: '/trash',
    fullPath: '/trash?city=서울특별시&district=강남구&page=2',
    query: {},
  }))
  navigateToMock.mockReset()
  vi.stubGlobal('navigateTo', navigateToMock)
  vi.stubGlobal('useNuxtApp', () => ({
    $router: {
      afterEach: vi.fn((handler) => {
        setTimeout(handler, 0)
        return vi.fn()
      }),
      push: vi.fn(() => Promise.resolve()),
    },
  }))
  window.scrollTo(0, 480)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mountList(props: Partial<InstanceType<typeof WasteAreaList>['$props']> = {}) {
  return mount(WasteAreaList, {
    props: {
      list,
      query,
      pending: false,
      error: null,
      hrefFor: (page: number) => `/trash?page=${page}`,
      ...props,
    },
    global: {
      stubs: {
        SectionBlock: { template: '<section><slot name="right" /><slot /></section>' },
        EmptyState: { props: ['title', 'description'], template: '<div class="empty">{{ title }} {{ description }}<slot /></div>' },
        Pagination: { props: ['hrefFor'], template: '<nav><a :href="hrefFor(2)">2</a></nav>' },
      },
    },
  })
}

describe('WasteAreaList', () => {
  it('renders rows with real area links and separates unresolved source rows', () => {
    const wrapper = mountList()

    expect(wrapper.get('a[href="/trash/areas/101"]').text()).toContain('역삼1동')
    expect(wrapper.text()).toContain('적용 대상')
    expect(wrapper.text()).toContain('기준일 2026-09-28')
    expect(wrapper.get('a[href="/trash?coverage=unresolved&city=서울특별시"]').text()).toContain('원문 보기')
  })

  it('stores list return state before area navigation', async () => {
    const wrapper = mountList()

    await wrapper.get('a[href="/trash/areas/101"]').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(navigateToMock).toHaveBeenCalledWith({
      path: '/trash/areas/101',
      state: {
        ilsangkitTrashReturn: {
          sourceId: null,
          context: {
            href: '/trash?city=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&district=%EA%B0%95%EB%82%A8%EA%B5%AC&page=2',
            label: '목록으로 돌아가기',
            scrollY: 480,
          },
        },
      },
    })
  })

  it('keeps pending, error, and empty states distinct', () => {
    expect(mountList({ pending: true }).text()).toContain('조회 중')
    expect(mountList({ error: new Error('x') }).text()).toContain('불러오지 못했습니다')
    expect(mountList({ list: { ...list, items: [], total: 0, unresolved: { count: 0, href: null } } }).text()).toContain('확인된 동별 배출 안내가 없습니다')
  })

  it('submits URL filters with page reset handled by the owner page', async () => {
    const wrapper = mountList()
    await wrapper.get('input[name="keyword"]').setValue('삼성')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('search')?.[0]).toEqual([{ city: '서울특별시', district: '강남구', keyword: '삼성' }])
  })
})
