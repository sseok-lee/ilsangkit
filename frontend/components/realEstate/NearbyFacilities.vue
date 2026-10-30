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
          :class="section.fullWidth ? 'md:col-span-2' : ''"
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
        <span class="text-faint">공공데이터포털 시설 데이터 · 카테고리별 가까운 순 최대 {{ MAX_PER_CATEGORY }}곳<template v-if="busSourceNote"> · {{ busSourceNote }}</template></span>
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
  /** true 면 데스크톱에서 두 칸 폭(md:col-span-2) */
  fullWidth: boolean
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
/** 버스 정류장 반경(m). 백엔드 busRadius 로 전달 */
const BUS_RADIUS_METERS = 1000

interface BusStop {
  id: string
  name: string
  distance: number
}
interface TransitData {
  stations: Station[]
  busStops?: BusStop[]
  busStopCount?: number
  busCollectedAt?: string | null
}

const { data: transitResponse, status: transitStatus } = await useAsyncData<{ data: TransitData }>(
  `nearby-transit-${props.lat}-${props.lng}`,
  () => {
    if (!props.lat || !props.lng) return Promise.resolve(null)
    return $fetch<{ data: TransitData }>(`${apiBase}/api/transit/nearby`, {
      query: { lat: props.lat, lng: props.lng, radius: NEARBY_RADIUS_METERS, busRadius: BUS_RADIUS_METERS },
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

const busStops = computed(() => transitResponse.value?.data?.busStops ?? [])
const busStopCount = computed(() => transitResponse.value?.data?.busStopCount ?? busStops.value.length)

// 하단 출처 뒤에 붙는 버스 문구. 버스 칸이 있을 때만. busCollectedAt 'YYYY-MM-DD' → 'YYYY년 M월 수집'
const busSourceNote = computed(() => {
  if (busStops.value.length === 0) return ''
  const m = /^(\d{4})-(\d{2})/.exec(transitResponse.value?.data?.busCollectedAt ?? '')
  const when = m ? ` · ${m[1]}년 ${Number(m[2])}월 수집` : ''
  return `버스정류장: 국토교통부${when}`
})

const sections = computed<Section[]>(() => {
  const out: Section[] = []

  const stations = transitResponse.value?.data?.stations ?? []
  const hasBus = busStops.value.length > 0
  if (stations.length > 0) {
    out.push({
      key: 'subway',
      label: '지하철역',
      countLabel: countLabel(stations.length, stations.length < TRANSIT_API_LIMIT),
      // 버스 칸이 함께 있으면 나란히(한 칸씩), 없으면 전체 너비
      fullWidth: !hasBus,
      rows: stations.slice(0, MAX_PER_CATEGORY).map((s) => ({
        key: s.id,
        name: s.name,
        url: `/subway/${s.nameSlug}`,
        distance: s.distance,
        badge: s.line,
      })),
    })
  }

  if (hasBus) {
    out.push({
      key: 'bus',
      label: '버스 정류장',
      countLabel: nearbyCountLabel(BUS_RADIUS_METERS, busStopCount.value, true),
      fullWidth: stations.length === 0,
      // 정류장 상세 페이지가 없으므로 url 없음(링크 없는 행), 배지 없음
      rows: busStops.value.slice(0, MAX_PER_CATEGORY).map((b) => ({
        key: b.id,
        name: b.name,
        distance: b.distance,
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
      fullWidth: false,
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
