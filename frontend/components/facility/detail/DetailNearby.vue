<template>
  <SectionBlock
    v-if="loading || sections.length > 0"
    :variant="sectionVariant"
    data-testid="facility-nearby"
    heading="주변 시설"
    :subtext="`${facilityName}에서 반경 ${RADIUS_LABEL} 안의 시설입니다. 거리는 직선거리, 도보 시간은 추정입니다.`"
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
        />
      </div>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
        <span class="text-faint">공공데이터포털 시설 데이터 · 카테고리별 가까운 순 최대 {{ MAX_PER_CATEGORY }}곳</span>
        <NuxtLink
          v-if="regionHref && regionLabel"
          :to="regionHref"
          class="inline-flex items-center min-h-[44px] font-bold text-primary hover:underline"
          data-testid="nearby-facilities-region-link"
        >
          {{ regionLabel }} 전체 보기 →
        </NuxtLink>
      </div>
    </template>
  </SectionBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import NearbyPlaceSection from '~/components/common/nearby/NearbyPlaceSection.vue'
import type { NearbyPlaceRowData } from '~/components/common/nearby/NearbyPlaceSection.vue'
import { CATEGORY_META } from '~/types/facility'
import type { FacilityNearbyGroup } from '~/types/facility'
import { nearbyCountLabel } from '~/utils/nearbyCountLabel'
import { nearbyFacilitySub } from '~/utils/nearbyFacilitySub'

const props = withDefaults(defineProps<{
  /** GET /api/facilities/:category/:id/nearby-grouped 의 groups — [현재 카테고리, ...관련 카테고리] 순서 */
  groups: FacilityNearbyGroup[]
  loading: boolean
  /** 부제 "{facilityName}에서 반경 1km 안의 시설입니다." */
  facilityName: string
  /** 하단 "{regionLabel} 전체 보기 →" 링크(지역×카테고리 목록). 없으면 링크를 그리지 않는다. */
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

// 0곳 그룹은 숨긴다. 순서는 API 순서(같은 카테고리 → CROSS_CATEGORY_MAP) 그대로.
const sections = computed<Section[]>(() =>
  props.groups
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      key: g.category,
      label: `주변 ${CATEGORY_META[g.category]?.label ?? g.category}`,
      countLabel: nearbyCountLabel(NEARBY_RADIUS_METERS, g.count, g.exact),
      rows: g.items.slice(0, MAX_PER_CATEGORY).map((f) => ({
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
