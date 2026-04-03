import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AreaSelector from '~/components/realEstate/AreaSelector.vue'
import type { AreaGroup } from '~/types/realEstate'

const mockAreas: AreaGroup[] = [
  { area: 59, pyeong: 18, count: 10 },
  { area: 84, pyeong: 25, count: 15 },
]

describe('AreaSelector', () => {
  // T9-1: 전체 버튼 + 각 평수 버튼 렌더링
  it('전체 버튼과 각 평수 버튼을 렌더링한다 (areas=[59,84] → 버튼 3개)', () => {
    const wrapper = mount(AreaSelector, {
      props: { areas: mockAreas, modelValue: null },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBe(3)
    expect(buttons[0].text()).toContain('전체')
  })

  // T9-2: 평수 버튼에 ㎡ + 평 표시
  it('평수 버튼에 ㎡와 평을 함께 표시한다', () => {
    const wrapper = mount(AreaSelector, {
      props: { areas: mockAreas, modelValue: null },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons[1].text()).toContain('59㎡')
    expect(buttons[1].text()).toContain('18평')
    expect(buttons[2].text()).toContain('84㎡')
    expect(buttons[2].text()).toContain('25평')
  })

  // T9-3: modelValue=null일 때 전체 버튼 활성 스타일
  it('modelValue=null이면 전체 버튼이 활성 스타일을 가진다', () => {
    const wrapper = mount(AreaSelector, {
      props: { areas: mockAreas, modelValue: null },
    })
    const allBtn = wrapper.findAll('button')[0]
    expect(allBtn.classes().join(' ')).toMatch(/bg-|font-bold|active|selected/)
  })

  // T9-4: 평수 버튼 클릭 시 update:modelValue emit
  it('평수 버튼 클릭 시 해당 area 값을 update:modelValue로 emit한다', async () => {
    const wrapper = mount(AreaSelector, {
      props: { areas: mockAreas, modelValue: null },
    })
    const buttons = wrapper.findAll('button')
    await buttons[1].trigger('click')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toBe(59)
  })

  // T9-5: 전체 버튼 클릭 시 null emit
  it('전체 버튼 클릭 시 null을 update:modelValue로 emit한다', async () => {
    const wrapper = mount(AreaSelector, {
      props: { areas: mockAreas, modelValue: 59 },
    })
    const allBtn = wrapper.findAll('button')[0]
    await allBtn.trigger('click')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toBeNull()
  })

  // T9-6: areas 빈 배열이면 전체 버튼만 렌더링
  it('areas가 빈 배열이면 전체 버튼만 렌더링한다', () => {
    const wrapper = mount(AreaSelector, {
      props: { areas: [], modelValue: null },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBe(1)
    expect(buttons[0].text()).toContain('전체')
  })
})
