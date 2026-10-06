import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// PR7d-2 — 공통 부품의 card 분기를 지우고 flat 을 유일한 모양으로(스펙 2026-10-02 §5 PR7).
const root = resolve(__dirname, '../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

const PRIMITIVES = [
  'components/common/SectionBlock.vue',
  'components/common/RegionCascadingDropdown.vue',
  'components/common/RegionChips.vue',
  'components/common/DataSourceSection.vue',
  'components/common/MobileDetailHeader.vue',
  'components/facility/HospitalDepartmentFilter.vue',
  'components/blog/BlogReviewSection.vue',
  'components/guide/RelatedGuides.vue',
  'components/facility/detail/DetailNearby.vue',
]

describe('공통 부품 평면형 단일화', () => {
  it.each(PRIMITIVES)('%s: card 분기·원시 회색·그림자가 없다', (file) => {
    const src = read(file)
    expect(src).not.toMatch(/['"]card['"]/)
    expect(src).not.toMatch(/\b(?:text|bg|border|ring|divide)-(?:slate|gray)-\d/)
    expect(src).not.toMatch(/\bshadow-(?:subtle|sm|md|lg|xl|2xl)\b/)
    expect(src).not.toMatch(/\bshadow-card(?!-2)\b/)
    expect(src).not.toMatch(/PR7 에서 flat/)
  })

  it('RelatedGuides 는 inline 변형을 갖는다(다른 섹션 안에 넣을 때)', () => {
    const src = read('components/guide/RelatedGuides.vue')
    expect(src).toMatch(/variant\?:\s*'flat'\s*\|\s*'inline'/)
  })
})

describe('기본값에 기대던 호출부', () => {
  it('가이드 상세 "관련 정보"는 flat 이고 관련 가이드는 inline 이다', () => {
    const src = read('pages/guide/[slug].vue')
    expect(src).toMatch(/<SectionBlock\b(?=[^>]*\bvariant="flat")[^>]*\bheading="관련 정보"/)
    expect(src).toMatch(/<RelatedGuides\b[^>]*\bvariant="inline"/)
  })

  it('청약 상세 관련 가이드는 flat 이다', () => {
    expect(read('pages/subscription/[id].vue')).toMatch(/<RelatedGuides\b[^>]*\bvariant="flat"/)
  })

  it('공매 필터 지역 선택은 flat 이다', () => {
    expect(read('components/auction/AuctionFilters.vue')).toMatch(/<RegionCascadingDropdown\b[^>]*\bvariant="flat"/)
  })

  it.each(['pages/guide/[slug].vue', 'pages/article/[slug].vue'])('%s: 본문은 SectionBlock 땜질 대신 일반 section 이다', (file) => {
    const src = read(file)
    expect(src).not.toMatch(/<SectionBlock[^>]*class="reading-body"/)
    expect(src).toContain('<section class="reading-body">')
    expect(src).not.toMatch(/\.reading-body\s*\{[^}]*box-shadow/)
  })
})

const walkVue = (dir: string): string[] =>
  readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) return walkVue(rel)
    return e.name.endsWith('.vue') ? [rel] : []
  })

describe('호출부에 card 변형이 남지 않는다', () => {
  const files = ['pages', 'components', 'layouts'].flatMap(walkVue)
  const CARD_TAG = /<(?:SectionBlock|DetailNearby|RegionCascadingDropdown|RegionChips|HospitalDepartmentFilter|DataSourceSection|BlogReviewSection|RelatedGuides|MobileDetailHeader)\b[^>]*\bvariant="card"/s
  const CARD_SECTION = /\bsection-?[vV]ariant="card"/

  it('vue 파일을 실제로 스캔한다', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('공통 부품 태그에 variant="card" 가 없다', () => {
    expect(files.filter(f => CARD_TAG.test(read(f)))).toEqual([])
  })

  it('section-variant="card" / sectionVariant="card" 가 없다', () => {
    expect(files.filter(f => CARD_SECTION.test(read(f)))).toEqual([])
  })
})
