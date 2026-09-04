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

  it('하단 콘텐츠를 전부 제거했다 — 지도만 남는다', () => {
    // 스크롤하면 유형 카드·설명문·출처 블록이 뷰포트를 채워 지도가 사라지던 구성을 걷어냈다.
    expect(src).not.toContain('RealEstateCategoryCards')
    expect(src).not.toContain('DataSourceSection')
    expect(src).not.toContain('BelowFoldContent')
    expect(src).not.toContain('hub-summary')
  })

  it('지도 전용 레이아웃을 지정한다', () => {
    // 이게 없으면 default 레이아웃의 TrustLine·AppFooter 가 붙어 스크롤이 0이 되지 않는다.
    expect(src).toContain("layout: 'map'")
  })

  it('ItemList 는 6종이고 토지를 포함하지 않는다', () => {
    // 지도가 6종만 다루므로 구조화 데이터도 6종이어야 한다. 토지는 GNB 담당.
    expect(src).toContain('setItemListSchema')
    expect(src).not.toContain("'/real-estate/land'")
    for (const t of ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent']) {
      expect(src).toContain(`/real-estate/${t}`)
    }
  })

  it('Dataset·Breadcrumb 스키마는 유지한다', () => {
    expect(src).toContain('setDatasetSchema')
    expect(src).toContain('setBreadcrumbSchema')
  })

  it('페이지 본문에 광고를 두지 않는다 — 인피드 광고는 사이드바가 담당한다', () => {
    expect(src).not.toContain('AdBanner')
  })

  it('SSR 집계 실패 시 fail-open — 사용자에겐 빈 배열, 크롤러에겐 503', () => {
    // 예전 계약은 `catch { return [] }` 였다. 사용자 쪽은 맞지만 크롤러 쪽이 빠져 있었다 —
    // 이 집계가 이 페이지의 유일한 SSR 데이터라, 실패하면 정적 크롬만 남은 얇은 문서가
    // 200 + index 로 색인된다(#467). default 로 빈 배열을 주되 degraded 도 함께 알린다.
    expect(src).toContain('default: () => []')
    expect(src).toContain('error: regionsError')
    expect(src).toMatch(/if \(regionsError\.value && import\.meta\.server\) markDegradedResponse\(\)/)
    // ⚠️ 호출은 useAsyncData 핸들러 밖이어야 한다(핸들러 안엔 Nuxt 컨텍스트가 없다).
    // 위치 불변식은 tests/pages/detail-soft-error.test.ts 가 전역으로 강제한다.
    expect(src).not.toMatch(/useAsyncData[\s\S]{0,400}markDegradedResponse/)
  })
})
