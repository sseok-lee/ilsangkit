<template>
  <HardLink v-if="hard" :to="to" :class="linkClass">
    <span v-if="$slots.badge" class="flex flex-1 min-w-0 items-center gap-2">
      <slot name="badge" />
      <span class="truncate text-[15px] text-ink">{{ name }}</span>
    </span>
    <span v-else-if="sub" class="flex-1 min-w-0">
      <span class="block truncate text-[15px] text-ink">{{ name }}</span>
      <span class="block truncate mt-0.5 text-xs text-muted" data-testid="nearby-place-sub">{{ sub }}</span>
    </span>
    <span v-else class="flex-1 min-w-0 truncate text-[15px] text-ink">{{ name }}</span>
    <span class="shrink-0 text-right tabular-nums">
      <span :class="distanceClass">{{ distance }}m</span>
      <span :class="walkClass">도보 약 {{ walk }}분</span>
    </span>
  </HardLink>
  <NuxtLink v-else :to="to" :class="linkClass">
    <span v-if="$slots.badge" class="flex flex-1 min-w-0 items-center gap-2">
      <slot name="badge" />
      <span class="truncate text-[15px] text-ink">{{ name }}</span>
    </span>
    <span v-else-if="sub" class="flex-1 min-w-0">
      <span class="block truncate text-[15px] text-ink">{{ name }}</span>
      <span class="block truncate mt-0.5 text-xs text-muted" data-testid="nearby-place-sub">{{ sub }}</span>
    </span>
    <span v-else class="flex-1 min-w-0 truncate text-[15px] text-ink">{{ name }}</span>
    <span class="shrink-0 text-right tabular-nums">
      <span :class="distanceClass">{{ distance }}m</span>
      <span :class="walkClass">도보 약 {{ walk }}분</span>
    </span>
  </NuxtLink>
</template>

<script setup lang="ts">
// 행 = 링크 1개. 이름(+보조 줄) 왼쪽, 거리·도보 오른쪽. 부동산 상세·시설 상세 "주변" 목록 공용.
// (템플릿 루트에 주석을 두면 fragment 가 돼 부모의 class 가 링크에 안 붙는다)
import { computed } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import { walkMinutes } from '~/utils/walkMinutes'

const props = withDefaults(defineProps<{
  to: string
  name: string
  /** 이름 아래 보조 줄(주소·핵심 정보). 비어 있으면 그리지 않는다. 배지 슬롯과는 함께 쓰지 않는다. */
  sub?: string
  /** 직선거리(m, 정수) */
  distance: number
  /** true 면 <a href>(HardLink), 아니면 NuxtLink */
  hard?: boolean
  /** true 면 행 높이 64px 이상 + 거리·도보를 화면 폭과 관계없이 두 줄로 */
  stacked?: boolean
}>(), {
  sub: '',
  hard: false,
  stacked: false,
})

const walk = computed(() => walkMinutes(props.distance))

const linkClass = computed(() =>
  `flex items-center justify-between gap-3 ${props.stacked ? 'min-h-[64px]' : 'min-h-[52px]'} py-2 hover:bg-primary-50/40 transition-colors duration-200`,
)
const distanceClass = computed(() =>
  props.stacked ? 'block text-sm font-bold text-strong' : 'block md:inline text-sm font-bold text-strong',
)
const walkClass = computed(() =>
  props.stacked ? 'block text-xs text-muted' : 'block md:inline md:ml-1.5 text-xs text-muted',
)
</script>
