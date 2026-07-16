import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 상세 페이지 모바일 광고 포맷 정책.
 *
 * 배경: AdBanner 의 `variant="compact-mobile"` 은 모바일에서 data-ad-format 을
 * horizontal 로 잠그고 높이를 150px 로 제한한다. 그 결과 AdSense 가 100px 대
 * 가로형만 서빙했다(프로덕션 실측 336×100).
 *
 * 같은 모바일 뷰포트에서 기본(auto) 슬롯은 390×390 을 받는다(홈 실측) — 면적 4.5배.
 * 상세 페이지도 auto 로 열어 더 큰 규격 재고를 받도록 한다.
 *
 * 이 테스트는 compact-mobile 이 상세 페이지에 다시 들어오는 걸 막는다.
 * (컴포넌트의 variant 구현 자체는 되돌리기 용이하도록 유지한다.)
 */
const DETAIL_PAGES = [
  'pages/[category]/[id].vue',
  'pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue',
]

function source(rel: string): string {
  const root = process.cwd().endsWith('/frontend') ? process.cwd() : resolve(process.cwd(), 'frontend')
  return readFileSync(resolve(root, rel), 'utf8')
}

describe('상세 페이지 모바일 광고 포맷', () => {
  for (const page of DETAIL_PAGES) {
    it(`${page.split('/').pop()} 는 compact-mobile 로 모바일 광고를 가로형에 잠그지 않는다`, () => {
      expect(source(page)).not.toContain('variant="compact-mobile"')
    })
  }

  it('AdBanner 기본 포맷은 auto 여서 AdSense 가 규격을 고른다', () => {
    const s = source('components/ads/AdBanner.vue')
    // 기본값이 auto 여야 상세 페이지의 <AdBanner /> 가 큰 규격 재고를 받는다.
    expect(s).toMatch(/adFormat:\s*'auto'/)
  })

  it('compact-mobile 구현은 남겨둔다 — 되돌릴 때 prop 한 줄이면 되도록', () => {
    // 정책이 뒤집히면(광고가 콘텐츠를 압도) 호출부에 prop 만 다시 붙이면 된다.
    const s = source('components/ads/AdBanner.vue')
    expect(s).toContain("'compact-mobile'")
  })
})
