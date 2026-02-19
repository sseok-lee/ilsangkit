<template>
  <div class="space-y-3">
    <DetailRow
      v-if="details.clCdNm"
      label="종별"
      :value="details.clCdNm"
    />
    <DetailRow
      v-if="details.phone"
      label="전화번호"
      :value="details.phone"
    />
    <DetailRow
      v-if="details.estbDd"
      label="개설일자"
      :value="details.estbDd"
    />

    <div v-if="details.homepage" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-medium text-gray-600 mb-1">홈페이지</p>
      <a
        :href="details.homepage"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-blue-600 hover:underline break-all"
      >
        {{ details.homepage }}
      </a>
    </div>

    <div v-if="details.drTotCnt" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-medium text-gray-600 mb-2">의료진 현황</p>
      <div class="space-y-1">
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-600">의사 총수</span>
          <span class="text-gray-700 font-medium">{{ details.drTotCnt }}명</span>
        </div>
        <div v-if="details.mdeptSdrCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">의과 전문의</span>
          <span class="text-gray-700">{{ details.mdeptSdrCnt }}명</span>
        </div>
        <div v-if="details.mdeptGdrCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">의과 일반의</span>
          <span class="text-gray-700">{{ details.mdeptGdrCnt }}명</span>
        </div>
        <div v-if="details.detySdrCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">치과 전문의</span>
          <span class="text-gray-700">{{ details.detySdrCnt }}명</span>
        </div>
        <div v-if="details.detyGdrCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">치과 일반의</span>
          <span class="text-gray-700">{{ details.detyGdrCnt }}명</span>
        </div>
        <div v-if="details.cmdcSdrCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">한방 전문의</span>
          <span class="text-gray-700">{{ details.cmdcSdrCnt }}명</span>
        </div>
        <div v-if="details.cmdcGdrCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">한방 일반의</span>
          <span class="text-gray-700">{{ details.cmdcGdrCnt }}명</span>
        </div>
        <div v-if="details.pnursCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">간호사</span>
          <span class="text-gray-700">{{ details.pnursCnt }}명</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HospitalDetails } from '~/types/facility'

defineProps<{
  details: HospitalDetails
}>()
</script>
