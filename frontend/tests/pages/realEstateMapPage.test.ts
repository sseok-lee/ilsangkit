import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// new URL(..., import.meta.url) 는 이 프로젝트의 vitest/vite-node 설정에서 file: 스킴이 아닌
// URL 을 돌려줘 TypeError 를 낸다 — 기존 관례(tests/pages/landListHardLink.test.ts 등)를 따라
// process.cwd() 기준 경로로 읽는다.
const frontendRoot = process.cwd().endsWith('/frontend') ? process.cwd() : join(process.cwd(), 'frontend')
const src = readFileSync(resolve(frontendRoot, 'pages/real-estate/index.vue'), 'utf-8')

describe('/real-estate 페이지', () => {
  it('지도 탐색 컴포넌트를 쓴다', () => {
    expect(src).toContain('RealEstateMapExplorer')
  })

  it('정적 FAQ 와 FAQPage 스키마를 제거했다', () => {
    // 보일러플레이트 FAQ 는 GSC 색인 감소 진단의 지목 대상이었다(상세는 #625 에서 제거됨)
    expect(src).not.toContain('setFAQSchema')
    expect(src).not.toContain('realEstateFAQs')
  })

  it('크롤 경로인 유형 카드와 ItemList 스키마는 유지한다', () => {
    expect(src).toContain('RealEstateCategoryCards')
    expect(src).toContain('setItemListSchema')
  })

  it('Dataset·Breadcrumb 스키마와 출처 섹션을 유지한다', () => {
    expect(src).toContain('setDatasetSchema')
    expect(src).toContain('setBreadcrumbSchema')
    expect(src).toContain('DataSourceSection')
  })

  it('기존 AdBanner 를 남긴다 (광고 축소 금지)', () => {
    expect(src).toContain('AdBanner')
  })

  it('SSR 집계 실패 시 fail-open — catch 가 빈 배열을 준다', () => {
    expect(src).toMatch(/catch\s*\{[\s\S]*?return \[\]/)
  })
})
