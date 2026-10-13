import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WasteListSearch from '~/components/trash/WasteListSearch.vue'
import type { AreaSummary } from '~/types/wasteArea'
import type { WasteListQuery } from '~/types/wasteList'

const query: WasteListQuery = {
  city: '서울특별시',
  district: '강남구',
  keyword: '역삼',
  page: 2,
  limit: 20,
}

const area: AreaSummary = {
  areaId: 101,
  name: '역삼1동',
  city: '서울특별시',
  district: '강남구',
  href: '/trash?areaId=101',
  matchReason: 'exact',
  scheduleCount: 3,
  conditionalCount: 1,
  summary: '역삼1동 배출 안내',
  dataDate: '2026-10-01',
}

function mountSearch(props: Partial<InstanceType<typeof WasteListSearch>['$props']> = {}) {
  return mount(WasteListSearch, {
    props: {
      query,
      areas: [area],
      areasPending: false,
      areasError: null,
      areaFilterEnabled: true,
      ...props,
    },
  })
}

describe('WasteListSearch', () => {
  it('검색 조건 변경은 page를 버리고 search 이벤트로 올린다', async () => {
    const wrapper = mountSearch()

    await wrapper.get('input[name="keyword"]').setValue('예미2길')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('search')?.[0]).toEqual([{
      city: '서울특별시',
      district: '강남구',
      keyword: '예미2길',
    }])
  })

  it('동 필터는 검증된 areaId만 emit하고 area-first 동작을 강제하지 않는다', async () => {
    const wrapper = mountSearch()

    await wrapper.get('select[name="areaId"]').setValue('101')

    expect(wrapper.emitted('search')?.[0]).toEqual([{
      city: '서울특별시',
      district: '강남구',
      areaId: 101,
      keyword: '역삼',
    }])
  })

  it('동 옵션 오류는 검색 컨트롤 안에서만 재시도할 수 있다', async () => {
    const wrapper = mountSearch({ areasError: new Error('network') })

    expect(wrapper.text()).toContain('동 목록을 불러오지 못했습니다')
    await wrapper.get('button[data-testid="retry-areas"]').trigger('click')
    expect(wrapper.emitted('retry-areas')).toHaveLength(1)
  })
})
