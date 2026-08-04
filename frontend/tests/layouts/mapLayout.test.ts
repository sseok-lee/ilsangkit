import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MapLayout from '~/layouts/map.vue'

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setOrganizationSchema: vi.fn() }),
}))

function mountLayout() {
  return mount(MapLayout, {
    slots: { default: '<div data-testid="page-content" />' },
    global: {
      // stub 에 name 을 반드시 준다 — name 이 없으면 findComponent({ name }) 가
      // 아무것도 찾지 못해 prop 검증이 조용히 무력해진다.
      stubs: {
        AppHeader: { name: 'AppHeader', template: '<header data-testid="app-header" />', props: ['wide'] },
      },
      mocks: { useRoute: () => ({ path: '/real-estate', params: {}, query: {} }) },
    },
  })
}

describe('layouts/map.vue', () => {
  it('루트를 h-screen overflow-hidden 으로 잠가 페이지 스크롤을 없앤다', () => {
    // 높이 계산이 어긋나도 스크롤바가 생기지 않게 구조로 막는다(설계문서 5.1).
    expect(mountLayout().find('div').classes()).toEqual(
      expect.arrayContaining(['h-screen', 'overflow-hidden', 'flex', 'flex-col']),
    )
  })

  it('main 에 flex-1 min-h-0 을 준다', () => {
    // min-h-0 이 없으면 flex 자식의 기본 min-height:auto 때문에
    // 내부 오버플로가 부모를 밀어내 overflow-hidden 이 무력해진다.
    expect(mountLayout().find('main').classes()).toEqual(expect.arrayContaining(['flex-1', 'min-h-0']))
  })

  it('스킵 링크가 동작하도록 main 에 id·tabindex 를 준다', () => {
    const main = mountLayout().find('main')
    expect(main.attributes('id')).toBe('main')
    expect(main.attributes('tabindex')).toBe('-1')
  })

  it('본문 바로가기 스킵 링크를 유지한다', () => {
    const skip = mountLayout().find('a[href="#main"]')
    expect(skip.exists()).toBe(true)
    expect(skip.text()).toBe('본문 바로가기')
  })

  it('푸터와 TrustLine 을 렌더하지 않는다', () => {
    // 이 둘이 남아 있으면 페이지 스크롤을 0으로 만들 수 없다(실측 합계 약 410px).
    // 푸터는 사이드바 목록 하단이 대신한다.
    const w = mountLayout()
    expect(w.find('footer').exists()).toBe(false)
    expect(w.text()).not.toContain('공공데이터 기반 서비스')
  })

  it('헤더에 wide 를 넘긴다', () => {
    expect(mountLayout().findComponent({ name: 'AppHeader' }).props('wide')).toBe(true)
  })

  it('슬롯 콘텐츠를 main 안에 렌더한다', () => {
    expect(mountLayout().find('main [data-testid="page-content"]').exists()).toBe(true)
  })
})
