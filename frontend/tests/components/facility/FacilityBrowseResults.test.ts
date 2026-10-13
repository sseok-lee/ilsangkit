import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import FacilityBrowseResults from '~/components/facility/FacilityBrowseResults.vue'
import type { BrowseResult } from '~/types/facilityBrowse'

const route = reactive({ query: { city: 'seoul', district: 'gangnam', q: '중앙' } as Record<string, string> })
const push = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push }),
}))

const grouped: BrowseResult = {
  mode: 'grouped',
  groups: [
    {
      category: 'parking',
      label: '공영주차장',
      unit: '시설',
      count: 21,
      items: [{
        id: 'parking-1',
        category: 'parking',
        name: '중앙 주차장',
        address: null,
        roadAddress: '서울특별시 강남구 테헤란로',
        lat: 37.5,
        lng: 127,
        extras: { capacity: 40 },
      }],
    },
  ],
}

const list: BrowseResult = {
  mode: 'list',
  category: 'subway',
  unit: '역',
  total: 21,
  page: 2,
  totalPages: 3,
  items: [{
    id: 'gangnam',
    category: 'subway',
    name: '강남역',
    address: null,
    roadAddress: null,
    lat: null,
    lng: null,
    extras: { lines: ['2호선', '신분당선'], primaryLine: '2호선' },
  }],
}

function mountResults(result: BrowseResult) {
  return mount(FacilityBrowseResults, {
    props: { result },
    global: {
      stubs: {
        NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
        Pagination: {
          props: ['currentPage', 'totalPages', 'hrefFor'],
          emits: ['pageChange'],
          template: '<nav data-testid="pagination"><a :href="hrefFor(3)" @click.prevent="$emit(\'pageChange\', 3)">3페이지</a></nav>',
        },
      },
    },
  })
}

beforeEach(() => {
  push.mockReset()
  route.query = { city: 'seoul', district: 'gangnam', q: '중앙' }
})

describe('FacilityBrowseResults', () => {
  it('uses the explicit waste-area destination instead of rebuilding a source-detail URL', () => {
    const wrapper = mountResults({
      mode: 'list',
      category: 'trash',
      unit: '지역',
      total: 1,
      page: 1,
      totalPages: 1,
      items: [{
        id: '7',
        category: 'trash',
        name: '역삼1동',
        address: null,
        roadAddress: null,
        lat: null,
        lng: null,
        extras: {},
        destination: { kind: 'waste-area', href: '/trash/areas/7' },
      }],
    })

    expect(wrapper.get('a[href="/trash/areas/7"]').text()).toContain('역삼1동')
    expect(wrapper.find('a[href="/trash/7"]').exists()).toBe(false)
  })

  it('renders grouped counts by unit and links to category list preserving filters', () => {
    const wrapper = mountResults(grouped)

    expect(wrapper.text()).toContain('공영주차장')
    expect(wrapper.text()).toContain('21 시설')
    expect(wrapper.text()).not.toContain('총 시설')
    const link = wrapper.get('a[href^="/facilities?"]')
    expect(link.attributes('href')).toContain('city=seoul')
    expect(link.attributes('href')).toContain('district=gangnam')
    expect(link.attributes('href')).toContain('category=parking')
    expect(wrapper.get('a[href="/parking/parking-1"]').text()).toContain('중앙 주차장')
  })

  it('renders list rows without forcing nullable coordinates and provides page hrefs', async () => {
    route.query = { city: 'seoul', district: 'gangnam', category: 'subway', page: '2' }
    const wrapper = mountResults(list)

    expect(wrapper.text()).toContain('21 역')
    expect(wrapper.get('a[href="/subway/gangnam"]').text()).toContain('2호선 · 신분당선')
    expect(wrapper.get('[data-testid="pagination"] a').attributes('href')).toContain('page=3')
    await wrapper.get('[data-testid="pagination"] a').trigger('click')
    expect(push).toHaveBeenCalledWith(expect.stringContaining('page=3'))
  })
})
