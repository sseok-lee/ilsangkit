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

/**
 * 폴드 안 첫 슬롯만 규격 상한을 둔다.
 *
 * 프로덕션 실측(모바일 390px): 상세의 기본 <AdBanner /> 는 높이를 지정하지 않아
 * (insStyle = `display:block; width:100%`) AdSense 가 390×390 을 배정한다.
 * 844px 뷰포트의 46% 이고, fullWidthResponsive=true 라 `margin-left:-17px` 로
 * 콘텐츠 컬럼 밖까지 번지며 z-index:30 이 붙는다.
 *
 * 부동산 상세의 첫 슬롯은 Hero 직후 384px — 폴드 안이다. 경쟁사(ayo) 아파트 상세의
 * 첫 광고는 2,157px 로 폴드 밖이며, 그 자리만 작은 규격을 받게 해 두었다.
 * 시설 상세는 이미 bcf6c658("오탭 방지")에서 첫 슬롯에 상한을 걸었으나
 * 부동산 상세만 빠져 있었다.
 *
 * sizing="fixed" 는 insFullWidthResponsive 를 'false' 로 만들어 full-bleed 와
 * z-index 도 함께 없앤다. 나머지 슬롯은 auto 를 유지해 큰 규격 재고를 계속 받는다.
 */
describe('상세 폴드 첫 광고 규격 상한', () => {
  // 마커는 주석 전문이 아니라 접두어로 둔다 — 주석 문구를 다듬어도 테스트가 깨지지 않도록.
  const FOLD_CAPPED_PAGES = [
    { page: 'pages/[category]/[id].vue', marker: '<!-- Ad: HERO 아래' },
    {
      page: 'pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue',
      marker: '<!-- Ad: Hero 직후',
    },
  ]

  for (const { page, marker } of FOLD_CAPPED_PAGES) {
    it(`${page.split('/').pop()} 의 Hero 직후 슬롯은 sizing="fixed" 로 규격 상한을 갖는다`, () => {
      const s = source(page)
      const markerIndex = s.indexOf(marker)
      expect(markerIndex).toBeGreaterThanOrEqual(0)

      const tagStart = s.indexOf('<AdBanner', markerIndex)
      expect(tagStart).toBeGreaterThan(markerIndex)
      const tag = s.slice(tagStart, s.indexOf('>', tagStart) + 1)

      expect(tag).toContain('sizing="fixed"')
      expect(tag).toContain('ad-format="rectangle"')
      expect(tag).toContain(':fixed-height="280"')
    })
  }

  it('sizing="fixed" 는 full-width-responsive 를 끈다 — full-bleed·z-index 제거의 근거', () => {
    const s = source('components/ads/AdBanner.vue')
    expect(s).toMatch(/isCompactMobileActive\.value \|\| props\.sizing === 'fixed'\s*\?\s*'false'/)
  })

  it('폴드 아래 슬롯은 auto 를 유지한다 — 부동산 상세 나머지 3개', () => {
    const s = source('pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const plainSlots = (s.match(/<AdBanner class="order-[^"]*"\s*\/>/g) || []).length
    expect(plainSlots).toBe(3)
  })
})
