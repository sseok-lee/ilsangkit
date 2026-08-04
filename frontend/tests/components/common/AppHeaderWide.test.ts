import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppHeader from '~/components/common/AppHeader.vue'

// AppHeader 는 HeaderSearch·HardLink·CategoryIcon 과 useRoute 를 물고 있다.
// 기존 관례(tests/components/common/AppHeaderSearch.test.ts)를 그대로 따른다.
function mountHeader(props: Record<string, unknown> = {}) {
  return mount(AppHeader, {
    props,
    global: {
      stubs: { HardLink: true, CategoryIcon: true, HeaderSearch: true },
      mocks: { useRoute: () => ({ path: '/real-estate', params: {}, query: {} }) },
    },
  })
}

/** 헤더 내부의 폭을 결정하는 래퍼 div */
function wrapperClasses(props: Record<string, unknown> = {}) {
  return mountHeader(props).find('header > div').classes()
}

describe('AppHeader wide', () => {
  it('기본값은 max-w-[1200px] 로 폭을 묶는다', () => {
    expect(wrapperClasses()).toContain('max-w-[1200px]')
  })

  it('wide 면 폭 제한을 풀어 화면 전체를 채운다', () => {
    // 지도 페이지는 지도 폭을 줄이지 않으면서 헤더와 좌우 경계를 맞춰야 한다.
    // 지도를 1200px 로 좁히는 대신 헤더의 제한을 푸는 방향을 택했다(설계문서 5.2).
    expect(wrapperClasses({ wide: true })).not.toContain('max-w-[1200px]')
  })

  it('wide 여부와 무관하게 정렬·레이아웃 클래스는 유지한다', () => {
    for (const wide of [false, true]) {
      expect(wrapperClasses({ wide })).toEqual(
        expect.arrayContaining(['mx-auto', 'flex', 'h-full', 'w-full', 'items-center']),
      )
    }
  })
})
