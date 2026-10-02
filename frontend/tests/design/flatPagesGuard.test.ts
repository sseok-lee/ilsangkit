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
]

const RAW_GRAY = /\b(?:text|bg|border(?:-[trblxy])?|divide|ring|from|to|via|fill|stroke|placeholder)-(?:gray|slate)-\d{2,3}\b/
const HEX_CLASS = /-\[#[0-9a-fA-F]{3,8}\]/
const SHADOW = /\bshadow-(?:subtle|sm|md|lg|xl|2xl)\b|\bshadow-card(?!-2)\b/

describe('평면형 페이지 가드', () => {
  it.each(FILES)('%s', (file) => {
    const src = readFileSync(resolve(root, file), 'utf8')
    expect(src.match(RAW_GRAY)?.[0] ?? null).toBeNull()
    expect(src.match(HEX_CLASS)?.[0] ?? null).toBeNull()
    expect(src.match(SHADOW)?.[0] ?? null).toBeNull()
    expect(src).not.toMatch(/:deep\(/)
  })
})
