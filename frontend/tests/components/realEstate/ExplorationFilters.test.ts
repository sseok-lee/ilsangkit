import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import ExplorationFilters from '~/components/realEstate/ExplorationFilters.vue'

const navigateToMock = vi.fn().mockResolvedValue(undefined)
;(globalThis as any).navigateTo = navigateToMock

const RegionDropdownStub = defineComponent({
  name: 'RegionCascadingDropdown',
  props: ['city', 'district'],
  emits: ['update:city', 'update:district'],
  template: `
    <div data-testid="region-dropdown" :data-city="city" :data-district="district">
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
})
