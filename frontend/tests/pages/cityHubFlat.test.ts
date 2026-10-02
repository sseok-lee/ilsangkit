import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../pages/[city]/index.vue'), 'utf8')
const template = src.slice(0, src.indexOf('<script'))

describe('시·도 허브 평면형', () => {
  it('흰 바탕 + 정렬 컨테이너, 회색 바탕·max-w-6xl 없음', () => {
    expect(template).toContain('page-container')
    expect(template).not.toContain('bg-background-light min-h-screen')
    expect(template).not.toContain('max-w-6xl')
  })

  it('PageHero 대신 PageHead', () => {
    expect(template).not.toContain('<PageHero')
    expect(template).toMatch(/<PageHead\b[^>]*eyebrow="지역 허브"/)
    expect(src).toContain("import PageHead from '~/components/common/PageHead.vue'")
  })

  it('손으로 만든 상자 섹션이 없고 구·군·카테고리·가이드는 평면 섹션', () => {
    expect(template).not.toMatch(/<section\b[^>]*rounded-xl/)
    expect(template).toMatch(/<SectionBlock\b[^>]*id="districts"[^>]*variant="flat"/)
    expect(template).toMatch(/<SectionBlock\b[^>]*id="categories"[^>]*variant="flat"/)
    expect(template).toMatch(/<SectionBlock\b[^>]*variant="flat"[^>]*heading="생활 가이드"/)
  })

  it('구·군 행 목록은 PC 3열 구분선 행(상자 없음)', () => {
    expect(template).toContain('lg:grid-cols-3')
    expect(template).not.toContain('divide-y divide-line overflow-hidden rounded-xl')
  })

  it('데이터 출처는 compact 평면 한 줄', () => {
    expect(template).toMatch(/<DataSourceSection\b[^>]*compact[^>]*variant="flat"/)
  })

  it('광고 1개 그대로', () => {
    expect((template.match(/<AdBanner\b/g) ?? []).length).toBe(1)
  })
})
