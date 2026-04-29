import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/composables/useRegions', () => ({
  useRegions: () => ({
    citiesWithDistricts: computed(() => [
      {
        slug: 'seoul',
        name: '서울특별시',
        districts: [{ slug: 'mapo', name: '마포구', lat: 37.5663, lng: 126.9015, bjdCode: '1144000000' }],
      },
    ]),
    isLoaded: { value: true },
    loadRegions: vi.fn().mockResolvedValue([]),
    getCityName: (slug: string) => (slug === 'seoul' ? '서울특별시' : slug),
    getDistrictsByCity: () => [{ slug: 'mapo', name: '마포구', lat: 37.5663, lng: 126.9015, bjdCode: '1144000000' }],
  }),
}))

import WasteDDayCard from '~/components/waste/WasteDDayCard.vue'
import { useRegionStore } from '~/stores/region'

function createMemoryStorage(): Storage {
  let data: Record<string, string> = {}
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v) },
    removeItem: (k) => { delete data[k] },
    clear: () => { data = {} },
    key: (i) => Object.keys(data)[i] ?? null,
    get length() { return Object.keys(data).length },
  } as Storage
}

describe('WasteDDayCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.defineProperty(window, 'localStorage', {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    })
    // useAsyncData 글로벌 mock을 매 테스트마다 빈 응답으로 초기화
    ;(globalThis as any).useAsyncData = vi.fn(() => {
      const result = {
        data: ref(null),
        status: ref('idle'),
        error: ref(null),
        refresh: vi.fn(),
        pending: ref(false),
      }
      return Object.assign(Promise.resolve(result), result)
    })
  })

  it('regionStore 미설정 + hasData=false 일 때 카드가 렌더링되지 않는다', () => {
    const wrapper = mount(WasteDDayCard)
    expect(wrapper.find('section').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('hasData=true 인 응답이 있으면 카드를 렌더링하고 아이템을 표시', async () => {
    ;(globalThis as any).useAsyncData = vi.fn(() => {
      const data = ref({
        success: true,
        data: {
          hasData: true,
          items: [
            {
              type: 'recyclable',
              label: '재활용',
              daysOfWeekLabel: '화·목',
              beginTime: '19:00',
              endTime: '24:00',
              dDay: 1,
              nextDateLabel: '내일 (목)',
            },
            {
              type: 'food',
              label: '음식물쓰레기',
              daysOfWeekLabel: '월·수·금',
              beginTime: null,
              endTime: null,
              dDay: 0,
              nextDateLabel: '오늘 (수)',
            },
          ],
        },
      })
      const result = { data, status: ref('success'), error: ref(null), refresh: vi.fn(), pending: ref(false) }
      return Object.assign(Promise.resolve(result), result)
    })

    const store = useRegionStore()
    store.setRegion({ citySlug: 'seoul', districtSlug: 'mapo' })

    const wrapper = mount(WasteDDayCard)
    // watch는 비동기. 다음 마이크로태스크 이후 확인
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('section').exists()).toBe(true)
    expect(wrapper.text()).toContain('마포구')
    expect(wrapper.text()).toContain('재활용')
    expect(wrapper.text()).toContain('음식물쓰레기')
    expect(wrapper.text()).toContain('D-1')
    expect(wrapper.text()).toContain('D-0')
    expect(wrapper.text()).toContain('내일 (목)')
    expect(wrapper.text()).toContain('오늘 (수)')
  })
})
