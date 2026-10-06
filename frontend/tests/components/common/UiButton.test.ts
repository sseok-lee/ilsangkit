import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiButton from '~/components/common/UiButton.vue'

describe('UiButton', () => {
  it('기본은 type=button 인 primary 버튼', () => {
    const w = mount(UiButton, { slots: { default: '검색' } })
    const el = w.get('button')
    expect(el.attributes('type')).toBe('button')
    expect(el.classes()).toEqual(expect.arrayContaining(['ui-btn', 'ui-btn--primary']))
    expect(el.text()).toBe('검색')
  })

  it.each(['secondary', 'link'] as const)('variant=%s 클래스', (variant) => {
    const w = mount(UiButton, { props: { variant } })
    expect(w.get('button').classes()).toContain(`ui-btn--${variant}`)
  })

  it('to 가 있으면 내부 링크로 렌더한다', () => {
    const w = mount(UiButton, { props: { to: '/' }, slots: { default: '홈으로' } })
    expect(w.find('button').exists()).toBe(false)
    expect(w.get('a').attributes('href')).toBe('/')
  })

  it('external href 는 새 창 + noopener', () => {
    const w = mount(UiButton, { props: { href: 'https://www.data.go.kr', external: true } })
    const a = w.get('a')
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toBe('noopener noreferrer')
  })

  it('submit·disabled 를 버튼에 전달한다', () => {
    const w = mount(UiButton, { props: { type: 'submit', disabled: true } })
    expect(w.get('button').attributes('type')).toBe('submit')
    expect(w.get('button').attributes('disabled')).toBeDefined()
  })

  it('to 에 쿼리 객체를 넘기면 NuxtLink 에 그대로 전달한다', () => {
    const NuxtLinkStub = { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' }
    const w = mount(UiButton, {
      props: { variant: 'secondary', to: { path: '/facilities', query: { city: 'seoul' } } },
      slots: { default: '생활시설 전체 보기' },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    expect(JSON.parse(w.get('a').attributes('data-to')!)).toEqual({ path: '/facilities', query: { city: 'seoul' } })
    expect(w.get('a').classes()).toContain('ui-btn--secondary')
  })
})
