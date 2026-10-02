import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PageHead from '~/components/common/PageHead.vue'

describe('PageHead', () => {
  it('제목을 h1 하나로 렌더하고 글자 스케일 클래스를 쓴다', () => {
    const w = mount(PageHead, { props: { title: '병원' } })
    const h1s = w.findAll('h1')
    expect(h1s.length).toBe(1)
    expect(h1s[0].text()).toBe('병원')
    expect(h1s[0].classes()).toContain('ui-h1')
  })

  it('titleTag="div" 이면 h1 대신 role=heading aria-level=1 로 강등', () => {
    const w = mount(PageHead, { props: { title: '가가성형외과의원', titleTag: 'div' } })
    expect(w.findAll('h1').length).toBe(0)
    const heading = w.get('[role="heading"]')
    expect(heading.attributes('aria-level')).toBe('1')
    expect(heading.text()).toBe('가가성형외과의원')
  })

  it('분류 라벨은 알약이 아닌 글자다(D4)', () => {
    const w = mount(PageHead, { props: { title: '병원', eyebrow: '생활시설 목록' } })
    const label = w.get('[data-testid="page-head-eyebrow"]')
    expect(label.text()).toBe('생활시설 목록')
    expect(label.classes()).toContain('page-head__eyebrow')
    expect(label.classes()).not.toContain('rounded-full')
    expect(label.attributes('style')).toBeUndefined()
  })

  it('eyebrow·description 이 없으면 해당 요소를 렌더하지 않는다', () => {
    const w = mount(PageHead, { props: { title: '병원' } })
    expect(w.find('[data-testid="page-head-eyebrow"]').exists()).toBe(false)
    expect(w.find('.page-head__desc').exists()).toBe(false)
  })

  it('설명·이동 경로·동작 슬롯을 순서대로 렌더한다', () => {
    const w = mount(PageHead, {
      props: { title: '병원', description: '가까운 병원을 찾아보세요.' },
      slots: {
        breadcrumb: '<nav data-testid="bc">홈 / 병원</nav>',
        actions: '<button data-testid="share">공유</button>',
      },
    })
    expect(w.get('.page-head__desc').text()).toBe('가까운 병원을 찾아보세요.')
    const html = w.html()
    expect(html.indexOf('data-testid="bc"')).toBeLessThan(html.indexOf('<h1'))
    expect(w.find('.page-head__actions [data-testid="share"]').exists()).toBe(true)
  })

  it('요약 줄(통계)을 렌더하지 않는다 — 목록 머리 규칙(D6)', () => {
    const w = mount(PageHead, { props: { title: '병원' } })
    expect(w.find('.od-hero-stats').exists()).toBe(false)
    expect(w.find('dl').exists()).toBe(false)
  })

  it('기본 슬롯은 .page-head 안, 설명 뒤에 렌더된다', () => {
    const w = mount(PageHead, {
      props: { title: '병원', description: '설명' },
      slots: { default: '<div data-testid="extra">요약</div>' },
    })
    const extra = w.get('.page-head [data-testid="extra"]')
    expect(extra.text()).toBe('요약')
    expect(w.get('.page-head__desc').element.compareDocumentPosition(extra.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('기본 슬롯이 없으면 추가 DOM 이 없다', () => {
    const w = mount(PageHead, { props: { title: '병원' } })
    expect(w.find('.page-head').element.children.length).toBe(1)
  })
})
