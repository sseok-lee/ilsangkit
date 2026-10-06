<template>
  <section class="fixed inset-x-0 top-16 lg:top-20 bottom-0">
    <!--
      fixed 로 뷰포트에 직접 고정한다. top-16/lg:top-20 은 AppHeader h-16/lg:h-20 과
      맞춘 값이다. 헤더 아래에서 시작해야 데스크톱 사이드바 첫 행과 필터바가 가려지지 않는다.
    -->
    <div class="absolute inset-0 flex flex-col bg-white">
      <div class="hidden lg:flex h-[78px] shrink-0 items-center gap-6 border-b border-line bg-white px-6">
        <div class="min-w-[136px]">
          <p class="text-xl font-extrabold tracking-[-0.02em] text-ink">부동산 실거래가</p>
        </div>
        <MapFilterBar :type="type" @update:type="onTypeChange" />
        <div class="ml-auto inline-flex rounded-xl border border-line bg-background-light p-1 text-sm font-semibold text-slate-700">
          <button type="button" class="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-line bg-white px-4 text-primary" aria-current="page">
            <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 18 3.8 20.6V6.6L9 4m0 14 6 2.6m-6-2.6V4m6 16.6 5.2-2.6V4L15 6.6m0 14V6.6M15 6.6 9 4" />
            </svg>
            지도
          </button>
          <a :href="listHref" class="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-transparent px-4 hover:bg-white">
            <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <path d="M8 6h12M8 12h12M8 18h12" />
              <path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3" />
            </svg>
            목록
          </a>
        </div>
      </div>

      <div class="relative min-h-0 flex-1 lg:flex">
        <aside class="hidden lg:flex lg:w-[360px] lg:shrink-0 border-r border-line">
          <MapSidebar
            class="w-full"
            :items="items as MapItem[]"
            :granularity="granularity"
            :total="total"
            :exact="exact"
            :pending="pending"
            :type="type"
            :show-footer="isDesktop === true"
            :selected-key="selectedKey"
            :error="visibleError"
            :list-href="listHref"
            :list-label="listLabel"
            @hover="hoveredKey = $event"
            @select="onSelect"
            @retry="retryAll"
          />
        </aside>

        <div class="map-canvas-panel" :style="mobileCanvasStyle">
          <div class="absolute top-2 left-2 right-2 z-20 lg:hidden">
            <MapFilterBar :type="type" @update:type="onTypeChange" />
          </div>
          <ClientOnly>
            <RealEstateMapCanvas
              ref="canvasRef"
              :items="items as MapItem[]"
              :center="center"
              :level="level"
              :type="type"
              :selected-key="selectedKey"
              @idle="onIdle"
              @select="onSelect"
              @hover="hoveredKey = $event ? itemKey($event) : null"
              @load-error="onCanvasLoadError"
              @loaded="onCanvasLoaded"
            />
            <template #fallback>
              <div class="w-full h-full bg-background-light animate-pulse" />
            </template>
          </ClientOnly>
        </div>
      </div>
    </div>

    <MapBottomSheet v-model:expanded="bottomSheetExpanded">
      <MapSidebar
        :items="items as MapItem[]"
        :granularity="granularity"
        :total="total"
        :exact="exact"
        :pending="pending"
        :type="type"
        :show-footer="isDesktop === false"
        :selected-key="selectedKey"
        :error="visibleError"
        :list-href="listHref"
        :list-label="listLabel"
        @hover="hoveredKey = $event"
        @select="onSelect"
        @retry="retryAll"
      />
    </MapBottomSheet>
  </section>
</template>

<script setup lang="ts">
// onMounted 를 명시 import 한다 — 이 컴포넌트는 테스트에서 직접 mount 되므로
// auto-import 에 기대면 로컬은 통과하고 CI 에서만 ReferenceError 가 난다.
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import MapSidebar from './MapSidebar.vue'
import MapFilterBar from './MapFilterBar.vue'
import RealEstateMapCanvas from './RealEstateMapCanvas.vue'
import MapBottomSheet from './MapBottomSheet.vue'
import { useRealEstateMap, itemKey, buildMapHash, parseMapHash } from '~/composables/useRealEstateMap'
import { KOREA_BOUNDS, type Granularity, type MapBounds, type MapItem } from '~/types/realEstateMap'
import { explorationListHref } from '~/utils/explorationNavigation'
import type { RealEstateUrlType } from '~/utils/realEstateUrl'

const props = defineProps<{
  initialType: string
  initialItems: MapItem[]
  initialGranularity: Granularity
}>()

const center = ref({ lat: 36.5, lng: 127.8 })
const canvasRef = ref<{ retry: () => Promise<void> } | null>(null)
const canvasError = ref<string | null>(null)
const listRegion = ref<{ city: string; district?: string } | null>(null)
const bottomSheetExpanded = ref(false)
const mobileCanvasStyle = computed(() => ({
  '--sheet-cover': bottomSheetExpanded.value ? '75dvh' : '38dvh',
}))
/**
 * 펼쳐진 건물 마커의 키. null 이면 전부 접힌 상태다.
 * 형식은 useRealEstateMap.itemKey 의 건물 분기와 같다 — `buildingName|district`.
 */
const selectedKey = ref<string | null>(null)
const {
  type, level, granularity, items, total, exact, pending, error,
  // hoveredKey: 사이드바/캔버스 hover 로 채워지지만 현재는 아무 것도 읽지 않는다 — 소비처(하이라이트
  // 오버레이) 연결은 useMapOverlays 렌더 API 변경이 필요해 이 태스크 범위 밖. 의도적 보류다.
  hoveredKey, setType, setLevel, onMapIdle, retry,
} = useRealEstateMap({
  type: props.initialType,
  items: props.initialItems,
  granularity: props.initialGranularity,
})

const visibleError = computed(() => canvasError.value ?? error.value)
const listHref = computed(() => explorationListHref(type.value as RealEstateUrlType, listRegion.value))
const listLabel = computed(() => listRegion.value ? '이 지역 목록 보기' : '전국 목록 보기')

// 같은 granularity 안의 팬/줌은 선택을 유지해야 하지만, granularity 자체가 바뀌면
// (building→dong 등) 목록의 항목 단위가 완전히 달라진다. 이 상태에서 건물 "은마"를
// 선택한 채 줌아웃(building→dong)했다가 다시 줌인(dong→building)하면, 새로 받아온
// building 목록에 같은 키가 재등장해 클릭 없이 카드가 저절로 다시 펼쳐진다 — 줌
// 왕복 자체가 선택 동작처럼 보이는 사고다. granularity 변경 시점에만 선택을 비운다.
watch(granularity, () => {
  selectedKey.value = null
})

let lastBounds: MapBounds = { swLat: 33, swLng: 124, neLat: 39, neLng: 132 }

// MapSidebar 가 데스크톱 aside 와 모바일 바텀시트 두 사본으로 항상 동시에 마운트된다
// (안 보이는 쪽은 CSS `hidden`/`lg:hidden`일 뿐 DOM 에서 사라지지 않는다). 출처 표기가
// 2벌 생기지 않도록 실제로 보이는 뷰포트 쪽에만 showFooter=true 를 내려준다.
// 초기값 null 은 "아직 모른다"를 뜻하며, 두 사본 모두 `isDesktop === true` / `=== false`
// 비교가 false 가 되어 어느 쪽도 렌더하지 않는다 — SSR 출력과 마운트 직후 첫 클라이언트
// 렌더가 이 상태로 일치하므로 하이드레이션 mismatch 가 없다. matchMedia 결과가 들어오는
// 순간(onMounted 이후) 정확히 한 쪽만 true 로 바뀐다.
//
// 종전에는 인피드 광고(showAd)도 같은 게이트를 썼는데, 이 페이지에서 광고를 전부 빼면서
// 남은 소비처는 출처 표기뿐이다.
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
  // aside 는 `lg:flex`, MapBottomSheet 는 `lg:hidden` 이므로 같은 기준선을 그대로 따른다.
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
  // 다른 목록으로 갈아타므로 이전 선택 키는 의미가 없다.
  selectedKey.value = null
  syncHash()
}

function onCanvasLoadError(message: string): void {
  canvasError.value = message
}

function onCanvasLoaded(): void {
  canvasError.value = null
}

async function retryAll(): Promise<void> {
  await Promise.all([
    retry(),
    canvasError.value ? canvasRef.value?.retry() : Promise.resolve(),
  ])
}

/**
 * 좌표가 실제로 대한민국 영역 안인지. `!= null` 만으로는 부족하다 — MapSidebar 의
 * SIDO_CHIPS 폴백 항목처럼 좌표가 없는 아이템이 과거 `lat:0, lng:0`(기니만 앞바다, 유효한
 * 좌표)을 들고 있었던 적이 있어 지도가 실제로 그리로 튀는 사고가 났다(라이브 실측: 해시가
 * lat=-11363.89… 로 발산). null 은 지금 막지만, 방어적으로 KOREA_BOUNDS 범위 자체도
 * 검증한다 — 백엔드 스키마(backend/src/schemas/realEstateMap.ts)와 값이 같다.
 */
function isWithinKoreaBounds(lat: number, lng: number): boolean {
  return (
    lat >= KOREA_BOUNDS.LAT_MIN && lat <= KOREA_BOUNDS.LAT_MAX &&
    lng >= KOREA_BOUNDS.LNG_MIN && lng <= KOREA_BOUNDS.LNG_MAX
  )
}

/**
 * 사이드바 행 클릭(city/district/dong) → 지도를 드릴다운한다. 클릭 시점의 granularity 가 곧
 * 클릭된 행의 단위다(목록 전체가 항상 현재 granularity 로 렌더되므로). building 행은
 * 상세 페이지로 네비게이션하므로 level 을 건드리지 않는다.
 *
 * 9/7/5 는 임의값이 아니라 backend resolveGranularity 의 히스테리시스 되돌림 밴드를
 * 피해 실제로 다음 단위로 넘어가는 값이다(설계문서 5.2):
 * - city(≥11) 에서 10 으로 가면 city 로 되돌아간다 → 9
 * - district(9~10) 에서 8 로 가면 district 로 되돌아간다 → 7
 * - dong(7~8) 에서 6 으로 가면 dong 으로 되돌아간다 → 5
 *
 * setLevel 은 값만 세팅한다 — RealEstateMapCanvas 가 이 level 을 감시해 지도를 옮기고,
 * 그 idle 이벤트가 새 bounds/level 로 다시 fetch 한다. 여기서 fetch 를 직접 호출하지 않는다.
 *
 * 좌표가 유효하지 않으면(null 이거나 한국 밖) center 는 건드리지 않고 level 만 적용한다 —
 * 목록/지도는 현재 뷰포트 bounds 기준으로 다시 조회되므로 화면이 깨지지 않는다.
 */
function onSelect(item: MapItem): void {
  if ('buildingName' in item) {
    listRegion.value = { city: item.city, district: item.district }
  } else if (granularity.value === 'city') {
    listRegion.value = { city: item.name }
  } else if (item.district) {
    listRegion.value = { city: item.name, district: item.district }
  }

  const { lat, lng } = item
  if (lat != null && lng != null && isWithinKoreaBounds(lat, lng)) {
    center.value = { lat, lng }
  }
  if (granularity.value === 'city') setLevel(9)
  else if (granularity.value === 'district') setLevel(7)
  else if (granularity.value === 'dong') setLevel(5)
  else {
    // 건물 단계에는 더 파고들 곳이 없다 — 대신 값과 상세 링크를 펼친다.
    // 같은 것을 다시 고르면 접는다.
    const key = itemKey(item)
    selectedKey.value = selectedKey.value === key ? null : key
  }
}

// 테스트가 선택 상태를 직접 확인할 수 있게 노출한다. script setup 은 기본적으로 닫혀 있다.
defineExpose({ selectedKey })
</script>


<style scoped>
.map-canvas-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: calc(var(--sheet-cover) + 20px);
  left: 0;
  min-height: 0;
}

@media (min-width: 1024px) {
  .map-canvas-panel {
    position: relative;
    inset: auto;
    flex: 1 1 0%;
  }
}
</style>
