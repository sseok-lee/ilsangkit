import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DETAIL_PAGES = [
  { page: 'pages/[category]/[id].vue', marker: '<!-- Ad: HERO 아래' },
  {
    page: 'pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue',
    marker: '<!-- Ad: Hero 직후',
  },
]

function source(rel: string): string {
  const root = process.cwd().endsWith('/frontend')
    ? process.cwd()
    : resolve(process.cwd(), 'frontend')
  return readFileSync(resolve(root, rel), 'utf8')
}

// Viewport defaults and explicit overrides are exercised by mounted AdBanner tests.
describe('상세 페이지 광고 호출 계약', () => {
  for (const { page, marker } of DETAIL_PAGES) {
    it(`${page.split('/').pop()} 의 Hero 첫 슬롯은 높이 예약 없이 full-width 확장을 끈다`, () => {
      const s = source(page)
      const markerIndex = s.indexOf(marker)
      expect(markerIndex).toBeGreaterThanOrEqual(0)
      const tagStart = s.indexOf('<AdBanner', markerIndex)
      expect(tagStart).toBeGreaterThan(markerIndex)
      const tag = s.slice(tagStart, s.indexOf('>', tagStart) + 1)
      expect(tag).toContain('full-width-responsive="false"')
      expect(tag).not.toMatch(/\b(?:sizing|fixed-height|ad-format)=/)
      expect(s).not.toContain('variant="compact-mobile"')
    })
    it(`${page.split('/').pop()} 의 나머지 세 슬롯은 포맷과 full-width 기본 정책을 유지한다`, () => {
      const slots = [...source(page).matchAll(/<AdBanner\b[^>]*>/g)]
        .map((match) => match[0])
        .filter((tag) => !tag.includes('variant="mobile-banner-320x100"'))
      expect(slots).toHaveLength(4)
      for (const tag of slots.slice(1)) {
        expect(tag).not.toMatch(/\b(?:sizing|fixed-height|ad-format|full-width-responsive)=/)
      }
    })
  }
  it('부동산 상세 슬롯의 모바일·데스크톱 순서를 유지한다', () => {
    const s = source(DETAIL_PAGES[1].page)
    const slots = [...s.matchAll(/<AdBanner\b[^>]*>/g)]
      .map((match) => match[0])
      .filter((tag) => !tag.includes('variant="mobile-banner-320x100"'))
    expect(slots.map((tag) => tag.match(/class="([^"]*)"/)?.[1])).toEqual([
      'estate-ad-slot estate-ad-slot--first order-3 md:order-3',
      'estate-ad-slot order-5 md:order-6',
      'estate-ad-slot order-7 md:order-8',
      'estate-ad-slot order-12 md:order-12',
    ])
  })
  it('부동산 헤더 신규 슬롯은 전용 모바일 variant만 지정한다', () => {
    const slots = [...source(DETAIL_PAGES[1].page).matchAll(/<AdBanner\b[^>]*>/g)]
      .map((match) => match[0])
      .filter((tag) => tag.includes('variant="mobile-banner-320x100"'))
    expect(slots).toHaveLength(1)
    expect(slots[0]).toContain('only="mobile"')
    expect(slots[0]).toContain('data-testid="building-header-ad"')
    expect(slots[0]).toContain('class="estate-header-mobile-ad"')
    expect(slots[0]).not.toMatch(/\b(?:sizing|fixed-height|ad-format|full-width-responsive)=/)
  })
})
