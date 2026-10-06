import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({
  cities: [
    { slug: 'seoul', name: '서울', districts: [
      { slug: 'gangnam', name: '강남구', lat: 37.5172, lng: 127.0473, bjdCode: '11680' },
      { slug: 'seocho', name: '서초구', lat: 37.4837, lng: 127.0324, bjdCode: '11650' },
    ] },
    { slug: 'busan', name: '부산', districts: [
      { slug: 'haeundae', name: '해운대구', lat: 35.1631, lng: 129.1636, bjdCode: '26350' },
    ] },
  ],
}))

vi.mock('~/composables/useRegions', () => ({
  useRegions: () => ({
    loadRegions: vi.fn().mockResolvedValue([]),
    citiesWithDistricts: { value: mocks.cities },
    getDistrictsByCity: (slug: string) =>
      mocks.cities.find((c) => c.slug === slug)?.districts ?? [],
  }),
}))

import RegionCascadingDropdown from '~/components/common/RegionCascadingDropdown.vue'

function mountIt(props: Record<string, unknown> = {}) {
  return mount(RegionCascadingDropdown, { props: { city: '', district: '', ...props } })
}

describe('RegionCascadingDropdown', () => {
  it('시/도 옵션을 렌더한다', () => {
    const text = mountIt().text()
    expect(text).toContain('서울')
    expect(text).toContain('부산')
  })

  it('시/도 미선택 시 구/군 select는 disabled', () => {
    const districtSelect = mountIt({ city: '' }).findAll('select')[1]
    expect(districtSelect.attributes('disabled')).toBeDefined()
  })

  it('시/도(축약명) 선택 시 해당 구/군만 렌더', () => {
    const text = mountIt({ city: '서울' }).text()
    expect(text).toContain('강남구')
    expect(text).toContain('서초구')
    expect(text).not.toContain('해운대구')
  })

  it('시/도 변경 시 update:city emit + 구/군 리셋(update:district "")', async () => {
    const w = mountIt({ city: '', district: '' })
    await w.findAll('select')[0].setValue('서울')
    expect(w.emitted('update:city')?.[0]).toEqual(['서울'])
    expect(w.emitted('update:district')?.[0]).toEqual([''])
  })

  it('구/군 선택 시 update:district emit', async () => {
    const w = mountIt({ city: '서울', district: '' })
    await w.findAll('select')[1].setValue('강남구')
    expect(w.emitted('update:district')?.[0]).toEqual(['강남구'])
  })

  it('slug 모드: 시/도 값이 slug여도 구/군이 채워진다', () => {
    const text = mountIt({ city: 'seoul', cityValueMode: 'slug' }).text()
    expect(text).toContain('강남구')
  })

  it('variant 없이도 flat 출력: 흰 바탕·7px·44px select, bg-slate-50 없음', () => {
    const wrapper = mountIt()
    const select = wrapper.get('select[aria-label="시/도 선택"]')
    expect(select.classes()).toEqual(expect.arrayContaining(['bg-white', 'rounded-[7px]', 'min-h-[44px]']))
    expect(select.classes()).not.toContain('bg-slate-50')
  })

  it('variant flat: 흰 바탕·1px 선·7px·44px select, 회색 계열 없음', () => {
    const wrapper = mountIt({ variant: 'flat', city: '서울' })
    for (const label of ['시/도 선택', '구/군 선택']) {
      const select = wrapper.get(`select[aria-label="${label}"]`)
      expect(select.classes()).toEqual(expect.arrayContaining([
        'bg-white', 'border', 'border-line', 'rounded-[7px]', 'min-h-[44px]', 'pr-9', 'text-ink',
      ]))
      expect(select.classes().some((c) => /slate|gray/.test(c))).toBe(false)
    }
    for (const label of wrapper.findAll('label')) {
      expect(label.classes()).toContain('text-muted')
    }
    for (const icon of wrapper.findAll('.material-symbols-outlined')) {
      expect(icon.classes()).toContain('text-muted')
      expect(icon.attributes('aria-hidden')).toBe('true')
    }
  })
})


it('opt-in preserves URL selection before its region dictionary is available', () => {
  const wrapper = mountIt({ city: '선택시', district: '선택구', preserveCurrentSelection: true })
  expect((wrapper.findAll('select')[0].element as HTMLSelectElement).value).toBe('선택시')
  expect((wrapper.findAll('select')[1].element as HTMLSelectElement).value).toBe('선택구')
  const defaultWrapper = mountIt({ city: '선택시', district: '선택구' })
  expect(defaultWrapper.find('option[value="선택시"]').exists()).toBe(false)
})
