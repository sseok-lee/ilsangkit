import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// PR7b — 청약 화면이 자체 구현 대신 공통 부품·토큰을 쓴다(스펙 2026-10-02 §5 PR7).
const root = resolve(__dirname, '../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')
const FILES = [
  'pages/subscription/index.vue',
  'pages/subscription/[id].vue',
  'components/subscription/SubscriptionListView.vue',
  'components/subscription/SubscriptionNoticeRow.vue',
  'components/subscription/SubscriptionNav.vue',
]
// 의미 색(오류·경고·상태 칩)만 hex 로 남긴다 — 대응 토큰이 없다(§3.7).
const SEMANTIC_HEX = new Set(['#b42318', '#9a3412', '#b55230', '#1d684b', '#edf7f1'])
const styleOf = (src: string) => [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')

describe('청약 흰색 평면형', () => {
  it.each(FILES)('%s: 중립 hex·그림자·원시 회색·:deep 없음', (file) => {
    const src = read(file)
    const style = styleOf(src)
    const hex = [...style.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase()).filter((h) => !SEMANTIC_HEX.has(h))
    expect(hex).toEqual([])
    expect(style).not.toMatch(/box-shadow:\s*(?!none)/)
    expect(src).not.toMatch(/\b(?:shadow-(?:sm|md|lg|xl|card)(?![\w-]))/)
    expect(src).not.toMatch(/\b(?:bg|text|border)-(?:slate|gray)-\d/)
    const deep = [...style.matchAll(/^.*:deep\(.*$/gm)].map((m) => m[0].trim()).filter((l) => !l.startsWith('.roadview-wrapper :deep(> div'))
    expect(deep).toEqual([])
  })

  it('허브·상세는 PageHead·정렬 컨테이너를 쓰고 페이지 안에 <main> 을 두지 않는다', () => {
    for (const file of ['pages/subscription/index.vue', 'pages/subscription/[id].vue']) {
      const src = read(file)
      expect(src).toContain('<PageHead')
      expect(src).toContain('page-container')
      expect(src).not.toMatch(/<main\b/)
      expect(src).not.toMatch(/<DataSourceSection(?![^>]*variant="flat")[^>]*>/)
    }
  })

  it('상세 SectionBlock 은 모두 flat 이다', () => {
    const src = read('pages/subscription/[id].vue')
    const blocks = [...src.matchAll(/<SectionBlock\b[\s\S]*?>/g)].map((m) => m[0])
    expect(blocks.length).toBeGreaterThanOrEqual(10)
    expect(blocks.filter((b) => !b.includes('variant="flat"'))).toEqual([])
  })

  it('목록 탭은 세그먼트, 지역 선택은 flat 이다', () => {
    const src = read('components/subscription/SubscriptionListView.vue')
    expect([...src.matchAll(/<SegmentedControl\b/g)]).toHaveLength(2)
    expect(src).toMatch(/<RegionCascadingDropdown[\s\S]*?variant="flat"/)
    expect(src).not.toMatch(/<DataSourceSection(?![^>]*variant="flat")[^>]*>/)
  })

  it('분양·임대 목록 4페이지는 PageHead 를 쓴다', () => {
    for (const file of ['pages/subscription/sale/index.vue', 'pages/subscription/sale/[type].vue', 'pages/subscription/rent/index.vue', 'pages/subscription/rent/[type].vue']) {
      const src = read(file)
      expect(src).toContain('<PageHead')
      expect(src).not.toMatch(/<h1\b/)
    }
  })

  it('사용처 0 카드 컴포넌트가 삭제됐다', () => {
    expect(existsSync(resolve(root, 'components/subscription/SubscriptionCard.vue'))).toBe(false)
    expect(existsSync(resolve(root, 'components/subscription/SpecialSupplyCard.vue'))).toBe(false)
  })
})
