import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoadingSkeleton from '~/components/common/LoadingSkeleton.vue'

describe('LoadingSkeleton', () => {
  it('기본 count(6)개의 카드를 렌더한다', () => {
    const w = mount(LoadingSkeleton)
    expect(w.findAll('.animate-pulse')).toHaveLength(6)
  })
  it('count prop을 반영한다', () => {
    const w = mount(LoadingSkeleton, { props: { count: 3 } })
    expect(w.findAll('.animate-pulse')).toHaveLength(3)
  })
  it('facility-card variant는 아바타 원형을 렌더한다', () => {
    const w = mount(LoadingSkeleton, { props: { variant: 'facility-card' } })
    expect(w.find('.rounded-full').exists()).toBe(true)
  })
  it('card variant 기본은 아바타 없음', () => {
    const w = mount(LoadingSkeleton, { props: { variant: 'card' } })
    expect(w.find('.rounded-full').exists()).toBe(false)
  })
  it('footer=true면 버튼 바(h-8 w-24)를 추가한다', () => {
    const w = mount(LoadingSkeleton, { props: { variant: 'card', footer: true, count: 1 } })
    expect(w.find('.h-8.w-24').exists()).toBe(true)
  })
  it('카드 그리드 컨테이너 클래스를 가진다', () => {
    const w = mount(LoadingSkeleton)
    expect(w.find('.grid.grid-cols-1').exists()).toBe(true)
  })
})
