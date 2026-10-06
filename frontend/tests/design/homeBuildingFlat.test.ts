import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// PR7c — 홈·단지 상세가 자체 구현(.housing-*, .estate-*) 대신 공통 부품·토큰을 쓴다(스펙 2026-10-02 §5 PR7).
const root = resolve(__dirname, '../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')
const BUILDING = 'pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue'
// 오류 상자 주황(의미 색)만 hex 로 남긴다 — 대응 토큰이 없다(§3.7).
const SEMANTIC_HEX = new Set(['#9a3412', '#fed7aa', '#fdba74', '#fff7ed'])
const styleOf = (src: string) => [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')

describe('단지 상세 흰색 평면형', () => {
  it('중립 hex·그림자·원시 회색·:deep(로드뷰 제외) 없음', () => {
    const src = read(BUILDING)
    const style = styleOf(src)
    const hex = [...style.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase()).filter((h) => !SEMANTIC_HEX.has(h))
    expect(hex).toEqual([])
    expect(style).not.toMatch(/--estate-/)
    expect(style).not.toMatch(/box-shadow/)
    expect(src).not.toMatch(/\bshadow-(?:subtle|sm|md|lg|xl|2xl)\b/)
    expect(src).not.toMatch(/\bshadow-card(?!-2)\b/)
    expect(src).not.toMatch(/\b(?:text|bg|border|ring|divide)-(?:slate|gray)-\d/)
    const deep = [...style.matchAll(/^.*:deep\(.*$/gm)].map((m) => m[0].trim()).filter((l) => !l.startsWith('.roadview-wrapper :deep(> div'))
    expect(deep).toEqual([])
  })

  it('정렬 컨테이너·PageHead·SummaryRow lead 를 쓰고 자체 머리 CSS 가 없다', () => {
    const src = read(BUILDING)
    expect(src).toContain('page-container')
    expect(src).not.toContain('max-w-[1200px]')
    expect(src).toContain('<PageHead')
    expect(src).toMatch(/<SummaryRow[\s\S]*?\blead\b[\s\S]*?aria-label="실거래 요약"|<SummaryRow[\s\S]*?aria-label="실거래 요약"[\s\S]*?\blead\b/)
    for (const cls of ['.estate-detail-head', '.estate-title', '.estate-summary', '.estate-share-button', '.estate-flat-section', '.estate-section-head']) {
      expect(styleOf(src)).not.toContain(cls)
    }
  })

  it('SectionBlock 은 모두 flat 이고 하위 공유 섹션도 flat 이다', () => {
    const src = read(BUILDING)
    const blocks = [...src.matchAll(/<SectionBlock\b[\s\S]*?>/g)].map((m) => m[0])
    expect(blocks.length).toBeGreaterThanOrEqual(9)
    expect(blocks.filter((b) => !b.includes('variant="flat"'))).toEqual([])
    expect(src).toMatch(/<RelatedGuides[^>]*variant="flat"/)
    expect(src).toMatch(/<BlogReviewSection[\s\S]*?variant="flat"[\s\S]*?\/>/)
    expect(src).toMatch(/<DataSourceSection[^>]*variant="flat"/)
    expect(src).not.toMatch(/<DataSourceSection[^>]*\bcompact\b/)
  })
})

describe('홈 흰색 평면형', () => {
  it.each(['pages/index.vue', 'components/subscription/HomeSubscriptionSection.vue'])('%s: 1200px 자체 컨테이너 없음', (file) => {
    const src = read(file)
    expect(src).not.toContain('max-w-[1200px]')
    expect(src).toContain('page-container')
  })

  it('main.css 의 .housing-* 는 사용 중인 두 규칙만 남고 hex 가 없다', () => {
    const css = read('assets/css/main.css')
    for (const dead of ['.housing-amount', '.housing-section', '.housing-divider', '.housing-table']) {
      expect(css).not.toContain(dead)
    }
    const block = css.slice(css.indexOf('.housing-redesign'), css.indexOf('.od-amen'))
    expect(block).toContain('.housing-title')
    expect(block.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull()
  })
})
