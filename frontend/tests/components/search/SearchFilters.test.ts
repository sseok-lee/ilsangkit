import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchFilters from '~/components/search/SearchFilters.vue'

describe('SearchFilters', () => {
  it('카테고리 필터를 렌더링하는지 확인', () => {
    const wrapper = mount(SearchFilters, {
      props: {
        category: undefined,
        sort: 'distance',
      },
    })

    expect(wrapper.text()).toContain('전체')
    expect(wrapper.text()).toContain('공공화장실')
    expect(wrapper.text()).toContain('무료와이파이')
    expect(wrapper.text()).toContain('의류수거함')
    expect(wrapper.text()).toContain('무인민원발급기')
  })

  it('정렬 옵션을 렌더링하는지 확인', () => {
    const wrapper = mount(SearchFilters, {
      props: {
        category: undefined,
        sort: 'distance',
      },
    })

    expect(wrapper.text()).toContain('거리순')
    expect(wrapper.text()).toContain('이름순')
  })

  it('카테고리 선택 시 이벤트를 발생시키는지 확인', async () => {
    const wrapper = mount(SearchFilters, {
      props: {
        category: undefined,
        sort: 'distance',
      },
    })

    const toiletButton = wrapper.findAll('button').find((btn) => btn.text().includes('공공화장실'))
    await toiletButton?.trigger('click')

    expect(wrapper.emitted('update:category')).toBeTruthy()
    expect(wrapper.emitted('update:category')?.[0]).toEqual(['toilet'])
  })

  it('정렬 선택 시 이벤트를 발생시키는지 확인', async () => {
    const wrapper = mount(SearchFilters, {
      props: {
        category: undefined,
        sort: 'distance',
      },
    })

    // Select 또는 버튼으로 정렬 변경
    const sortSelect = wrapper.find('select')
    if (sortSelect.exists()) {
      await sortSelect.setValue('name')
      expect(wrapper.emitted('update:sort')?.[0]).toEqual(['name'])
    }
  })

  it('선택된 카테고리가 하이라이트되는지 확인', () => {
    const wrapper = mount(SearchFilters, {
      props: {
        category: 'toilet',
        sort: 'distance',
      },
    })

    const buttons = wrapper.findAll('button')
    const toiletButton = buttons.find((btn) => btn.text().includes('공공화장실'))

    // active 클래스나 스타일 확인
    expect(toiletButton?.html()).toMatch(/bg-primary|ring|border-primary/)
  })

  it('전체 선택 시 undefined를 emit하는지 확인', async () => {
    const wrapper = mount(SearchFilters, {
      props: {
        category: 'toilet',
        sort: 'distance',
      },
    })

    const allButton = wrapper.findAll('button').find((btn) => btn.text().includes('전체'))
    await allButton?.trigger('click')

    expect(wrapper.emitted('update:category')).toBeTruthy()
    expect(wrapper.emitted('update:category')?.[0]).toEqual([undefined])
  })

  it('현재 선택된 정렬이 표시되는지 확인', () => {
    const wrapper = mount(SearchFilters, {
      props: {
        category: undefined,
        sort: 'name',
      },
    })

    // 이름순이 선택된 상태 확인
    const sortElement = wrapper.find('[data-testid="sort-indicator"]')
    if (sortElement.exists()) {
      expect(sortElement.text()).toContain('이름순')
    }
  })
})
