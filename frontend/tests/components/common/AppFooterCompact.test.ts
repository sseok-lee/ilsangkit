import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppFooter from '~/components/common/AppFooter.vue'

// AppFooter 는 useSyncStatus 를 쓰지만 그 안의 useAsyncData/$fetch/useApiBase 는
// tests/setup.ts 에서 전역 mock 되어 있어 추가 준비가 필요 없다.
function mountFooter(props: Record<string, unknown> = {}) {
  return mount(AppFooter, {
    props,
    global: {
      stubs: { HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } },
    },
  })
}

/** 모든 링크의 href 를 정렬해 반환 — 모드별 내용 동일성 비교용 */
function hrefs(wrapper: ReturnType<typeof mountFooter>): string[] {
  return wrapper.findAll('a[href]').map((a) => a.attributes('href') ?? '').sort()
}

describe('AppFooter compact', () => {
  it('기본은 4열 그리드다', () => {
    expect(mountFooter().find('footer div.grid').classes()).toContain('md:grid-cols-4')
  })

  it('compact 는 1열 그리드다', () => {
    // 사이드바 폭이 320px 이라 4열 그리드가 들어가지 않는다(설계문서 7.2).
    const cls = mountFooter({ compact: true }).find('footer div.grid').classes()
    expect(cls).toContain('grid-cols-1')
    expect(cls).not.toContain('md:grid-cols-4')
    expect(cls).not.toContain('grid-cols-2')
  })

  it('compact 는 컨테이너·내부 폭 제한을 걸지 않는다', () => {
    const w = mountFooter({ compact: true })
    expect(w.find('footer > div').classes()).not.toContain('container')
    expect(w.find('footer div.grid').classes()).not.toContain('max-w-4xl')
  })

  it('compact 는 세로 여백을 줄인다', () => {
    expect(mountFooter({ compact: true }).find('footer').classes()).toContain('py-5')
    expect(mountFooter().find('footer').classes()).toContain('md:py-10')
  })

  it('compact 는 role="contentinfo" 를 명시한다 — main 안에 렌더되어 암묵 랜드마크를 잃는다', () => {
    expect(mountFooter({ compact: true }).find('footer').attributes('role')).toBe('contentinfo')
  })

  it('기본 모드는 role 을 명시하지 않는다 — 이미 body 레벨이라 암묵 role 과 중복된다', () => {
    expect(mountFooter().find('footer').attributes('role')).toBeUndefined()
  })

  // 이 푸터는 다른 페이지 푸터와 내용이 같아야 한다. 레이아웃만 바뀐다.
  it('compact 여도 링크와 고지문은 기본 모드와 완전히 같다', () => {
    const base = mountFooter()
    const compact = mountFooter({ compact: true })
    expect(hrefs(compact)).toEqual(hrefs(base))
    expect(hrefs(compact)).toContain('/privacy')
    expect(hrefs(compact)).toContain('/terms')
    expect(compact.text()).toContain('공공누리')
    expect(compact.text()).toContain('All rights reserved')
  })
})
