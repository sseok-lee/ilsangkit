import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PageHero from '~/components/common/PageHero.vue'

describe('PageHero', () => {
  it('기본적으로 제목을 h1으로 렌더 (목록/허브 등 단독 제목 페이지)', () => {
    const wrapper = mount(PageHero, { props: { title: '공공화장실' } })

    const h1s = wrapper.findAll('h1')
    expect(h1s.length).toBe(1)
    expect(h1s[0].text()).toBe('공공화장실')
  })

  it('title-tag="div" 이면 h1 대신 role=heading aria-level=1 로 강등', () => {
    // 모바일 헤더가 이미 h1을 갖는 상세 페이지에서 중복 h1을 방지하면서
    // 데스크톱 스크린리더의 최상위 제목은 보존하기 위함.
    const wrapper = mount(PageHero, {
      props: { title: '반포자이', titleTag: 'div' },
    })

    expect(wrapper.findAll('h1').length).toBe(0)

    const heading = wrapper.get('[role="heading"]')
    expect(heading.attributes('aria-level')).toBe('1')
    expect(heading.text()).toBe('반포자이')
  })
})
