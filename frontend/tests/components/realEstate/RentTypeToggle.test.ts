import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RentTypeToggle from '~/components/realEstate/RentTypeToggle.vue'

describe('RentTypeToggle', () => {
  it('3개 세그먼트(전체/전세/월세)를 렌더링하는지 확인', () => {
    const wrapper = mount(RentTypeToggle, {
      props: { modelValue: 'all' },
    })

    expect(wrapper.text()).toContain('전체')
    expect(wrapper.text()).toContain('전세')
    expect(wrapper.text()).toContain('월세')
  })

  it('all 선택 시 전체 버튼이 활성 스타일을 가지는지 확인', () => {
    const wrapper = mount(RentTypeToggle, {
      props: { modelValue: 'all' },
    })

    const buttons = wrapper.findAll('button')
    const allBtn = buttons.find((b) => b.text() === '전체')
    expect(allBtn?.html()).toMatch(/bg-primary/)
  })

  it('jeonse 선택 시 전세 버튼이 활성 스타일을 가지는지 확인', () => {
    const wrapper = mount(RentTypeToggle, {
      props: { modelValue: 'jeonse' },
    })

    const buttons = wrapper.findAll('button')
    const jeonseBtn = buttons.find((b) => b.text() === '전세')
    expect(jeonseBtn?.html()).toMatch(/bg-primary/)
  })

  it('wolse 선택 시 월세 버튼이 활성 스타일을 가지는지 확인', () => {
    const wrapper = mount(RentTypeToggle, {
      props: { modelValue: 'wolse' },
    })

    const buttons = wrapper.findAll('button')
    const wolseBtn = buttons.find((b) => b.text() === '월세')
    expect(wolseBtn?.html()).toMatch(/bg-primary/)
  })

  it('비선택 버튼이 비활성 스타일을 가지는지 확인', () => {
    const wrapper = mount(RentTypeToggle, {
      props: { modelValue: 'jeonse' },
    })

    const buttons = wrapper.findAll('button')
    const allBtn = buttons.find((b) => b.text() === '전체')
    expect(allBtn?.html()).toMatch(/bg-slate-100/)
    expect(allBtn?.html()).toMatch(/text-slate-600/)
  })

  it('전세 버튼 클릭 시 update:modelValue("jeonse")를 emit하는지 확인', async () => {
    const wrapper = mount(RentTypeToggle, {
      props: { modelValue: 'all' },
    })

    const buttons = wrapper.findAll('button')
    const jeonseBtn = buttons.find((b) => b.text() === '전세')
    await jeonseBtn?.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const emitted = wrapper.emitted('update:modelValue') as any[][]
    expect(emitted[0][0]).toBe('jeonse')
  })

  it('월세 버튼 클릭 시 update:modelValue("wolse")를 emit하는지 확인', async () => {
    const wrapper = mount(RentTypeToggle, {
      props: { modelValue: 'all' },
    })

    const buttons = wrapper.findAll('button')
    const wolseBtn = buttons.find((b) => b.text() === '월세')
    await wolseBtn?.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const emitted = wrapper.emitted('update:modelValue') as any[][]
    expect(emitted[0][0]).toBe('wolse')
  })

  it('전체 버튼 클릭 시 update:modelValue("all")를 emit하는지 확인', async () => {
    const wrapper = mount(RentTypeToggle, {
      props: { modelValue: 'jeonse' },
    })

    const buttons = wrapper.findAll('button')
    const allBtn = buttons.find((b) => b.text() === '전체')
    await allBtn?.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const emitted = wrapper.emitted('update:modelValue') as any[][]
    expect(emitted[0][0]).toBe('all')
  })
})
