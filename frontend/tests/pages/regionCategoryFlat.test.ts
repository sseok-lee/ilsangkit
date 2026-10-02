import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../pages/[city]/[district]/[category].vue'), 'utf8')
const template = src.slice(0, src.indexOf('<script'))

describe('구×카테고리 평면형', () => {
  it('흰 바탕 + 정렬 컨테이너, 1200 고정폭 없음', () => {
    expect(template).toContain('page-container')
    expect(template).not.toContain('max-w-[1200px]')
  })

  it('PageHead + 평면 섹션 + 진료과목 필터 flat', () => {
    expect(template).not.toContain('<PageHero')
    expect(template).toMatch(/<PageHead\b/)
    expect(template).toMatch(/<SectionBlock\b[^>]*variant="flat"[^>]*heading="지역 요약"/)
    expect(template).toMatch(/<HospitalDepartmentFilter\b[^>]*variant="flat"/)
  })

  it('데이터 출처 flat, 광고 1개·showRegionAd 문자열 그대로', () => {
    expect(template).toMatch(/<DataSourceSection\b[^>]*variant="flat"/)
    expect((template.match(/<AdBanner\b/g) ?? []).length).toBe(1)
    expect(template).toContain('<AdBanner v-if="showRegionAd" />')
  })
})
