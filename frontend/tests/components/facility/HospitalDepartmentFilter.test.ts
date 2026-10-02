import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import HospitalDepartmentFilter from '~/components/facility/HospitalDepartmentFilter.vue'

vi.mock('~/composables/useHospitalDepartments', () => ({
  useHospitalDepartments: () => ({
    data: ref([{ name: '내과', count: 18214 }, { name: '정형외과', count: 4102 }]),
    pending: ref(false),
  }),
}))

describe('HospitalDepartmentFilter variant="flat"', () => {
  it('평면 섹션 + h2 제목 + 펼치면 UiChip 버튼', async () => {
    const w = mount(HospitalDepartmentFilter, { props: { modelValue: ['내과'], variant: 'flat' } })
    expect(w.get('section').classes()).toContain('section-flat')
    expect(w.get('h2').classes()).toContain('ui-h2')
    await w.get('[data-test="dept-toggle"]').trigger('click')
    const chips = w.findAll('button.ui-chip')
    expect(chips.length).toBe(2)
    expect(chips[0].attributes('aria-pressed')).toBe('true')
    expect(chips[0].text()).toContain('18,214')
  })

  it('초기화는 secondary, 적용은 primary UiButton', async () => {
    const w = mount(HospitalDepartmentFilter, { props: { modelValue: [], variant: 'flat' } })
    await w.get('[data-test="dept-toggle"]').trigger('click')
    expect(w.get('[data-test="dept-reset"]').classes()).toContain('ui-btn--secondary')
    expect(w.get('[data-test="dept-apply"]').classes()).toContain('ui-btn--primary')
  })

  it('flat 출력에 원시 회색·그림자·rounded-2xl 이 없다', async () => {
    const w = mount(HospitalDepartmentFilter, { props: { modelValue: ['내과'], variant: 'flat' } })
    await w.get('[data-test="dept-toggle"]').trigger('click')
    expect(w.html()).not.toMatch(/(?:text|bg|border)-(?:slate|gray)-\d|shadow-|rounded-2xl/)
  })

  it('기본 variant(card) 는 기존 카드 그대로다', () => {
    const w = mount(HospitalDepartmentFilter, { props: { modelValue: [] } })
    expect(w.get('div').classes()).toEqual(expect.arrayContaining(['rounded-2xl', 'border-slate-200']))
  })
})
