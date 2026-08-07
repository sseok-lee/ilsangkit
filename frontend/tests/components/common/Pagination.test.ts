import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Pagination from '~/components/common/Pagination.vue'

// 크롤러는 click 핸들러를 실행하지 않는다. 페이지네이션이 <button> 으로만 렌더되면
// 2페이지 이후로 가는 크롤 경로가 아예 없어서 목록의 첫 20건 외에는 사이트맵 전용 고아가 된다.
// hrefFor 를 주면 <a href> 로 렌더해 크롤 경로를 열되, 사용자 클릭은 기존 SPA 동작을 유지한다.

const hrefFor = (page: number) => (page > 1 ? `/hospital?page=${page}` : '/hospital')

function mountPagination(props: Record<string, unknown>) {
  return mount(Pagination, { props: { currentPage: 3, totalPages: 10, ...props } })
}

describe('Pagination', () => {
  describe('totalPages 가드', () => {
    it('totalPages 가 1 이하면 아무것도 렌더하지 않는다', () => {
      const wrapper = mountPagination({ currentPage: 1, totalPages: 1, hrefFor })
      expect(wrapper.find('a').exists()).toBe(false)
      expect(wrapper.find('button').exists()).toBe(false)
    })
  })

  describe('하위호환 — hrefFor 미제공', () => {
    it('기존처럼 <button> 으로 렌더하고 <a> 는 만들지 않는다', () => {
      const wrapper = mountPagination({})
      expect(wrapper.findAll('button').length).toBeGreaterThan(0)
      expect(wrapper.findAll('a').length).toBe(0)
    })

    it('클릭하면 pageChange 를 emit 한다', async () => {
      const wrapper = mountPagination({})
      const pageBtn = wrapper.findAll('button').find((b) => b.text() === '4')
      await pageBtn!.trigger('click')
      expect(wrapper.emitted('pageChange')?.[0]).toEqual([4])
    })
  })

  describe('hrefFor 제공 시 — 크롤 가능한 <a href>', () => {
    it('페이지 번호를 <a> 로 렌더하고 href 는 hrefFor 결과와 일치한다', () => {
      const wrapper = mountPagination({ hrefFor })
      const four = wrapper.findAll('a').find((a) => a.text() === '4')
      expect(four).toBeDefined()
      expect(four!.attributes('href')).toBe('/hospital?page=4')
    })

    it('이전/다음 화살표도 <a href> 로 렌더한다', () => {
      const wrapper = mountPagination({ hrefFor })
      const prev = wrapper.find('a[aria-label="이전 페이지"]')
      const next = wrapper.find('a[aria-label="다음 페이지"]')
      expect(prev.attributes('href')).toBe('/hospital?page=2')
      expect(next.attributes('href')).toBe('/hospital?page=4')
    })

    it('첫/마지막 페이지 링크도 <a href> 로 렌더한다', () => {
      const wrapper = mountPagination({ hrefFor })
      expect(wrapper.find('a[aria-label="첫 페이지"]').attributes('href')).toBe('/hospital')
      expect(wrapper.find('a[aria-label="마지막 페이지"]').attributes('href')).toBe('/hospital?page=10')
    })

    it('비활성 상태(1페이지의 이전/첫)는 <a> 가 아니라 disabled <button> 으로 남긴다', () => {
      const wrapper = mountPagination({ currentPage: 1, hrefFor })
      const first = wrapper.find('[aria-label="첫 페이지"]')
      expect(first.element.tagName).toBe('BUTTON')
      expect(first.attributes('disabled')).toBeDefined()
      expect(wrapper.find('a[aria-label="첫 페이지"]').exists()).toBe(false)
    })

    it('현재 페이지에도 aria-current 를 유지한다', () => {
      const wrapper = mountPagination({ hrefFor })
      const current = wrapper.findAll('a').find((a) => a.text() === '3')
      expect(current!.attributes('aria-current')).toBe('page')
    })
  })

  describe('클릭 동작 — SPA 유지 + 모디파이어 클릭 존중', () => {
    it('평범한 좌클릭은 기본 이동을 막고 pageChange 를 emit 한다', async () => {
      const wrapper = mountPagination({ hrefFor })
      const four = wrapper.findAll('a').find((a) => a.text() === '4')!
      let defaultPrevented = false
      await four.trigger('click', {
        button: 0,
        preventDefault() {
          defaultPrevented = true
        },
      })
      expect(defaultPrevented).toBe(true)
      expect(wrapper.emitted('pageChange')?.[0]).toEqual([4])
    })

    it('ctrl/meta 클릭은 막지 않아 새 탭 열기가 동작한다', async () => {
      const wrapper = mountPagination({ hrefFor })
      const four = wrapper.findAll('a').find((a) => a.text() === '4')!
      let defaultPrevented = false
      await four.trigger('click', {
        button: 0,
        metaKey: true,
        preventDefault() {
          defaultPrevented = true
        },
      })
      expect(defaultPrevented).toBe(false)
      expect(wrapper.emitted('pageChange')).toBeUndefined()
    })
  })
})
