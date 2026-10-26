<template>
  <section :aria-labelledby="`nearby-facility-${sectionKey}`" data-testid="nearby-facility-section">
    <div class="flex items-baseline justify-between gap-3 pb-2 border-b border-ink">
      <h3 :id="`nearby-facility-${sectionKey}`" class="text-[15px] font-bold text-strong">{{ label }}</h3>
      <span class="text-xs text-muted tabular-nums" data-testid="nearby-facility-count">{{ countLabel }}</span>
    </div>

    <!-- 4·5번째 행도 SSR HTML 에 렌더하고 모바일에서만 CSS 로 숨긴다(크롤러가 내부 링크를 본다). -->
    <ul :id="`nearby-facility-list-${sectionKey}`">
      <li
        v-for="(row, index) in rows"
        :key="row.key"
        class="border-b border-line"
        :class="{ 'max-md:hidden': index >= mobileVisible && !expanded }"
      >
        <NearbyPlaceRow
          :to="row.url"
          :name="row.name"
          :sub="row.sub"
          :distance="row.distance"
          :hard="row.hard"
          :stacked="stacked"
        >
          <template v-if="row.badge && $slots.badge" #badge>
            <slot name="badge" :row="row" />
          </template>
        </NearbyPlaceRow>
      </li>
    </ul>

    <button
      v-if="rows.length > mobileVisible"
      type="button"
      class="md:hidden flex w-full items-center justify-center min-h-[44px] text-[13px] font-bold text-primary"
      :aria-expanded="expanded ? 'true' : 'false'"
      :aria-controls="`nearby-facility-list-${sectionKey}`"
      @click="expanded = !expanded"
    >
      {{ expanded ? '접기' : `${rows.length}곳 모두 보기` }}
    </button>
  </section>
</template>

<script lang="ts">
export interface NearbyPlaceRowData {
  key: string
  name: string
  url: string
  /** 직선거리(m, 정수) */
  distance: number
  /** 이름 아래 보조 줄 */
  sub?: string
  /** true 면 <a href>(HardLink), 아니면 NuxtLink */
  hard?: boolean
  /** 값이 있으면 badge 슬롯을 그린다(슬롯 props 의 row 로 전달). 예: 지하철 노선명 */
  badge?: string
}
</script>

<script setup lang="ts">
import { ref } from 'vue'
import NearbyPlaceRow from '~/components/common/nearby/NearbyPlaceRow.vue'

withDefaults(defineProps<{
  /** id·aria 접미사(카테고리 키 등). 페이지 안에서 유일해야 한다. */
  sectionKey: string
  label: string
  /** 머리 오른쪽 개수 문구 — formatNearbyCount() */
  countLabel: string
  rows: NearbyPlaceRowData[]
  /** 모바일에서 처음 보이는 행 수. 나머지는 "모두 보기"로 편다. */
  mobileVisible?: number
  stacked?: boolean
}>(), {
  mobileVisible: 3,
  stacked: false,
})

const expanded = ref(false)
</script>
