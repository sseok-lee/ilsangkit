<template>
  <div ref="container" class="w-full h-full bg-background-light" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useKakaoMap } from '~/composables/useKakaoMap'
import { useMapOverlays } from '~/composables/useMapOverlays'
import type { MapBounds, MapItem } from '~/types/realEstateMap'

const props = defineProps<{
  items: MapItem[]
  center: { lat: number; lng: number }
  level: number
}>()

const emit = defineEmits<{
  idle: [MapBounds, number]
  select: [MapItem]
  hover: [MapItem | null]
}>()

const container = ref<HTMLElement | null>(null)
const { map, initMap, getBounds, panTo } = useKakaoMap()
const { renderOverlays, clearOverlays } = useMapOverlays()

function emitIdle(): void {
  if (import.meta.server || !map.value) return
  const b = getBounds()
  if (!b) return
  emit('idle', { swLat: b.sw.lat, swLng: b.sw.lng, neLat: b.ne.lat, neLng: b.ne.lng }, map.value.getLevel())
}

onMounted(async () => {
  // SDK 로드를 onNuxtReady 이후로 미뤄 좌측 SSR 목록이 LCP 를 잡게 한다.
  if (import.meta.server || !container.value) return
  // onNuxtReady 는 Nuxt 자동 import 전역이지만 eslint.config 의 .vue 전역 allowlist에는
  // 없다(이 태스크는 eslint.config 변경 범위 밖) — 명시 import(#app)는 vitest 모듈 해석이
  // 안 되어 테스트가 깨진다. 억제 주석으로 해결한다.
  // eslint-disable-next-line no-undef
  await new Promise<void>((r) => onNuxtReady(() => r()))
  // initMap 은 (container, { center, level }) 객체 인자를 받는다 — 위치 인자가 아니다
  await initMap(container.value, { center: props.center, level: props.level })
  if (!map.value) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kakao = (window as any).kakao
  kakao.maps.event.addListener(map.value, 'idle', emitIdle)
  renderOverlays(map.value, props.items, {
    onClick: (i) => emit('select', i),
    onHover: (i) => emit('hover', i),
  })
  emitIdle()
})

watch(
  () => props.items,
  (items) => {
    if (import.meta.server || !map.value) return
    renderOverlays(map.value, items, {
      onClick: (i) => emit('select', i),
      onHover: (i) => emit('hover', i),
    })
  },
)

// 사이드바/마커 선택(select) 이 상위에서 center 를 바꾸면 지도를 그 위치로 이동시킨다.
// 최초 위치는 initMap 이 이미 반영하므로 여기서는 변경분만 처리한다.
watch(
  () => props.center,
  (c) => {
    if (import.meta.server || !map.value) return
    panTo(c.lat, c.lng)
  },
)

onBeforeUnmount(() => {
  if (import.meta.server) return
  clearOverlays()
  if (map.value) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao
    kakao.maps.event.removeListener(map.value, 'idle', emitIdle)
  }
})
</script>
