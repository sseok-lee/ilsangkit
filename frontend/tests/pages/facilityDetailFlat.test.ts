import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../pages/[category]/[id].vue'), 'utf8')
const template = src.slice(0, src.indexOf('<script'))

describe('시설 상세 페이지 평면형', () => {
  it('흰 바탕 + 정렬 컨테이너, :deep 그림자 덮어쓰기 삭제', () => {
    expect(template).toContain('page-container')
    expect(template).not.toContain('max-w-[1200px]')
    expect(template).not.toMatch(/detail-page[^"]*bg-background-light/)
    expect(src).not.toMatch(/:deep\(\.shadow-card\)/)
  })

  it('데스크톱 머리는 PageHead(div 강등) + SummaryRow', () => {
    expect(template).not.toContain('<PageHero')
    expect(template).toMatch(/<PageHead[\s\S]*?title-tag="div"/)
    expect(template).toMatch(/<SummaryRow[\s\S]*?desktopSummaryItems/)
  })

  it('모바일 헤더·주변 시설·위치 섹션은 flat', () => {
    expect(template).toMatch(/<MobileDetailHeader[\s\S]*?variant="flat"/)
    expect(template).toMatch(/<DetailNearby[\s\S]*?section-variant="flat"/)
    expect(template).toMatch(/<BlogReviewSection[\s\S]*?variant="flat"/)
    expect(template).toContain('<SectionBlock id="facility-location" variant="flat"')
  })
})

describe('시설 상세 하단 공유 섹션(DetailContextLinks)', () => {
  const ctx = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../components/facility/detail/DetailContextLinks.vue'), 'utf8')
  const ctxTemplate = ctx.slice(0, ctx.indexOf('<script'))
  it('RelatedGuides·DataSourceSection 은 flat 변형', () => {
    expect(ctxTemplate).toMatch(/<RelatedGuides\b[^>]*variant="flat"/)
    expect(ctxTemplate).toMatch(/<DataSourceSection\b[^>]*variant="flat"/)
  })
})
