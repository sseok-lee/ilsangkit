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
        <section
          v-for="section in sections"
          :key="section.key"
          :class="section.key === 'subway' ? 'md:col-span-2' : ''"
          :aria-labelledby="`nearby-facility-${section.key}`"
          data-testid="nearby-facility-section"
        >
          <div class="flex items-baseline justify-between gap-3 pb-2 border-b border-ink">
            <h3 :id="`nearby-facility-${section.key}`" class="text-[15px] font-bold text-strong">{{ section.label }}</h3>
            <span class="text-xs text-muted tabular-nums" data-testid="nearby-facility-count">{{ section.countLabel }}</span>
          </div>

          <!-- 4·5번째 행도 SSR HTML 에 렌더하고 모바일에서만 CSS 로 숨긴다(크롤러가 내부 링크를 본다). -->
          <ul :id="`nearby-facility-list-${section.key}`">
            <li
              v-for="(row, index) in section.rows"
              :key="row.key"
              class="border-b border-line"
              :class="{ 'max-md:hidden': index >= MOBILE_VISIBLE && !expanded[section.key] }"
            >
              <NuxtLink v-if="row.line" :to="row.url" :class="ROW_LINK_CLASS">
                <span class="flex flex-1 min-w-0 items-center gap-2">
                  <span
                    class="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                    :style="{ backgroundColor: lineColor(row.line) }"
                    data-testid="subway-line-badge"
                  >{{ row.line }}</span>
                  <span class="truncate text-[15px] text-ink">{{ row.name }}</span>
                </span>
                <span class="shrink-0 text-right tabular-nums">
                  <span class="block md:inline text-sm font-bold text-strong">{{ row.distance }}m</span>
                  <span class="block md:inline md:ml-1.5 text-xs text-muted">도보 약 {{ row.walk }}분</span>
                </span>
              </NuxtLink>
              <HardLink v-else :to="row.url" :class="ROW_LINK_CLASS">
                <span class="flex-1 min-w-0 truncate text-[15px] text-ink">{{ row.name }}</span>
                <span class="shrink-0 text-right tabular-nums">
                  <span class="block md:inline text-sm font-bold text-strong">{{ row.distance }}m</span>
                  <span class="block md:inline md:ml-1.5 text-xs text-muted">도보 약 {{ row.walk }}분</span>
                </span>
              </HardLink>
            </li>
          </ul>

          <button
            v-if="section.rows.length > MOBILE_VISIBLE"
            type="button"
            class="md:hidden flex w-full items-center justify-center min-h-[44px] text-[13px] font-bold text-primary"
            :aria-expanded="expanded[section.key] ? 'true' : 'false'"
            :aria-controls="`nearby-facility-list-${section.key}`"
            @click="expanded[section.key] = !expanded[section.key]"
          >
            {{ expanded[section.key] ? '접기' : `${section.rows.length}곳 모두 보기` }}
          </button>
        </section>
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
import { computed, ref } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import { emptyFiltered } from '~/utils/uiMessages'
import { CATEGORY_META } from '~/types/facility'
import type { FacilityCategory, NearbyGroupedResponse } from '~/types/facility'
import { lineColor } from '~/utils/subwayLineColors'
import { walkMinutes } from '~/utils/walkMinutes'
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

interface Row {
  key: string
  name: string
  url: string
  distance: number
  walk: number
  /** 지하철역만 — 노선 색 배지 */
  line?: string
}

interface Section {
  key: string
  label: string
  countLabel: string
  rows: Row[]
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
const RADIUS_LABEL = `${NEARBY_RADIUS_METERS / 1000}km`

const ROW_LINK_CLASS =
  'flex items-center justify-between gap-3 min-h-[52px] py-2 hover:bg-primary-50/40 transition-colors duration-200'

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

const expanded = ref<Record<string, boolean>>({})

function countLabel(count: number, exact = true): string {
  return `${RADIUS_LABEL} 안 ${count.toLocaleString()}곳${exact ? '' : ' 이상'}`
}

const sections = computed<Section[]>(() => {
  const out: Section[] = []

  const stations = transitResponse.value?.data?.stations ?? []
  if (stations.length > 0) {
    out.push({
      key: 'subway',
      label: '지하철역',
      countLabel: countLabel(stations.length),
      rows: stations.slice(0, MAX_PER_CATEGORY).map((s) => ({
        key: s.id,
        name: s.name,
        url: `/subway/${s.nameSlug}`,
        distance: s.distance,
        walk: walkMinutes(s.distance),
        line: s.line,
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
        walk: walkMinutes(f.distance),
      })),
    })
  }

  return out
})
</script>
