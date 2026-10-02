import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// PR7a — 토지·공매 페이지가 PageHero·remaining-property.css 의 덮어쓰기 대신 공통 부품을 쓴다.
const root = resolve(__dirname, '../..')
const PAGES = [
  'pages/auction/index.vue',
  'pages/auction/list.vue',
  'pages/auction/ranking.vue',
  'pages/auction/[city]/index.vue',
  'pages/auction/[city]/[district]/index.vue',
  'pages/auction/item/[cltrMngNo].vue',
  'pages/real-estate/land/index.vue',
  'pages/real-estate/land/[city]/index.vue',
  'pages/real-estate/land/[city]/[district]/index.vue',
  'pages/real-estate/land/[city]/[district]/[dong].vue',
]
const PROPERTY_CLASS = /\bproperty-(?:redesign|hero|section|region-list|region-link|search|stat|actions|filter-pane)\b/

describe('토지·공매 공통 부품 이전', () => {
  it.each(PAGES)('%s', (file) => {
    const src = readFileSync(resolve(root, file), 'utf8')
    expect(src).not.toContain('PageHero')
    expect(src).not.toContain('remaining-property')
    expect(src.match(PROPERTY_CLASS)?.[0] ?? null).toBeNull()
    expect(src).toContain('<PageHead')
    expect(src).toContain('page-container')
    expect(src).not.toMatch(/<DataSourceSection(?![^>]*variant="flat")[^>]*>/)
    expect(src).not.toMatch(/<SectionBlock(?![^>]*variant="flat")[\s>]/)
  })

  it('행 목록 전역 클래스가 평면형 공통 블록 안에 있다', () => {
    const css = readFileSync(resolve(root, 'assets/css/main.css'), 'utf8')
    const start = css.indexOf('흰색 평면형 공통 기준')
    const end = css.indexOf('흰색 평면형 공통 기준 끝')
    const block = css.slice(start, end)
    expect(block).toContain('.row-list {')
    expect(block).toContain('.row-list__link {')
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
