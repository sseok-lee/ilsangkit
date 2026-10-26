<template>
  <div data-testid="nearby-facilities">
    <div v-if="loading" data-testid="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
    </div>

    <div v-else-if="sections.length === 0" class="rounded-2xl bg-background-light p-8 text-center text-faint text-sm">
      {{ emptyFiltered('시설') }}
    </div>

    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 md:gap-x-8 gap-y-6">
        <NearbyPlaceSection
          v-for="section in sections"
          :key="section.key"
          :class="section.key === 'subway' ? 'md:col-span-2' : ''"
          :section-key="section.key"
          :label="section.label"
          :count-label="section.countLabel"
          :rows="section.rows"
          :mobile-visible="MOBILE_VISIBLE"
        >
          <template #badge="{ row }">
            <span
              class="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
              :style="{ backgroundColor: lineColor(row.badge) }"
              data-testid="subway-line-badge"
            >{{ row.badge }}</span>
          </template>
        </NearbyPlaceSection>
      </div>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
        <span class="text-faint">공공데이터포털 시설 데이터 · 카테고리별 가까운 순 최대 {{ MAX_PER_CATEGORY }}곳</span>
        <NuxtLink
          v-if="regionHref"
          :to="regionHref"
          class="inline-flex items-center min-h-[44px] font-bold text-primary hover:underline"
          data-testid="nearby-facilities-region-link"
        >
          {{ regionLabel }} 생활시설 전체 보기 →
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import NearbyPlaceSection from '~/components/common/nearby/NearbyPlaceSection.vue'
import type { NearbyPlaceRowData } from '~/components/common/nearby/NearbyPlaceSection.vue'
import { emptyFiltered } from '~/utils/uiMessages'
import { CATEGORY_META } from '~/types/facility'
import type { FacilityCategory, NearbyGroupedResponse } from '~/types/facility'
import { lineColor } from '~/utils/subwayLineColors'
import { nearbyCountLabel } from '~/utils/nearbyCountLabel'
import { useApiBase } from '~/composables/useApiBase'

const apiBase = useApiBase()

interface Station {
  id: string
  name: string
  nameSlug: string
  line: string
  distance: number
  type?: 'subway'
}

interface Section {
  key: string
  label: string
  countLabel: string
  /** 지하철역 행만 badge(노선명) — 노선 색 배지 */
  rows: NearbyPlaceRowData[]
}

interface Props {
  lat: number
  lng: number
  /** 하단 "{regionLabel} 생활시설 전체 보기" 링크 대상. 없으면 링크를 그리지 않는다. */
  regionHref?: string
  regionLabel?: string
}

const props = defineProps<Props>()

// 부동산 의사결정 우선순위 — 지하철역(별도 섹션)이 항상 최상단, 그 다음 이 순서로 고정.
const DISPLAY_CATEGORIES: FacilityCategory[] = ['school', 'childcare', 'hospital', 'pharmacy', 'park', 'sports']
const MAX_PER_CATEGORY = 5
/** 모바일에서 처음 보이는 행 수. 나머지는 "모두 보기"로 편다. */
const MOBILE_VISIBLE = 3
const NEARBY_RADIUS_METERS = 2000
/** transit API(/api/transit/nearby) 응답 상한. 여기에 닿으면 실제로는 더 있을 수 있다. */
const TRANSIT_API_LIMIT = 10

const { data: transitResponse, status: transitStatus } = await useAsyncData<{ data: { stations: Station[] } }>(
  `nearby-transit-${props.lat}-${props.lng}`,
  () => {
    if (!props.lat || !props.lng) return Promise.resolve(null)
    return $fetch<{ data: { stations: Station[] } }>(`${apiBase}/api/transit/nearby`, {
      query: { lat: props.lat, lng: props.lng, radius: NEARBY_RADIUS_METERS },
    })
  },
)

// 카테고리마다 반경 안 실제 개수 + 가까운 5곳. 전 카테고리 가까운 N곳을 나누면
// 화장실·주차장이 많은 동네에서 학교·공원이 빠지고 개수도 보이는 수가 된다.
const { data: groupedResponse, status } = await useAsyncData<{ data: NearbyGroupedResponse } | null>(
  `nearby-facilities-grouped-${props.lat}-${props.lng}`,
  () => {
    if (!props.lat || !props.lng) return Promise.resolve(null)
    return $fetch<{ data: NearbyGroupedResponse }>(`${apiBase}/api/facilities/nearby-grouped`, {
      query: {
        lat: props.lat,
        lng: props.lng,
        radius: NEARBY_RADIUS_METERS,
        categories: DISPLAY_CATEGORIES.join(','),
        limit: MAX_PER_CATEGORY,
      },
    })
  },
)

const loading = computed(() => status.value === 'pending' || transitStatus.value === 'pending')

function countLabel(count: number, exact = true): string {
  return nearbyCountLabel(NEARBY_RADIUS_METERS, count, exact)
}

const sections = computed<Section[]>(() => {
  const out: Section[] = []

  const stations = transitResponse.value?.data?.stations ?? []
  if (stations.length > 0) {
    out.push({
      key: 'subway',
      label: '지하철역',
      countLabel: countLabel(stations.length, stations.length < TRANSIT_API_LIMIT),
      rows: stations.slice(0, MAX_PER_CATEGORY).map((s) => ({
        key: s.id,
        name: s.name,
        url: `/subway/${s.nameSlug}`,
        distance: s.distance,
        badge: s.line,
      })),
    })
  }

  const groups = groupedResponse.value?.data?.groups ?? {}
  for (const cat of DISPLAY_CATEGORIES) {
    const group = groups[cat]
    if (!group || group.items.length === 0) continue
    out.push({
      key: cat,
      label: CATEGORY_META[cat]?.label ?? cat,
      countLabel: countLabel(group.count, group.exact),
      rows: group.items.slice(0, MAX_PER_CATEGORY).map((f) => ({
        key: f.id,
        name: f.name,
        url: `/${f.category}/${f.id}`,
        distance: f.distance,
        hard: true,
      })),
    })
  }

  return out
})
</script>
