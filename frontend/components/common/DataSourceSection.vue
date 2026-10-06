<template>
  <!-- compact — 시안 .source-line: 상자 없는 출처 한 줄 -->
  <p
    v-if="compact"
    class="source-line flex flex-wrap items-center gap-2.5 py-[22px] text-sm text-muted"
  >
    <span><b class="font-semibold text-ink">데이터 출처</b> 공공데이터포털 (행정안전부·보건복지부 등)</span>
    <NuxtLink to="/about" class="text-primary hover:underline font-medium">자세히 보기</NuxtLink>
  </p>

  <!-- full — compact가 아니고 source도 null이면 의도적으로 아무것도 렌더하지 않는다 -->
  <section v-else-if="source" class="section-flat">
    <div class="flex items-center justify-between mb-4 md:mb-[22px]">
      <h2 class="ui-h2 text-strong">데이터 출처</h2>
    </div>
    <div class="flex flex-col gap-3">
      <div v-if="lastSyncDate" class="flex items-center justify-between">
        <span class="text-sm text-muted">최근 동기화</span>
        <span class="text-sm font-medium text-ink">{{ lastSyncDate }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted">제공기관</span>
        <span class="text-sm font-medium text-ink">{{ source.provider }}</span>
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-muted shrink-0">데이터셋</span>
        <a
          :href="source.url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm font-medium text-primary hover:underline text-right break-keep"
        >
          {{ source.datasetName }}
        </a>
      </div>
      <div class="mt-1 flex items-start gap-1.5 text-xs text-muted">
        <span class="material-symbols-outlined text-[14px] mt-px" aria-hidden="true">info</span>
        <span>
          공표된 원본 데이터 기준입니다<span v-if="source.kogl"> · 공공누리 제{{ source.kogl }}유형</span>
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolveDataSource, type DataSourceDomain } from '~/utils/dataSource'
import type { FacilityCategory } from '~/types/facility'

const props = withDefaults(defineProps<{
  domain: DataSourceDomain
  category?: FacilityCategory
  lastSyncDate?: string | null
  compact?: boolean
  variant?: 'flat'
}>(), {
  variant: 'flat',
})

const source = computed(() => resolveDataSource({ domain: props.domain, category: props.category }))
</script>
