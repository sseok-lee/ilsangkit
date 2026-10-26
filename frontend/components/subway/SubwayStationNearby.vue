<template>
  <SectionBlock
    v-if="loading || sections.length > 0"
    :variant="sectionVariant"
    data-testid="subway-nearby"
    heading="주변 시설"
    :subtext="`${stationName}에서 반경 ${RADIUS_LABEL} 안의 시설입니다. 거리는 직선거리, 도보 시간은 추정입니다.`"
  >
    <div v-if="loading && sections.length === 0" class="grid grid-cols-1 md:grid-cols-2 md:gap-x-8 gap-y-6">
      <div v-for="i in 2" :key="i" class="animate-pulse rounded-lg bg-background-light h-[200px]"></div>
    </div>

    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 md:gap-x-8 gap-y-6">
        <NearbyPlaceSection
          v-for="section in sections"
          :key="section.key"
          :section-key="section.key"
          :label="section.label"
          :count-label="section.countLabel"
          :rows="section.rows"
          stacked
        >
          <template #badge="{ row }">
            <span
              v-for="ln in stationLines.get(row.key) ?? []"
              :key="ln"
              class="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
              :style="{ backgroundColor: lineColor(ln) }"
              data-testid="subway-line-badge"
            >{{ ln }}</span>
          </template>
        </NearbyPlaceSection>
      </div>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
        <span class="text-faint">공공데이터포털 시설 데이터 · 카테고리별 가까운 순 최대 {{ MAX_PER_CATEGORY }}곳</span>
        <NuxtLink
          v-if="regionHref && regionLabel"
          :to="regionHref"
          class="inline-flex items-center min-h-[44px] font-bold text-primary hover:underline"
          data-testid="nearby-facilities-region-link"
        >
          {{ regionLabel }} 생활시설 전체 보기 →
        </NuxtLink>
      </div>
    </template>
  </SectionBlock>
</template>

<script setup lang="ts">
// 지하철역 상세 "주변 시설" — 시설 상세 DetailNearby 와 같은 틀(공용 NearbyPlaceSection).
// 주변 역 행은 부동산 상세 NearbyFacilities 의 지하철역 행처럼 노선 색 배지 + 역명(보조 줄 없음).
import { computed } from 'vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import NearbyPlaceSection from '~/components/common/nearby/NearbyPlaceSection.vue'
import type { NearbyPlaceRowData } from '~/components/common/nearby/NearbyPlaceSection.vue'
import { CATEGORY_META } from '~/types/facility'
import type { Facility } from '~/types/facility'
import type { SubwayNearbyGroup, SubwayNearbyStation } from '~/types/subway'
import { nearbyCountLabel } from '~/utils/nearbyCountLabel'
import { nearbyFacilitySub } from '~/utils/nearbyFacilitySub'
import { dedupeLines, lineColor } from '~/utils/subwayLineColors'
import { withStationSuffix } from '~/utils/stationName'

const props = withDefaults(defineProps<{
  /** GET /api/subway/stations/:slug/nearby-grouped 의 groups — [주변 역, ...관련 카테고리] 순서 */
  groups: SubwayNearbyGroup[]
  loading: boolean
  /** 부제 "{stationName}에서 반경 1km 안의 시설입니다." */
  stationName: string
  /** 하단 "{regionLabel} 생활시설 전체 보기 →" 링크(구·군 지역 허브). 없으면 링크를 그리지 않는다. */
  regionHref?: string
  regionLabel?: string
  sectionVariant?: 'flat'
}>(), {
  regionHref: undefined,
  regionLabel: undefined,
  sectionVariant: 'flat',
})

const NEARBY_RADIUS_METERS = 1000
const RADIUS_LABEL = `${NEARBY_RADIUS_METERS / 1000}km`
const MAX_PER_CATEGORY = 5

interface Section {
  key: string
  label: string
  countLabel: string
  rows: NearbyPlaceRowData[]
}

function stationRowKey(s: SubwayNearbyStation): string {
  return `subway-${s.nameSlug}`
}

// 배지 슬롯은 row 하나만 받으므로 노선 목록은 행 key 로 찾는다(노선 표기 정규화·중복 제거)
const stationLines = computed(() => {
  const map = new Map<string, string[]>()
  for (const g of props.groups) {
    if (g.category !== 'subway') continue
    for (const s of g.items as SubwayNearbyStation[]) map.set(stationRowKey(s), dedupeLines(s.lines))
  }
  return map
})

// 0곳 그룹은 숨긴다. 순서는 API 순서(주변 역 → CROSS_CATEGORY_MAP.subway) 그대로.
// 같은 /subway/[slug] 페이지 안 이동은 하드 링크(HardLink)로 — 시설 상세 행과 같다.
const sections = computed<Section[]>(() =>
  props.groups
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      key: g.category,
      label: `주변 ${CATEGORY_META[g.category]?.label ?? g.category}`,
      countLabel: nearbyCountLabel(NEARBY_RADIUS_METERS, g.count, g.exact),
      rows: g.category === 'subway'
        ? (g.items as SubwayNearbyStation[]).slice(0, MAX_PER_CATEGORY).map((s) => ({
            key: stationRowKey(s),
            name: withStationSuffix(s.name),
            url: `/subway/${s.nameSlug}`,
            distance: s.distance,
            hard: true,
            badge: stationLines.value.get(stationRowKey(s))?.join(' ') || undefined,
          }))
        : (g.items as Facility[]).slice(0, MAX_PER_CATEGORY).map((f) => ({
            key: f.id,
            name: f.name,
            url: `/${f.category}/${f.id}`,
            distance: f.distance ?? 0,
            sub: nearbyFacilitySub(f),
            hard: true,
          })),
    })),
)
</script>
