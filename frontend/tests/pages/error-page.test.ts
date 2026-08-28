import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ErrorPage from '~/error.vue'

// error.vue 는 Nuxt 전역 clearError 를 쓴다 — setup.ts 에 없어 여기서 목으로 채운다.
const clearError = vi.fn()
;(globalThis as unknown as { clearError: unknown }).clearError = clearError

const stubs = {
  Head: { template: '<div><slot /></div>' },
  Title: { template: '<title><slot /></title>' },
  Meta: { template: '<span />' },
  AppHeader: { template: '<header />' },
  AppFooter: { template: '<footer />' },
}

function render(error: Record<string, unknown>) {
  return mount(ErrorPage, { props: { error }, global: { stubs } })
}

beforeEach(() => clearError.mockClear())

describe('error.vue — 410 Gone (폐원 어린이집 실측 케이스)', () => {
  const gone = { statusCode: 410, statusMessage: 'Facility permanently removed', url: '/childcare/childcare-27230000317' }

  it('"오류가 발생했습니다" 를 쓰지 않는다 — GA4 에 잡힌 그 문구가 회귀 대상', () => {
    const text = render(gone).text()
    expect(text).not.toContain('오류가 발생했습니다')
    expect(text).toContain('운영이 종료된 시설입니다')
  })

  it('영구 응답인데 "잠시 후 다시 시도" 로 안내하지 않는다', () => {
    expect(render(gone).text()).not.toContain('다시 시도')
  })

  it('폐업·폐원 사실과 카테고리를 알린다', () => {
    const text = render(gone).text()
    expect(text).toContain('폐업·폐원')
    expect(text).toContain('어린이집')
  })

  it('같은 카테고리 목록 CTA 를 primary 로 노출한다', () => {
    const cta = render(gone).findAll('a').find((a) => a.attributes('href') === '/childcare')
    expect(cta).toBeDefined()
    expect(cta!.text()).toContain('어린이집 전체 보기')
    expect(cta!.classes().join(' ')).toContain('bg-primary')
  })

  it('탈출구(재검색 폼 + 바로가기)를 노출한다 — 기존엔 404 전용이라 410 에선 사라졌다', () => {
    const w = render(gone)
    expect(w.find('input[type="search"]').exists()).toBe(true)
    expect(w.findAll('a').some((a) => a.attributes('href') === '/hospital')).toBe(true)
  })

  it('재검색을 부동산 전용 /search 가 아니라 해당 카테고리로 보낸다', async () => {
    const w = render(gone)
    await w.find('input[type="search"]').setValue('미소')
    await w.find('form').trigger('submit')
    expect(clearError).toHaveBeenCalledWith({ redirect: `/childcare?keyword=${encodeURIComponent('미소')}` })
  })

  it('검색 placeholder 가 카테고리 스코프를 따른다', () => {
    expect(render(gone).find('input[type="search"]').attributes('placeholder')).toContain('어린이집')
  })

  it('url 이 없어도 렌더되고 gone 문구를 유지한다', () => {
    const text = render({ statusCode: 410 }).text()
    expect(text).toContain('삭제된 페이지입니다')
    expect(text).not.toContain('오류가 발생했습니다')
  })
})

describe('error.vue — 404 기존 동작 회귀', () => {
  const notFound = { statusCode: 404, url: '/nope' }

  it('문구와 탈출구가 그대로다', () => {
    const w = render(notFound)
    expect(w.text()).toContain('페이지를 찾을 수 없습니다')
    expect(w.find('input[type="search"]').exists()).toBe(true)
  })

  it('카테고리 CTA 없이 홈이 primary 다', () => {
    const w = render(notFound)
    const home = w.findAll('a').find((a) => a.attributes('href') === '/')
    expect(home!.classes().join(' ')).toContain('bg-primary')
  })

  it('시설 컨텍스트가 없으면 재검색은 부동산(/search)으로 간다', async () => {
    const w = render(notFound)
    await w.find('input[type="search"]').setValue('래미안')
    await w.find('form').trigger('submit')
    expect(clearError).toHaveBeenCalledWith({ redirect: `/search?keyword=${encodeURIComponent('래미안')}` })
  })
})

describe('error.vue — 5xx 기존 동작 회귀', () => {
  it('일시 장애 문구를 쓰고 탈출구는 띄우지 않는다 (재시도가 정답)', () => {
    const w = render({ statusCode: 503, url: '/childcare/childcare-1' })
    expect(w.text()).toContain('오류가 발생했습니다')
    expect(w.text()).toContain('다시 시도')
    expect(w.find('input[type="search"]').exists()).toBe(false)
  })

  it('statusCode 가 없으면 500 화면', () => {
    expect(render({}).text()).toContain('오류가 발생했습니다')
  })
})
