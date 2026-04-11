<template>
  <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
      <span class="material-symbols-outlined text-slate-500 text-[20px]">description</span>
      <h2 class="text-slate-800 text-lg font-bold">데이터 정보</h2>
    </div>
    <div class="p-5 flex flex-col gap-3">
      <div v-if="dataDate" class="flex items-center justify-between">
        <span class="text-sm text-slate-500">데이터 기준일</span>
        <span class="text-sm font-medium text-slate-800">{{ dataDate }}</span>
      </div>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DataSourceInfo } from '~/utils/dataSource'

defineProps<{
  source: DataSourceInfo
  dataDate?: string | null
  lastSyncDate?: string | null
}>()
</script>
