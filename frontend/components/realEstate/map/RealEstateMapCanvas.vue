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
  type: string
  selectedKey: string | null
}>()

const emit = defineEmits<{
  idle: [MapBounds, number, { lat: number; lng: number }]
  select: [MapItem]
  hover: [MapItem | null]
}>()

// panTo 재진입 루프 가드용 — 위경도가 이 값 미만으로 차이나면 "이미 그 위치"로 간주한다.
const CENTER_EPSILON = 1e-6

const container = ref<HTMLElement | null>(null)
const { map, initMap, getBounds, getCenter, setCenter } = useKakaoMap()
const { renderOverlays, clearOverlays } = useMapOverlays()

// Kakao 는 Mercator 투영이라 getBounds() sw/ne 의 산술평균은 지도의 실제 중심과 다르다
// (위도가 갈릴수록 오차 커짐). 상위(onIdle)가 이 값으로 center 를 다시 설정 → 아래
// watch(props.center) 가 panTo → 지도 이동 → idle 재발화 → 오차 누적으로 발산하는 루프가
// 있었다(실측: hash lat 36.19→32.20→16.26→-0.80→...). getBounds() 는 API bbox 용으로 그대로
// 쓰고, 중심은 반드시 getCenter() 의 실제 값을 올려보낸다.
function emitIdle(): void {
  if (import.meta.server || !map.value) return
  const b = getBounds()
  if (!b) return
  const c = getCenter()
  if (!c) return
  emit('idle', { swLat: b.sw.lat, swLng: b.sw.lng, neLat: b.ne.lat, neLng: b.ne.lng }, map.value.getLevel(), c)
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
  }, { type: props.type, selectedKey: props.selectedKey })
  emitIdle()
})

watch(
  () => props.items,
  (items) => {
    if (import.meta.server || !map.value) return
    renderOverlays(map.value, items, {
      onClick: (i) => emit('select', i),
      onHover: (i) => emit('hover', i),
    }, { type: props.type, selectedKey: props.selectedKey })
  },
)

// 선택이 바뀌면 라벨↔펼침 카드가 달라지므로 다시 그린다. items 는 그대로라
// 위 watch 가 발화하지 않는다.
watch(
  () => props.selectedKey,
  () => {
    if (import.meta.server || !map.value) return
    renderOverlays(map.value, props.items, {
      onClick: (i) => emit('select', i),
      onHover: (i) => emit('hover', i),
    }, { type: props.type, selectedKey: props.selectedKey })
  },
)

// 사이드바/마커 선택(select) 이 상위에서 center 를 바꾸면 지도를 그 위치로 이동시킨다.
// 최초 위치는 initMap 이 이미 반영하므로 여기서는 변경분만 처리한다.
//
// panTo 가 아니라 setCenter 다. panTo 는 애니메이션 이동이라, 목표 지점이 이미 화면 안에
// 있으면 사실상 움직이지 않는다 — 전국 뷰(level 13)에서 서울 행을 클릭하면 서울이 이미
// 화면에 있어 지도가 확대만 되고 중심은 그대로였다(라이브 실측: 타일은 13→9 로 바뀌는데
// 해시 lat/lng 는 소수점 15자리까지 불변). 드릴다운은 "그 지역으로 간다"는 명시적 동작이라
// 즉시 이동이 의미상으로도 맞다.
//
// 멱등성 가드: 들어온 center 가 지도의 현재 실제 중심(getCenter())과 사실상 같으면
// 이동을 스킵한다. emitIdle 이 이미 실제 중심을 올려보내므로 정상 왕복에서는 이 값이
// 거의 항상 일치하지만, 위쪽 경로가 나중에 다시 어긋난 값을 내려보내더라도 이 가드가
// idle→이동→idle 재발화 루프를 구조적으로 끊는다.
watch(
  () => props.center,
  (c) => {
    if (import.meta.server || !map.value) return
    const current = getCenter()
    if (
      current &&
      Math.abs(current.lat - c.lat) < CENTER_EPSILON &&
      Math.abs(current.lng - c.lng) < CENTER_EPSILON
    ) {
      return
    }
    setCenter(c.lat, c.lng)
  },
)

// 해시(#level=)로 넘어온 레벨을 마운트 이후에도 반영한다(공유 링크 복원). initMap 은
// props.level 을 최초 1회만 읽으므로(마운트 시점), 그 뒤에 값이 바뀌면 여기서 직접
// setLevel 을 호출해야 지도에 반영된다.
// 멱등성 가드: 지도가 이미 그 레벨이면 스킵한다. emitIdle 이 map.value.getLevel() 을 그대로
// 올려보내므로, 상위(RealEstateMapExplorer)가 그 값을 다시 level prop 으로 내려보내는 정상
// 왕복에서는 이 값이 거의 항상 일치한다 — 가드가 없으면 setLevel → idle 재발화 →
// onMapIdle(level) → level prop 갱신 → setLevel 로 이어지는 루프가 생길 수 있다(위 center
// 루프와 동일한 형태).
watch(
  () => props.level,
  (lvl) => {
    if (import.meta.server || !map.value) return
    if (map.value.getLevel() === lvl) return
    map.value.setLevel(lvl)
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
