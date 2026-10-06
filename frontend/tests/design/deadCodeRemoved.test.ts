import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// PR7d-1 — 운영 사용처 0 코드 삭제(스펙 2026-10-02 §5 PR7, 사용자 결정 2026-10-03)와 홈 칩 공통화(§3.6).
const root = resolve(__dirname, '../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

const REMOVED = [
  'components/home/HomeHotspotSignals.vue',
  'components/home/HomeTrendingBuildings.vue',
  'components/home/hotspot/HotspotCard.vue',
  'components/home/hotspot/HotspotRow.vue',
  'components/home/hotspot/TxnTypeMiniTabs.vue',
  'composables/useRealEstateHotspots.ts',
  'composables/useHomeDashboard.ts',
  'utils/priceFormat.ts',
  'components/realEstate/ComplexCard.vue',
  'components/realEstate/PriceTrendChart.vue',
  'components/realEstate/TransactionModeTab.vue',
  'components/realEstate/RentTypeToggle.vue',
  'components/realEstate/AreaSelector.vue',
  'components/common/StatusBadge.vue',
  'components/common/ErrorBoundary.vue',
  'components/search/SearchInput.vue',
  'components/search/SearchDomainSection.vue',
  'components/trash/ScheduleList.vue',
  'components/category/CategoryCards.vue',
  'components/category/CategoryChips.vue',
  'components/category/CategoryIntro.vue',
  'components/facility/FacilityFeatureCard.vue',
  'components/map/FacilityBottomSheet.vue',
]

describe('사용처 0 코드 삭제', () => {
  it.each(REMOVED)('%s 가 없다', (file) => {
    expect(existsSync(resolve(root, file))).toBe(false)
  })

  it('lightweight-charts 의존성과 청크 규칙이 없다', () => {
    expect(read('package.json')).not.toContain('lightweight-charts')
    expect(read('nuxt.config.ts')).not.toContain('lightweight-charts')
  })

  it('main.css 에 사용처 0 클래스와 사라진 fcard 언급이 없다', () => {
    const css = read('assets/css/main.css')
    for (const cls of ['.input-base', '.card-base', '.interactive-card', 'fcard', 'nf-card']) {
      expect(css).not.toContain(cls)
    }
  })

  it('전역 테스트 셋업에 지운 컴포넌트 스텁이 없다', () => {
    expect(read('tests/setup.ts')).not.toContain('HomeTrendingBuildings')
  })
})

describe('홈 인기 지역 칩', () => {
  it('공통 칩(.ui-chip)을 쓰고 알약 모양을 쓰지 않는다', () => {
    const src = read('pages/index.vue')
    const chip = src.slice(src.indexOf('v-for="city in CITY_LINKS"'))
    const tag = chip.slice(0, chip.indexOf('>'))
    expect(tag).toContain('class="ui-chip"')
    expect(tag).not.toContain('rounded-full')
  })
})
