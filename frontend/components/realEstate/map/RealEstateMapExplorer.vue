<template>
  <section class="relative">
    <div class="lg:flex lg:h-[calc(100vh-4rem)] lg:min-h-[560px]">
      <!-- 좌측: 이 페이지의 유일한 SSR 콘텐츠. ClientOnly 로 감싸지 않는다. -->
      <aside class="hidden lg:block lg:w-[22%] lg:min-w-[280px] lg:max-w-[360px] border-r border-line">
        <MapSidebar
          :items="items as MapItem[]"
          :granularity="granularity"
          :total="total"
          :exact="exact"
          :pending="pending"
          :type="type"
          @hover="hoveredKey = $event"
          @select="onSelect"
        />
      </aside>

      <div class="relative flex-1 h-[60vh] lg:h-auto">
        <div class="absolute top-2 left-2 right-2 z-20">
          <MapFilterBar :type="type" @update:type="onTypeChange" />
        </div>
        <ClientOnly>
          <RealEstateMapCanvas
            :items="items as MapItem[]"
            :center="center"
            :level="level"
            @idle="onIdle"
            @select="onSelect"
            @hover="hoveredKey = $event ? itemKey($event) : null"
          />
          <template #fallback>
            <div class="w-full h-full bg-background-light animate-pulse" />
          </template>
        </ClientOnly>
      </div>
    </div>

    <!-- 모바일: 지도 전체 + 하단 바텀시트 -->
    <MapBottomSheet>
      <MapSidebar
        :items="items as MapItem[]"
        :granularity="granularity"
        :total="total"
        :exact="exact"
        :pending="pending"
        :type="type"
        @hover="hoveredKey = $event"
        @select="onSelect"
      />
    </MapBottomSheet>
  </section>
</template>

<script setup lang="ts">
// onMounted 를 명시 import 한다 — 이 컴포넌트는 테스트에서 직접 mount 되므로
// auto-import 에 기대면 로컬은 통과하고 CI 에서만 ReferenceError 가 난다.
import { ref, onMounted } from 'vue'
import MapSidebar from './MapSidebar.vue'
import MapFilterBar from './MapFilterBar.vue'
import RealEstateMapCanvas from './RealEstateMapCanvas.vue'
import MapBottomSheet from './MapBottomSheet.vue'
import { useRealEstateMap, itemKey, buildMapHash, parseMapHash } from '~/composables/useRealEstateMap'
import type { Granularity, MapBounds, MapItem } from '~/types/realEstateMap'

const props = defineProps<{
  initialType: string
  initialItems: MapItem[]
  initialGranularity: Granularity
}>()

const center = ref({ lat: 36.5, lng: 127.8 })
const {
  type, level, granularity, items, total, exact, pending,
  // hoveredKey: 사이드바/캔버스 hover 로 채워지지만 현재는 아무 것도 읽지 않는다 — 소비처(하이라이트
  // 오버레이) 연결은 useMapOverlays 렌더 API 변경이 필요해 이 태스크 범위 밖. 의도적 보류다.
  hoveredKey, setType, onMapIdle,
} = useRealEstateMap({
  type: props.initialType,
  items: props.initialItems,
  granularity: props.initialGranularity,
})

let lastBounds: MapBounds = { swLat: 33, swLng: 124, neLat: 39, neLng: 132 }

// SSR 은 항상 시/도 목록을 렌더한다(하이드레이션 일치). 해시는 마운트 후에만 읽어
// 지도를 옮기고, 지도 idle 이 좌측을 갱신한다 — post-hydration 업데이트라 mismatch 가 아니다.
onMounted(() => {
  if (import.meta.server) return
  const h = parseMapHash(window.location.hash)
  if (h.lat != null && h.lng != null) center.value = { lat: h.lat, lng: h.lng }
})

function syncHash(): void {
  if (import.meta.server) return
  // 쿼리스트링이 아니라 해시다 — swr 캐시 키 분기 방지(설계문서 5.6)
  history.replaceState(null, '', buildMapHash({
    type: type.value, level: level.value, lat: center.value.lat, lng: center.value.lng,
  }))
}

function onIdle(bounds: MapBounds, lvl: number): void {
  lastBounds = bounds
  center.value = { lat: (bounds.swLat + bounds.neLat) / 2, lng: (bounds.swLng + bounds.neLng) / 2 }
  onMapIdle(bounds, lvl)
  syncHash()
}

function onTypeChange(next: string): void {
  setType(next, lastBounds)
  syncHash()
}

function onSelect(item: MapItem): void {
  if (item.lat != null && item.lng != null) center.value = { lat: item.lat, lng: item.lng }
}
</script>
