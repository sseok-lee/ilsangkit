import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const content = readFileSync(resolve(__dirname, '../../../pages/subway/index.vue'), 'utf8')

describe('pages/subway/index.vue 흰색 평면형', () => {
  it('PageHead 를 쓰고 머리에 통계 셀이 없다(D6)', () => {
    expect(content).toContain('<PageHead')
    expect(content).not.toContain('<PageHero')
    expect(content).not.toContain('heroStats')
  })

  it('개수는 목록 제목 옆 글자 "N곳"이다', () => {
    expect(content).toMatch(/data-testid="list-count"[^>]*><strong class="font-semibold text-ink">\{\{ \(stations\?\.total \?\? 0\)\.toLocaleString\('ko-KR'\) \}\}<\/strong>곳<\/span>/)
    expect(content).not.toMatch(/rounded-full bg-primary\/10/)
  })

  it('정렬 컨테이너·평면 섹션이고 font-display·회색 select 바탕이 없다', () => {
    expect(content).toContain('page-container')
    expect(content).not.toContain('font-display')
    expect(content).not.toContain('bg-surface-2')
    expect(content.match(/<SectionBlock\b/g)?.length).toBe(content.match(/<SectionBlock\b(?:[^>"]|"[^"]*")*variant="flat"/g)?.length)
    expect(content).toContain('<DataSourceSection domain="facility" category="subway" variant="flat"')
  })

  it('광고 2개를 유지한다', () => {
    expect(content.match(/<AdBanner\b/g)?.length).toBe(2)
  })
})
