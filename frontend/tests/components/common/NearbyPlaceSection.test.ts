import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import NearbyPlaceSection from '~/components/common/nearby/NearbyPlaceSection.vue'
import NearbyPlaceRow from '~/components/common/nearby/NearbyPlaceRow.vue'
import type { NearbyPlaceRowData } from '~/components/common/nearby/NearbyPlaceSection.vue'

function rows(n: number, extra: Partial<NearbyPlaceRowData> = {}): NearbyPlaceRowData[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `r${i + 1}`,
    name: `시설${i + 1}`,
    url: `/park/p${i + 1}`,
    distance: 100 + i * 100,
    hard: true,
    ...extra,
  }))
}

describe('NearbyPlaceRow — 링크 1개 행', () => {
  it('보조 줄이 없으면 이름만, 거리·도보 시간을 오른쪽에 둔다', () => {
    const wrapper = mount(NearbyPlaceRow, { props: { to: '/park/p1', name: '가람공원', distance: 320, hard: true } })
    expect(wrapper.element.tagName).toBe('A')
    expect(wrapper.attributes('href')).toBe('/park/p1')
    expect(wrapper.text()).toContain('가람공원')
    expect(wrapper.text()).toContain('320m')
    expect(wrapper.text()).toContain('도보 약 5분')
    expect(wrapper.find('[data-testid="nearby-place-sub"]').exists()).toBe(false)
    expect(wrapper.classes()).toContain('min-h-[52px]')
  })

  it('보조 줄이 있으면 이름 아래 한 줄로 표시한다', () => {
    const wrapper = mount(NearbyPlaceRow, {
      props: { to: '/park/p1', name: '가람공원', sub: '병점노을4로 29 · 근린공원', distance: 320, hard: true },
    })
    const sub = wrapper.find('[data-testid="nearby-place-sub"]')
    expect(sub.text()).toBe('병점노을4로 29 · 근린공원')
    expect(sub.classes()).toContain('truncate')
  })

  it('빈 보조 줄은 그리지 않는다', () => {
    const wrapper = mount(NearbyPlaceRow, { props: { to: '/a', name: '가', sub: '', distance: 10, hard: true } })
    expect(wrapper.find('[data-testid="nearby-place-sub"]').exists()).toBe(false)
  })

  it('배지 슬롯을 이름 앞에 둔다', () => {
    const wrapper = mount(NearbyPlaceRow, {
      props: { to: '/subway/gangnam', name: '강남', distance: 210 },
      slots: { badge: () => h('span', { 'data-testid': 'badge' }, '2호선') },
    })
    const html = wrapper.html()
    expect(html.indexOf('data-testid="badge"')).toBeLessThan(html.indexOf('강남'))
  })

  it('stacked 면 행 높이 64px 이상, 거리·도보를 항상 두 줄로 쓴다', () => {
    const wrapper = mount(NearbyPlaceRow, { props: { to: '/a', name: '가', distance: 10, hard: true, stacked: true } })
    expect(wrapper.classes()).toContain('min-h-[64px]')
    const meta = wrapper.findAll('.tabular-nums > span')
    expect(meta).toHaveLength(2)
    for (const m of meta) {
      expect(m.classes()).toContain('block')
      expect(m.classes()).not.toContain('md:inline')
    }
  })
})

describe('NearbyPlaceSection — 섹션 머리 + 행 목록', () => {
  it('h3 라벨과 오른쪽 개수 문구, 진한 선 머리를 그린다', () => {
    const wrapper = mount(NearbyPlaceSection, {
      props: { sectionKey: 'park', label: '주변 공원', countLabel: '1km 안 2곳', rows: rows(2) },
    })
    expect(wrapper.element.tagName).toBe('SECTION')
    expect(wrapper.attributes('aria-labelledby')).toBe('nearby-facility-park')
    expect(wrapper.find('h3').attributes('id')).toBe('nearby-facility-park')
    expect(wrapper.find('h3').text()).toBe('주변 공원')
    expect(wrapper.find('[data-testid="nearby-facility-count"]').text()).toBe('1km 안 2곳')
    expect(wrapper.find('.border-ink').exists()).toBe(true)
    expect(wrapper.findAll('li')).toHaveLength(2)
  })

  it('행의 보조 줄을 그대로 넘긴다(있을 때만)', () => {
    const data = rows(2)
    data[0].sub = '병점노을4로 29'
    const wrapper = mount(NearbyPlaceSection, {
      props: { sectionKey: 'park', label: '공원', countLabel: '', rows: data },
    })
    const subs = wrapper.findAll('[data-testid="nearby-place-sub"]')
    expect(subs).toHaveLength(1)
    expect(subs[0].text()).toBe('병점노을4로 29')
  })

  it('badge 가 있는 행에만 배지 슬롯을 그린다', () => {
    const data = rows(2)
    data[0].badge = '2호선'
    const wrapper = mount(NearbyPlaceSection, {
      props: { sectionKey: 'subway', label: '지하철역', countLabel: '', rows: data },
      slots: { badge: ({ row }: { row: NearbyPlaceRowData }) => h('span', { 'data-testid': 'b' }, row.badge) },
    })
    const lis = wrapper.findAll('li')
    expect(lis[0].find('[data-testid="b"]').text()).toBe('2호선')
    expect(lis[1].find('[data-testid="b"]').exists()).toBe(false)
  })

  it('4·5번째 행도 DOM 에 두고 모바일에서만 max-md:hidden 으로 숨긴다', () => {
    const wrapper = mount(NearbyPlaceSection, {
      props: { sectionKey: 'park', label: '공원', countLabel: '', rows: rows(5) },
    })
    const lis = wrapper.findAll('li')
    expect(lis).toHaveLength(5)
    expect(lis.map((li) => li.classes().includes('max-md:hidden'))).toEqual([false, false, false, true, true])
  })

  it('3곳 이하면 버튼이 없고, 초과면 "n곳 모두 보기"/"접기" 를 aria-expanded 로 토글한다', async () => {
    const few = mount(NearbyPlaceSection, { props: { sectionKey: 'a', label: 'a', countLabel: '', rows: rows(3) } })
    expect(few.find('button').exists()).toBe(false)

    const wrapper = mount(NearbyPlaceSection, { props: { sectionKey: 'park', label: '공원', countLabel: '', rows: rows(5) } })
    const button = wrapper.find('button')
    expect(button.attributes('type')).toBe('button')
    expect(button.classes()).toContain('md:hidden')
    expect(button.attributes('aria-controls')).toBe('nearby-facility-list-park')
    expect(wrapper.find('ul').attributes('id')).toBe('nearby-facility-list-park')
    expect(button.text()).toBe('5곳 모두 보기')
    expect(button.attributes('aria-expanded')).toBe('false')

    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(button.text()).toBe('접기')
    expect(wrapper.findAll('li').some((li) => li.classes().includes('max-md:hidden'))).toBe(false)

    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.findAll('li')[3].classes()).toContain('max-md:hidden')
  })

  it('stacked 를 행에 전달한다', () => {
    const wrapper = mount(NearbyPlaceSection, {
      props: { sectionKey: 'park', label: '공원', countLabel: '', rows: rows(1), stacked: true },
    })
    expect(wrapper.find('a').classes()).toContain('min-h-[64px]')
  })
})

describe('NearbyPlaceSection — url 없는 행', () => {
  it('a 없이 이름·거리·도보가 렌더된다', () => {
    const wrapper = mount(NearbyPlaceSection, {
      props: { sectionKey: 'bus', label: '버스 정류장', countLabel: '1km 안 1곳', rows: [{ key: 'b1', name: '시청앞', distance: 150 }] },
    })
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).toContain('시청앞')
    expect(wrapper.text()).toContain('150m')
    expect(wrapper.text()).toContain('도보 약 2분')
  })
})
