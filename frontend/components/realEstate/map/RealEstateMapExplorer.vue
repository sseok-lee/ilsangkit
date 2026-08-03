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
          :show-ad="isDesktop === true"
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
        :show-ad="isDesktop === false"
        @hover="hoveredKey = $event"
        @select="onSelect"
      />
    </MapBottomSheet>
  </section>
</template>

<script setup lang="ts">
// onMounted 를 명시 import 한다 — 이 컴포넌트는 테스트에서 직접 mount 되므로
// auto-import 에 기대면 로컬은 통과하고 CI 에서만 ReferenceError 가 난다.
import { ref, onMounted, onBeforeUnmount } from 'vue'
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
  hoveredKey, setType, setLevel, onMapIdle,
} = useRealEstateMap({
  type: props.initialType,
  items: props.initialItems,
  granularity: props.initialGranularity,
})

let lastBounds: MapBounds = { swLat: 33, swLng: 124, neLat: 39, neLng: 132 }

// MapSidebar 가 데스크톱 aside 와 모바일 바텀시트 두 사본으로 항상 동시에 마운트된다
// (안 보이는 쪽은 CSS `hidden`/`lg:hidden`일 뿐 DOM 에서 사라지지 않는다). 그 안의
// AdBanner 가 인피드 광고를 하나만 요청하도록, 실제로 보이는 뷰포트 쪽에만
// showAd=true 를 내려준다. 초기값 null 은 "아직 모른다"를 뜻하며, 두 사본 모두
// `isDesktop === true` / `=== false` 비교가 false 가 되어 광고가 하나도 안 뜬다 —
// SSR 출력과 마운트 직후 첫 클라이언트 렌더가 이 상태로 일치하므로 하이드레이션
// mismatch 가 없다. matchMedia 결과가 들어오는 순간(this onMounted 이후) 정확히 한
// 쪽만 true 로 바뀐다.
const isDesktop = ref<boolean | null>(null)
let desktopMq: MediaQueryList | null = null
function applyIsDesktop(): void {
  if (desktopMq) isDesktop.value = desktopMq.matches
}

// SSR 은 항상 시/도 목록을 렌더한다(하이드레이션 일치). 해시는 마운트 후에만 읽어
// 지도를 옮기고, 지도 idle 이 좌측을 갱신한다 — post-hydration 업데이트라 mismatch 가 아니다.
//
// 공유 링크가 네 필드(type/level/lat/lng) 전부를 담기 때문에(buildMapHash), 여기서도
// 네 필드 전부를 반영해야 한다. lat/lng 만 반영하면 "빌라 전월세, 강남 건물 단위" 링크를
// 받은 사람이 "아파트 매매, 전국 단위"로 Gangnam 근처만 중심잡힌 화면을 보게 된다 — 지도
// 중심은 맞는데 무엇을 보는지가 틀린, 반쯤만 동작하는 상태.
//
// - type 은 setType(next, bounds) 으로 반영한다 — 기존 필터 전환 경로(onTypeChange)와
//   동일하게, 기본 전국 bounds(lastBounds 초기값)로 즉시 한 번 fetch 한다. RealEstateMapCanvas
//   가 initMap 뒤 스스로 idle 을 emit 하면 실제 bounds/level 로 다시 fetch 되어 이 값을
//   덮어쓴다(seq 가드로 안전) — 여기서 fetch 를 생략하면 지도가 초기화되기 전까지 사이드바가
//   구 타입 데이터를 보여준다.
// - level 은 setLevel(next) 으로 값만 세팅한다(fetch 트리거 없음) — RealEstateMapCanvas 가
//   이 값을 props 로 받아 initMap({ center, level }) 에 그대로 넘기므로, 지도가 애초에 그
//   레벨로 뜬다. 여기서 fetch 까지 하면(전국 bounds 로) setType 과 중복된다.
onMounted(() => {
  if (import.meta.server) return
  const h = parseMapHash(window.location.hash)
  if (h.lat != null && h.lng != null) center.value = { lat: h.lat, lng: h.lng }
  if (h.level != null) setLevel(h.level)
  if (h.type != null) setType(h.type, lastBounds)

  // tailwind.config.js 기본 screens: lg = 1024px (프로젝트가 screens 를 오버라이드하지 않음).
  // aside 는 `lg:block`, MapBottomSheet 는 `lg:hidden` 이므로 같은 기준선을 그대로 따른다.
  desktopMq = typeof window.matchMedia === 'function'
    ? window.matchMedia('(min-width: 1024px)')
    : null
  applyIsDesktop()
  desktopMq?.addEventListener('change', applyIsDesktop)
})

onBeforeUnmount(() => {
  desktopMq?.removeEventListener('change', applyIsDesktop)
})

function syncHash(): void {
  if (import.meta.server) return
  // 쿼리스트링이 아니라 해시다 — swr 캐시 키 분기 방지(설계문서 5.6)
  history.replaceState(null, '', buildMapHash({
    type: type.value, level: level.value, lat: center.value.lat, lng: center.value.lng,
  }))
}

// mapCenter 는 RealEstateMapCanvas 가 getCenter() 로 올려보낸 지도의 실제 중심이다.
// bounds.sw/ne 의 산술중점을 쓰면 Kakao 의 Mercator 투영 때문에 실제 중심과 어긋나고,
// 그 어긋난 값이 다시 panTo → idle 재발화 → 재계산으로 이어져 발산하는 루프가 됐다
// (실측: hash lat 36.19→32.20→16.26→-0.80→... 무한 드리프트). bounds 자체는 검색 bbox
// 용으로 왜곡 없이 그대로 onMapIdle 에 넘긴다.
function onIdle(bounds: MapBounds, lvl: number, mapCenter: { lat: number; lng: number }): void {
  lastBounds = bounds
  center.value = mapCenter
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
