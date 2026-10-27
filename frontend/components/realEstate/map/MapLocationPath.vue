<template>
  <!--
    지도 현재 위치 경로("서울 › 서초구 › 서초동"). 모바일·데스크톱 모두 지도 하단 가운데 알약(pill)으로 놓인다.

    상위 칸은 일반 a + click.exact.prevent 다(MapSidebar 지역 행·MapFilterBar 와 같은 패턴) —
    클릭은 지도를 그 단계로 올리고, ⌘/Ctrl 클릭은 가로채지 않아 같은 지역의 목록 허브가 새 탭으로 열린다.
    pill 이 지도 위에 떠 있으므로 가독성은 MapFilterBar 와 같은 방식(테두리 + shadow-card-2)으로 맡는다.
  -->
  <nav
    aria-label="현재 지도 위치"
    data-testid="map-location-path"
    :class="variant === 'pill'
      ? 'inline-flex min-w-0 max-w-full items-center overflow-hidden rounded-full border border-line bg-white/95 px-3 shadow-card-2'
      : 'flex min-w-0 max-w-full items-center overflow-hidden'"
  >
    <ol class="flex min-w-0 max-w-full items-center gap-0.5 text-sm">
      <li v-for="(crumb, i) in crumbs" :key="`${i}-${crumb.label}`" class="flex min-w-0 items-center gap-0.5">
        <span v-if="i > 0" class="shrink-0 px-0.5 text-faint" aria-hidden="true">›</span>
        <!-- 말줄임은 안쪽 span 에 건다 — flex 컨테이너의 텍스트에는 text-overflow 가 먹지 않는다. -->
        <a
          v-if="crumb.href && crumb.level != null"
          :href="crumb.href"
          class="flex min-h-[44px] min-w-0 items-center px-1 font-medium text-primary hover:underline"
          @click.exact.prevent="emit('navigate', crumb)"
        ><span class="truncate">{{ crumb.label }}</span></a>
        <span
          v-else
          class="flex min-h-[44px] min-w-0 items-center px-1 font-bold text-ink"
          aria-current="location"
        ><span class="truncate">{{ crumb.label }}</span></span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import type { MapPathCrumb } from '~/utils/mapLocationPath'

withDefaults(defineProps<{
  crumbs: MapPathCrumb[]
  variant?: 'pill' | 'plain'
}>(), {
  variant: 'plain',
})

const emit = defineEmits<{ navigate: [MapPathCrumb] }>()
</script>
