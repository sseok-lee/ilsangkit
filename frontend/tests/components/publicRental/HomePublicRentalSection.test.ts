import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HomePublicRentalSection from '~/components/publicRental/HomePublicRentalSection.vue'

const items = [
  { pblancId: 'A/1', pblancNm: '서울 국민임대 모집', suplyTyNm: '국민임대', brtcNm: '서울', signguNm: '강서구', endDe: '2026-06-05', totalSupply: 120 },
  { pblancId: 'B2', pblancNm: '화성 매입임대', suplyTyNm: '매입임대', brtcNm: '경기', signguNm: '화성시', endDe: '2026-06-02', totalSupply: 45 },
]

describe('HomePublicRentalSection', () => {
  beforeEach(() => {
    ;(globalThis as any).useState = vi.fn((key: string, init?: () => string) => {
      if (key === 'home-today-iso') return { value: '2026-05-30' }
      return { value: init ? init() : null }
    })
  })

  it('진행중 공고 제목/지역/유형을 렌더한다', () => {
    const wrapper = mount(HomePublicRentalSection, {
      props: { items },
      global: { stubs: { HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } } },
    })
    expect(wrapper.text()).toContain('서울 국민임대 모집')
    expect(wrapper.text()).toContain('국민임대')
    expect(wrapper.text()).toContain('강서구')
  })

  it('마감임박순(endDe ASC)으로 정렬한다 — B2(6/2)가 A/1(6/5)보다 먼저', () => {
    const wrapper = mount(HomePublicRentalSection, {
      props: { items },
      global: { stubs: { HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } } },
    })
    const text = wrapper.text()
    expect(text.indexOf('화성 매입임대')).toBeLessThan(text.indexOf('서울 국민임대 모집'))
  })

  it('상세 링크는 encodeURIComponent(pblancId)', () => {
    const wrapper = mount(HomePublicRentalSection, {
      props: { items },
      global: { stubs: { HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } } },
    })
    expect(wrapper.html()).toContain(`/public-rental/announcements/${encodeURIComponent('A/1')}`)
  })

  it('items 비어있으면 섹션을 렌더하지 않는다', () => {
    const wrapper = mount(HomePublicRentalSection, {
      props: { items: [] },
      global: { stubs: { HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } } },
    })
    expect(wrapper.find('section').exists()).toBe(false)
  })
})
