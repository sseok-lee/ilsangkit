import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../pages/[category]/index.vue'), 'utf8')
const template = src.slice(0, src.indexOf('<script'))

describe('시설 목록 페이지 평면형', () => {
  it('흰 바탕 + 로고 선 정렬 컨테이너, 회색 바탕·1200 고정폭 없음', () => {
    expect(template).toContain('page-container')
    expect(template).not.toContain('bg-background-light text-slate-900')
    expect(template).not.toContain('max-w-[1200px]')
  })

  it('PageHero 대신 PageHead(요약 줄 없음, D6)', () => {
    expect(template).not.toContain('<PageHero')
    expect(template).toMatch(/<PageHead[\s\S]*?:title="pageTitle"/)
    expect(src).toContain("import PageHead from '~/components/common/PageHead.vue'")
  })

  it('모든 SectionBlock 이 flat 이다', () => {
    const blocks = template.match(/<SectionBlock\b[^>]*>/g) ?? []
    expect(blocks.length).toBeGreaterThan(0)
    for (const b of blocks) expect(b).toContain('variant="flat"')
  })

  it('지역 칩·진료과목 필터는 flat 변형', () => {
    expect(template).toMatch(/<RegionChips[\s\S]*?variant="flat"/)
    expect(template).toMatch(/<HospitalDepartmentFilter[\s\S]*?variant="flat"/)
  })

  it('목록 개수는 제목 옆 글자("N곳"), 알약 배지 없음', () => {
    expect(template).not.toContain('rounded-full bg-primary/10 text-primary text-xs font-bold')
    expect(template).toContain("toLocaleString('ko-KR') }}</strong>곳")
  })

  it('광고는 2개 그대로', () => {
    expect((template.match(/<AdBanner\b/g) ?? []).length).toBe(2)
  })
})
