<template>
  <!-- compact: 다중 카테고리 허브용 generic 안내 — domain/category와 무관하게 동일 문구 렌더 -->
  <div
    v-if="compact"
    class="bg-white rounded-xl shadow-sm border border-slate-200 px-[18px] py-3.5 flex items-center gap-2.5 text-sm text-slate-500"
  >
    <span class="material-symbols-outlined text-slate-500 text-[18px] shrink-0">description</span>
    <span>
      <span class="text-slate-700 font-semibold">데이터 출처:</span>
      공공데이터포털 (행정안전부·보건복지부 등)
    </span>
    <NuxtLink to="/about" class="text-primary hover:underline font-medium ml-auto whitespace-nowrap">
      자세히 보기 →
    </NuxtLink>
  </div>

  <!-- full card — compact가 아니고 source도 null이면 의도적으로 아무것도 렌더하지 않는다 -->
  <div v-else-if="source" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
      <span class="material-symbols-outlined text-slate-500 text-[20px]">description</span>
      <h2 class="text-slate-800 text-display-2">데이터 출처</h2>
    </div>
    <div class="p-5 flex flex-col gap-3">
      <div v-if="lastSyncDate" class="flex items-center justify-between">
        <span class="text-sm text-slate-500">최근 동기화</span>
        <span class="text-sm font-medium text-slate-800">{{ lastSyncDate }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-slate-500">제공기관</span>
        <span class="text-sm font-medium text-slate-800">{{ source.provider }}</span>
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-slate-500 shrink-0">데이터셋</span>
        <a
          :href="source.url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm font-medium text-primary hover:underline text-right break-keep"
        >
          {{ source.datasetName }}
        </a>
      </div>
      <div class="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
        <span class="material-symbols-outlined text-[14px] mt-px">info</span>
        <span>
          {{ source.datasetName }} 기준 정보입니다<span v-if="source.kogl"> · 공공누리 제{{ source.kogl }}유형</span>
        </span>
      </div>
      <p class="mt-3 text-xs text-slate-500">
        정보가 실제와 다른가요?
        <NuxtLink to="/contact#data-fix" class="font-semibold text-primary hover:underline">수정 요청 →</NuxtLink>
        확인 후 3~5일 내 반영
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolveDataSource, type DataSourceDomain } from '~/utils/dataSource'
import type { FacilityCategory } from '~/types/facility'

const props = defineProps<{
  domain: DataSourceDomain
  category?: FacilityCategory
  lastSyncDate?: string | null
  compact?: boolean
}>()

const source = computed(() => resolveDataSource({ domain: props.domain, category: props.category }))
</script>
