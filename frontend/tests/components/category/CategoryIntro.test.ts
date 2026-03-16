import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CategoryIntro from '~/components/category/CategoryIntro.vue'
import { CATEGORY_DESCRIPTIONS } from '~/utils/categoryDescriptions'
import type { FacilityCategory } from '~/types/facility'

const ALL_CATEGORIES: FacilityCategory[] = [
  'toilet', 'trash', 'wifi', 'clothes',
  'parking', 'aed', 'library', 'hospital', 'pharmacy',
  'park', 'school', 'market',
]

describe('CategoryIntro', () => {
  it('category prop "toilet" → 공공화장실 소개 텍스트를 렌더링한다', () => {
    const wrapper = mount(CategoryIntro, { props: { category: 'toilet' } })
    const text = wrapper.text()
    expect(text).toContain('공공화장실')
  })

  it('category prop "hospital" → 병원 소개 텍스트를 렌더링한다', () => {
    const wrapper = mount(CategoryIntro, { props: { category: 'hospital' } })
    const text = wrapper.text()
    expect(text).toContain('병원')
  })

  it('10개 카테고리 모두 빈 문자열 아닌 소개 텍스트가 존재한다', () => {
    for (const category of ALL_CATEGORIES) {
      expect(CATEGORY_DESCRIPTIONS[category]).toBeTruthy()
      expect(CATEGORY_DESCRIPTIONS[category].length).toBeGreaterThan(0)
    }
  })

  it('h2 또는 h3 태그로 카테고리명을 표시한다', () => {
    const wrapper = mount(CategoryIntro, { props: { category: 'toilet' } })
    const heading = wrapper.find('h2') || wrapper.find('h3')
    expect(heading.exists()).toBe(true)
  })

  it('소개 텍스트가 30자 이상 100자 이하이다', () => {
    for (const category of ALL_CATEGORIES) {
      expect(CATEGORY_DESCRIPTIONS[category].length).toBeGreaterThanOrEqual(30)
      expect(CATEGORY_DESCRIPTIONS[category].length).toBeLessThanOrEqual(100)
    }
  })

  it('section 태그로 감싸진다', () => {
    const wrapper = mount(CategoryIntro, { props: { category: 'wifi' } })
    expect(wrapper.find('section').exists()).toBe(true)
  })
})
