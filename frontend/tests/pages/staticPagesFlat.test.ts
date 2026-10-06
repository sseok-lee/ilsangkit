import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(resolve(__dirname, '../../', p), 'utf8')
const PAGES = ['pages/about.vue', 'pages/contact.vue', 'pages/privacy.vue', 'pages/terms.vue']

describe('정적 페이지 흰색 평면형', () => {
  it.each(PAGES)('%s: PageHead·정렬 컨테이너, StaticPageHeader·중첩 main·:deep 없음', (file) => {
    const src = read(file)
    expect(src).toContain('<PageHead')
    expect(src).not.toContain('StaticPageHeader')
    expect(src).toContain('page-container')
    expect(src).not.toMatch(/<main\b/)
    expect(src).not.toMatch(/:deep\(/)
  })

  it('about: 섹션 h2 가 h1 보다 크지 않다(역전 수정)', () => {
    const src = read('pages/about.vue')
    expect(src).not.toMatch(/<h2[^>]*text-\[(?:28|36)px\]/)
    expect(src).not.toMatch(/<h2[^>]*md:text-\[36px\]/)
  })

  it('privacy·terms: 업데이트 날짜 배지를 유지한다', () => {
    for (const file of ['pages/privacy.vue', 'pages/terms.vue']) {
      expect(read(file)).toMatch(/마지막 업데이트 2026\.06\.01/)
    }
  })

  it('about: 데이터 출처 표는 좁은 화면에서 가로 스크롤을 위해 최소 폭을 클래스로 갖는다', () => {
    expect(read('pages/about.vue')).toMatch(/<table class="[^"]*min-w-\[540px\]/)
  })
})
