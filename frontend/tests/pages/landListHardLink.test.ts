import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// 토지 목록 → 하위/상세 진입은 HardLink(전체 새로고침=MPA)여야 한다.
// NuxtLink(SPA soft-nav)는 AdSense 가 새 pageview 로 인식하지 못해 상세페이지
// 광고가 unfill 되는 회귀를 일으킨다. (cf. project_adsense_unfill_diagnosis, AuctionCard #410)
const frontendRoot = process.cwd().endsWith('/frontend')
  ? process.cwd()
  : join(process.cwd(), 'frontend')
const read = (p: string) => readFileSync(resolve(frontendRoot, p), 'utf8')

const LAND_LIST_PAGES = [
  'pages/real-estate/land/index.vue',
  'pages/real-estate/land/[city]/index.vue',
  'pages/real-estate/land/[city]/[district]/index.vue',
]

describe('토지 목록 페이지는 하위/상세 진입을 HardLink(MPA)로 한다', () => {
  for (const page of LAND_LIST_PAGES) {
    it(`${page} 는 NuxtLink 대신 HardLink 를 사용한다`, () => {
      const src = read(page)
      expect(src).toContain("import HardLink from '~/components/common/HardLink.vue'")
      expect(src).toContain('<HardLink')
      // SPA soft-nav 회귀 방지: 카드 네비게이션에 NuxtLink 미사용
      expect(src).not.toContain('<NuxtLink')
    })
  }
})
