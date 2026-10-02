import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../pages/[city]/[district]/index.vue'), 'utf8')
const template = src.slice(0, src.indexOf('<script'))

describe('구·군 허브 평면형', () => {
  it('흰 바탕 + 정렬 컨테이너 + PageHead', () => {
    expect(template).toContain('page-container')
    expect(template).not.toContain('max-w-6xl')
    expect(template).not.toContain('<PageHero')
    expect(template).toMatch(/<PageHead\b[^>]*eyebrow="지역 허브"/)
  })

  it('생활시설 탐색은 평면 섹션 + 오른쪽 보조 버튼', () => {
    expect(template).not.toMatch(/<div\b[^>]*rounded-xl border border-line bg-white/)
    expect(template).toMatch(/<SectionBlock\b[^>]*variant="flat"[^>]*heading="생활시설 탐색"/)
    expect(template).toContain("query: { city, district }")
  })

  it('데이터 출처 compact 평면, 광고 2개 그대로', () => {
    expect(template).toMatch(/<DataSourceSection\b[^>]*compact[^>]*variant="flat"/)
    expect((template.match(/<AdBanner\b/g) ?? []).length).toBe(2)
  })
})
