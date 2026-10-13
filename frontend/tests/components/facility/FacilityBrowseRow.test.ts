import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FacilityBrowseRow from '~/components/facility/FacilityBrowseRow.vue'
import type { BrowseItem } from '~/types/facilityBrowse'

function item(overrides: Partial<BrowseItem> = {}): BrowseItem {
  return {
    id: 'parking-1',
    category: 'parking',
    name: '테스트 주차장',
    address: '서울 강남구',
    roadAddress: null,
    lat: 37.5,
    lng: 127,
    extras: {},
    ...overrides,
  }
}

describe('FacilityBrowseRow', () => {
  it('converts legacy waste-area destinations to source-list area filters', () => {
    const wrapper = mount(FacilityBrowseRow, {
      props: {
        item: item({
          id: '7',
          category: 'trash',
          name: '역삼1동',
          destination: { kind: 'waste-area', href: '/trash/areas/7' },
        }),
      },
    })

    expect(wrapper.get('a').attributes('href')).toBe('/trash?areaId=7')
  })

  it('does not turn invalid waste-area destinations into source-detail links', () => {
    const wrapper = mount(FacilityBrowseRow, {
      props: {
        item: item({
          id: '7',
          category: 'trash',
          destination: { kind: 'waste-area', href: '/trash/areas/abc' },
        } as never),
      },
    })

    expect(wrapper.get('a').attributes('href')).toBe('/trash')
  })
})
