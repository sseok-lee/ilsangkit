import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RealEstateSearchFilter from '~/components/realEstate/RealEstateSearchFilter.vue'

describe('RealEstateSearchFilter', () => {
  it('시/도 select를 렌더링하는지 확인', () => {
    const wrapper = mount(RealEstateSearchFilter)

    const selects = wrapper.findAll('select')
    expect(selects.length).toBeGreaterThanOrEqual(1)
    // REGIONS의 시/도 목록이 표시되어야 함
    expect(wrapper.text()).toContain('서울')
  })

  it('시/도 select에 REGIONS의 도시 목록이 표시되는지 확인', () => {
    const wrapper = mount(RealEstateSearchFilter)

    const citySelect = wrapper.find('select')
    const options = citySelect.findAll('option')
    const optionTexts = options.map((o) => o.text())
    expect(optionTexts).toContain('전체')
    expect(optionTexts).toContain('서울')
    expect(optionTexts).toContain('경기')
  })

  it('건물명 텍스트 입력 필드를 렌더링하는지 확인', () => {
    const wrapper = mount(RealEstateSearchFilter)

    const input = wrapper.find('input[type="text"]')
    expect(input.exists()).toBe(true)
  })

  it('구/군 select가 초기에 비활성화되는지 확인', () => {
    const wrapper = mount(RealEstateSearchFilter)

    const selects = wrapper.findAll('select')
    const districtSelect = selects[1]
    expect(districtSelect.attributes('disabled')).toBeDefined()
  })

  it('검색 버튼을 렌더링하는지 확인', () => {
    const wrapper = mount(RealEstateSearchFilter)

    const buttons = wrapper.findAll('button')
    const searchBtn = buttons.find((b) => b.text().includes('검색'))
    expect(searchBtn).toBeDefined()
  })

  it('초기화 버튼을 렌더링하는지 확인', () => {
    const wrapper = mount(RealEstateSearchFilter)

    const buttons = wrapper.findAll('button')
    const resetBtn = buttons.find((b) => b.text().includes('초기화'))
    expect(resetBtn).toBeDefined()
  })

  it('검색 버튼 클릭 시 search 이벤트를 emit하는지 확인', async () => {
    const wrapper = mount(RealEstateSearchFilter)

    const buttons = wrapper.findAll('button')
    const searchBtn = buttons.find((b) => b.text().includes('검색'))
    await searchBtn?.trigger('click')

    expect(wrapper.emitted('search')).toBeTruthy()
    const emitted = wrapper.emitted('search') as any[][]
    expect(emitted[0][0]).toHaveProperty('city')
    expect(emitted[0][0]).toHaveProperty('district')
  })

  it('시/도 선택 시 구/군 select가 활성화되는지 확인', async () => {
    const wrapper = mount(RealEstateSearchFilter)

    const citySelect = wrapper.find('select')
    await citySelect.setValue('서울')

    const selects = wrapper.findAll('select')
    const districtSelect = selects[1]
    expect(districtSelect.attributes('disabled')).toBeUndefined()
  })

  it('시/도 선택 후 구/군 옵션이 채워지는지 확인', async () => {
    const wrapper = mount(RealEstateSearchFilter)

    const citySelect = wrapper.find('select')
    await citySelect.setValue('서울')

    const selects = wrapper.findAll('select')
    const districtSelect = selects[1]
    const options = districtSelect.findAll('option')
    // 전체 + 실제 구/군 목록
    expect(options.length).toBeGreaterThan(1)
  })

  it('초기화 버튼 클릭 시 필터가 초기화되는지 확인', async () => {
    const wrapper = mount(RealEstateSearchFilter)

    // 시/도 선택
    const citySelect = wrapper.find('select')
    await citySelect.setValue('서울')

    // 초기화
    const buttons = wrapper.findAll('button')
    const resetBtn = buttons.find((b) => b.text().includes('초기화'))
    await resetBtn?.trigger('click')

    expect((citySelect.element as HTMLSelectElement).value).toBe('')
  })
})
