import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 흰색 평면형 대상(PR2 시설·PR3 지역 허브) — 원시 회색·hex·그림자·:deep 금지(스펙 2026-10-02 §8-4).
// 떠 있는 층의 shadow-card-2 만 허용(§7.3). 의미 색(emerald·teal 등)은 대상 아님.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export const FILES = [
  'pages/facilities.vue',
  'pages/[city]/index.vue',
  'pages/[city]/[district]/[category].vue',
  'components/facility/detail/DetailBasicInfo.vue',
  'components/facility/detail/DetailFacilityStatus.vue',
  'components/facility/detail/DetailContextLinks.vue',
  'components/facility/detail/DetailNearby.vue',
  'components/facility/detail/FieldGrid.vue',
  'components/facility/DetailRow.vue',
  'components/facility/details/EvChargerDetail.vue',
  'components/facility/FacilityList.vue',
  'components/facility/FacilityCard.vue',
  'components/facility/FacilityBrowseResults.vue',
  'components/facility/FacilityBrowseRow.vue',
  'pages/[category]/index.vue',
  'pages/[category]/[id].vue',
  'components/region/RegionRealEstatePrices.vue',
  'components/region/RegionRealEstateCta.vue',
  'components/city/RecentGuides.vue',
  'components/region/RegionFacilityCategoryGrid.vue',
  'pages/[city]/[district]/index.vue',
  'components/region/RegionFacilitiesGrid.vue',
  'components/region/RegionTrashSchedule.vue',
  'components/region/RegionRelatedCategories.vue',
  'components/region/DistrictSummaryCard.vue',
  'components/region/NearbyDistrictsNav.vue',
  'components/realEstate/ExplorationFilters.vue',
  'components/realEstate/ExplorationBuildingRow.vue',
  'pages/real-estate/[realEstateType]/index.vue',
  'pages/real-estate/[realEstateType]/[city]/index.vue',
  'pages/real-estate/[realEstateType]/[city]/[district]/index.vue',
  'components/trash/WasteScheduleContent.vue',
  'components/trash/WasteTypeSection.vue',
  'components/trash/WasteAreaRow.vue',
  'components/trash/WasteAreaList.vue',
  'components/facility/WasteScheduleCard.vue',
  'pages/trash/[id].vue',
  'pages/trash/areas/[areaId].vue',
  'pages/subway/[slug].vue',
  'pages/subway/index.vue',
  'error.vue',
  'pages/about.vue',
  'pages/contact.vue',
  'pages/privacy.vue',
  'pages/terms.vue',
  'pages/faq.vue',
  'pages/subscription/sale/index.vue',
  'pages/subscription/sale/[type].vue',
  'pages/subscription/rent/index.vue',
  'pages/subscription/rent/[type].vue',
  'pages/auction/index.vue',
  'pages/auction/list.vue',
  'pages/auction/ranking.vue',
  'pages/auction/[city]/index.vue',
  'pages/auction/[city]/[district]/index.vue',
  'pages/auction/item/[cltrMngNo].vue',
  'pages/real-estate/land/index.vue',
  'pages/real-estate/land/[city]/index.vue',
  'pages/real-estate/land/[city]/[district]/index.vue',
  'pages/real-estate/land/[city]/[district]/[dong].vue',
  'components/auction/AuctionCard.vue',
  'components/auction/AuctionStatusBadge.vue',
  'components/auction/AuctionBidHistory.vue',
  'components/auction/AuctionPriceCompare.vue',
  'components/auction/AuctionDetailInfo.vue',
]

const RAW_GRAY = /\b(?:text|bg|border(?:-[trblxy])?|divide|ring|from|to|via|fill|stroke|placeholder)-(?:gray|slate)-\d{2,3}\b/
const HEX_CLASS = /-\[#[0-9a-fA-F]{3,8}\]/
const SHADOW = /\bshadow-(?:subtle|sm|md|lg|xl|2xl)\b|\bshadow-card(?!-2)\b/

// scoped CSS 안 hex 도 토큰 우회다. PR4 부터 대상 파일은 rgb(var(--*-rgb)) 만 쓴다.
const STYLE_HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/

describe('평면형 페이지 가드', () => {
  it.each(FILES)('%s', (file) => {
    const src = readFileSync(resolve(root, file), 'utf8')
    expect(src.match(RAW_GRAY)?.[0] ?? null).toBeNull()
    expect(src.match(HEX_CLASS)?.[0] ?? null).toBeNull()
    expect(src.match(SHADOW)?.[0] ?? null).toBeNull()
    expect(src).not.toMatch(/:deep\(/)
    const style = src.includes('<style') ? src.slice(src.indexOf('<style')) : ''
    expect(style.match(STYLE_HEX)?.[0] ?? null).toBeNull()
  })
})
