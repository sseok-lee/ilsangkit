import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { computed } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/composables/useRegions', () => ({
  useRegions: () => ({
    citiesWithDistricts: computed(() => [
      {
        slug: 'seoul',
        name: '서울특별시',
        districts: [
          { slug: 'mapo', name: '마포구', lat: 37.5663, lng: 126.9015, bjdCode: '1144000000' },
          { slug: 'gangnam', name: '강남구', lat: 37.5172, lng: 127.0473, bjdCode: '1168000000' },
        ],
      },
    ]),
    isLoaded: { value: true },
    loadRegions: vi.fn().mockResolvedValue([]),
  }),
}))

import RegionSettingsModal from '~/components/region/RegionSettingsModal.vue'
import { useRegionStore } from '~/stores/region'

function createMemoryStorage(): Storage {
  let data: Record<string, string> = {}
  return {
    getItem: (k: string) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = String(v) },
    removeItem: (k: string) => { delete data[k] },
    clear: () => { data = {} },
    key: (i: number) => Object.keys(data)[i] ?? null,
    get length() { return Object.keys(data).length },
  } as Storage
}

const stubs = { Teleport: true, Transition: false }

describe('RegionSettingsModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.defineProperty(window, 'localStorage', {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    })
  })

  it('open=false 일 때 모달 다이얼로그가 보이지 않는다', () => {
    const wrapper = mount(RegionSettingsModal, {
      props: { open: false },
      global: { stubs },
    })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('open=true 에서 시/도와 구를 선택 후 저장하면 store에 반영된다', async () => {
    const store = useRegionStore()
    const wrapper = mount(RegionSettingsModal, {
      props: { open: true },
      global: { stubs },
    })
    await flushPromises()

    const citySelect = wrapper.get('select[aria-label="시/도 선택"]')
    await citySelect.setValue('seoul')
    await flushPromises()

    const districtSelect = wrapper.get('select[aria-label="구/시 선택"]')
    expect(districtSelect.attributes('disabled')).toBeUndefined()
    await districtSelect.setValue('mapo')
    await flushPromises()

    const save = wrapper.get('[data-testid="region-save"]')
    expect(save.attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="region-preview"]').exists()).toBe(true)

    await save.trigger('click')

    expect(store.citySlug).toBe('seoul')
    expect(store.districtSlug).toBe('mapo')
    expect(store.isSet).toBe(true)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('시/도가 미선택이면 구 select와 저장 버튼이 비활성화', async () => {
    const wrapper = mount(RegionSettingsModal, {
      props: { open: true },
      global: { stubs },
    })
    await flushPromises()

    expect(wrapper.get('select[aria-label="구/시 선택"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="region-save"]').attributes('disabled')).toBeDefined()
  })

  it('시/도 변경 시 구 선택이 초기화된다', async () => {
    const wrapper = mount(RegionSettingsModal, {
      props: { open: true },
      global: { stubs },
    })
    await flushPromises()

    await wrapper.get('select[aria-label="시/도 선택"]').setValue('seoul')
    await flushPromises()
    await wrapper.get('select[aria-label="구/시 선택"]').setValue('mapo')
    await flushPromises()
    expect(wrapper.find('[data-testid="region-preview"]').exists()).toBe(true)

    await wrapper.get('select[aria-label="시/도 선택"]').setValue('')
    await flushPromises()
    expect(wrapper.find('[data-testid="region-preview"]').exists()).toBe(false)
  })

  it('취소 버튼 클릭 시 close 이벤트만 emit', async () => {
    const store = useRegionStore()
    const wrapper = mount(RegionSettingsModal, {
      props: { open: true },
      global: { stubs },
    })
    await flushPromises()

    const cancelBtn = wrapper.findAll('button').find((b) => b.text() === '취소')
    expect(cancelBtn).toBeTruthy()
    await cancelBtn!.trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(store.isSet).toBe(false)
  })
})
