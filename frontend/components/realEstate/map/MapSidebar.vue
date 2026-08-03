<template>
  <div class="flex flex-col h-full overflow-y-auto bg-white">
    <div class="px-4 py-3 border-b border-line sticky top-0 bg-white z-10">
      <p class="text-sm font-semibold text-slate-900">{{ heading }}</p>
      <p v-if="!props.exact" class="text-xs text-slate-600 mt-0.5">
        이 영역에 {{ props.total.toLocaleString('ko-KR') }}곳 — 거래량 상위만 표시합니다
      </p>
    </div>

    <ul class="flex-1">
      <template v-for="(row, idx) in rows" :key="row.key">
        <li
          data-testid="map-sidebar-item"
          class="border-b border-line-2"
          @mouseenter="emit('hover', row.key)"
          @mouseleave="emit('hover', null)"
        >
          <NuxtLink
            :to="row.href"
            class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-background-light transition-colors"
            @click="emit('select', row.item)"
          >
            <span class="min-w-0">
              <span class="block text-sm font-medium text-slate-900 truncate">{{ row.title }}</span>
              <span v-if="row.subtitle" class="block text-xs text-slate-600 truncate">{{ row.subtitle }}</span>
            </span>
            <span class="text-sm font-semibold text-primary whitespace-nowrap">{{ row.price }}</span>
          </NuxtLink>
        </li>
        <li v-if="idx === AD_AFTER_INDEX" data-testid="map-sidebar-ad" class="border-b border-line-2 p-2">
          <AdBanner />
        </li>
      </template>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { isBuildingItem, type Granularity, type MapBuildingItem, type MapItem, type MapRegionItem } from '~/types/realEstateMap'
import { formatPriceLabel, formatPyeongLabel } from '~/composables/useMapOverlays'
import { itemKey } from '~/composables/useRealEstateMap'
import { SIDO_CHIPS } from '~/utils/regionChips'
import { toRealEstateUrl, toRealEstateListUrl, type RealEstateUrlType } from '~/utils/realEstateUrl'
import AdBanner from '~/components/ads/AdBanner.vue'

const AD_AFTER_INDEX = 4 // 5번째 항목 뒤

const props = defineProps<{
  items: MapItem[]
  granularity: Granularity
  total: number
  exact: boolean
  pending: boolean
  type: string
}>()

const emit = defineEmits<{ hover: [string | null]; select: [MapItem] }>()

const heading = computed(() =>
  props.granularity === 'building' ? '이 지역 건물' : '지역별 평균 평당가',
)

interface Row {
  key: string
  title: string
  subtitle: string | null
  price: string
  href: string
  item: MapItem
}

/**
 * 지역 모드의 목록은 **항상 SIDO_CHIPS 16개를 기준**으로 만든다.
 * 집계(items)는 가격을 채우는 데만 쓴다. 집계가 통째로 실패해도 링크 16개가 남아야
 * 이 페이지가 빈 허브가 되지 않는다 — 지도가 SSR 불가라 좌측이 유일한 SSR 콘텐츠다.
 */
const rows = computed<Row[]>(() => {
  if (props.granularity === 'building') {
    return props.items.map((i) => {
      const b = i as MapBuildingItem
      return {
        key: itemKey(i),
        title: b.buildingName,
        subtitle: `${b.city} ${b.district} ${b.dongName}`,
        price: formatPriceLabel(b),
        // 건물 상세는 4-segment URL. 슬러그 변환·NFC 정규화·encodeURIComponent 가
        // 전부 이 유틸에 들어 있으므로 직접 문자열을 조립하지 않는다.
        href: toRealEstateUrl({
          type: props.type as RealEstateUrlType,
          city: b.city,
          district: b.district,
          buildingName: b.buildingName,
        }),
        item: i,
      }
    })
  }

  if (props.granularity === 'district') {
    return props.items.map((i) => {
      const r = i as MapRegionItem
      return {
        key: itemKey(i),
        title: r.district ?? r.name,
        subtitle: r.name,
        price: formatPyeongLabel(r),
        href: toRealEstateListUrl({
          type: props.type as RealEstateUrlType,
          city: r.name,
          district: r.district ?? '',
        }),
        item: i,
      }
    })
  }

  const byName = new Map<string, MapRegionItem>()
  for (const i of props.items) {
    if (!isBuildingItem(i)) byName.set((i as MapRegionItem).name, i as MapRegionItem)
  }

  return SIDO_CHIPS.map((chip) => {
    const agg = byName.get(chip.label) ?? byName.get(chip.slug)
    const item: MapRegionItem = agg ?? {
      name: chip.label, district: null, lat: 0, lng: 0, avgPricePerPyeong: null, transactionCount: 0,
    }
    return {
      key: `${chip.label}|`,
      title: chip.label,
      subtitle: null,
      price: formatPyeongLabel(item),
      href: `/real-estate/${props.type}/${chip.slug}`,
      item,
    }
  })
})
</script>
