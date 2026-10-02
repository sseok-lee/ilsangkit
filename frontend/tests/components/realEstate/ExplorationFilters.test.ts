import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import ExplorationFilters from '~/components/realEstate/ExplorationFilters.vue'

const navigateToMock = vi.fn().mockResolvedValue(undefined)
;(globalThis as any).navigateTo = navigateToMock

const RegionDropdownStub = defineComponent({
  name: 'RegionCascadingDropdown',
  props: ['city', 'district', 'variant'],
  emits: ['update:city', 'update:district'],
  template: `
    <div data-testid="region-dropdown" :data-city="city" :data-district="district" :data-variant="variant">
      <button data-testid="choose-busan" @click="$emit('update:city', '부산')">부산</button>
      <button data-testid="choose-seocho" @click="$emit('update:district', '서초구')">서초구</button>
      <button data-testid="choose-national" @click="$emit('update:city', '')">전국</button>
    </div>
  `,
})

function mountIt(props: Record<string, unknown> = {}) {
  return mount(ExplorationFilters, {
    props: {
      type: 'apt-rent',
      city: '서울',
      district: '강남구',
      ...props,
    },
    global: {
      stubs: {
        NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
        RegionCascadingDropdown: RegionDropdownStub,
      },
    },
  })
}

describe('ExplorationFilters', () => {
  beforeEach(() => navigateToMock.mockClear())

  it('keeps a valid city and district when the property or transaction type changes', () => {
    const wrapper = mountIt()
    const hrefs = wrapper.findAll('a').map((link) => link.attributes('href'))

    expect(hrefs).toContain('/real-estate/apt-sale/seoul/gangnam')
    expect(hrefs).toContain('/real-estate/apt-rent/seoul/gangnam')
    expect(hrefs).toContain('/real-estate/villa-rent/seoul/gangnam')
    expect(hrefs).toContain('/real-estate/offitel-rent/seoul/gangnam')
  })

  it('passes the restored region into RegionCascadingDropdown', () => {
    const wrapper = mountIt()
    const dropdown = wrapper.get('[data-testid="region-dropdown"]')

    expect(dropdown.attributes('data-city')).toBe('서울')
    expect(dropdown.attributes('data-district')).toBe('강남구')
  })

  it('resets the district and page when the city changes', async () => {
    const wrapper = mountIt()
    await wrapper.get('[data-testid="choose-busan"]').trigger('click')

    expect(navigateToMock).toHaveBeenCalledWith('/real-estate/apt-rent/busan')
  })

  it('keeps the city and resets the page when the district changes', async () => {
    const wrapper = mountIt()
    await wrapper.get('[data-testid="choose-seocho"]').trigger('click')

    expect(navigateToMock).toHaveBeenCalledWith('/real-estate/apt-rent/seoul/seocho')
  })

  it('returns to the national list when the city is cleared', async () => {
    const wrapper = mountIt()
    await wrapper.get('[data-testid="choose-national"]').trigger('click')

    expect(navigateToMock).toHaveBeenCalledWith('/real-estate/apt-rent')
  })

  it('건물·거래 유형을 링크 모드 세그먼트 2개로 렌더하고 현재 값을 aria-current 로 표시한다', () => {
    const wrapper = mountIt()
    const groups = wrapper.findAll('.ui-segmented[role="group"]')
    expect(groups.map((g) => g.attributes('aria-label'))).toEqual(['건물 유형', '거래 유형'])

    const current = wrapper.findAll('a[aria-current="page"]')
    expect(current.map((a) => a.text())).toEqual(['아파트', '전월세'])
    expect(current.every((a) => a.classes().includes('ui-segmented__item--selected'))).toBe(true)
    expect(wrapper.find('.filter-link').exists()).toBe(false)
  })

  it('fieldset/legend 접근성 그룹을 유지한다', () => {
    const wrapper = mountIt()
    expect(wrapper.findAll('fieldset legend').map((l) => l.text())).toEqual(['건물 유형', '거래 유형'])
  })

  it('지역 선택은 평면형 변형을 쓴다', () => {
    const wrapper = mountIt()
    expect(wrapper.get('[data-testid="region-dropdown"]').attributes('data-variant')).toBe('flat')
  })
})
