<template>
  <div class="space-y-3">
    <!-- 유형 + 운영상태 뱃지 -->
    <div class="flex items-center gap-2 flex-wrap">
      <span
        v-if="details.crtypename"
        class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
        :class="childcareTypeBadgeClass"
      >
        {{ details.crtypename }}
      </span>
      <span
        v-if="details.crstatusname"
        class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
        :class="childcareStatusBadgeClass"
      >
        {{ details.crstatusname }}
      </span>
    </div>

    <!-- 휴지 기간 -->
    <div v-if="details.crpausebegindt && details.crpauseenddt" class="text-sm text-gray-600">
      휴지 기간: {{ details.crpausebegindt }} ~ {{ details.crpauseenddt }}
    </div>

    <!-- 정원·현원 -->
    <div v-if="details.crcapat != null && details.crchcnt != null" class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600">정원</span>
        <span class="text-sm font-medium text-gray-900">{{ details.crcapat }}명</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600">현원</span>
        <span class="text-sm font-medium text-gray-900">{{ details.crchcnt }}명</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600">가용률</span>
        <span class="text-sm font-medium text-gray-900">{{ availabilityRate }}</span>
      </div>
    </div>

    <DetailRow
      v-if="details.crcnfmdt"
      label="인가일"
      :value="details.crcnfmdt"
    />
    <DetailRow
      v-if="details.crtelno"
      label="연락처"
      :value="details.crtelno"
      type="phone"
    />
    <DetailRow
      v-if="details.chcrtescnt != null"
      label="교직원 수"
      :value="`${details.chcrtescnt}명`"
    />

    <!-- 시설 정보 -->
    <div v-if="hasFacilityInfo" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-bold text-gray-900 mb-2">시설 정보</p>
      <div class="flex flex-col gap-2">
        <div v-if="details.nrtrroomcnt != null" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">보육실</span>
          <span class="text-sm font-medium text-gray-900">{{ details.nrtrroomcnt }}개</span>
        </div>
        <div v-if="details.nrtrroomsize" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">보육실면적</span>
          <span class="text-sm font-medium text-gray-900">{{ details.nrtrroomsize }}</span>
        </div>
        <div v-if="details.plgrdco != null" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">놀이터</span>
          <span class="text-sm font-medium text-gray-900">{{ details.plgrdco }}개</span>
        </div>
        <div v-if="details.cctvinstlcnt != null" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">CCTV</span>
          <span class="text-sm font-medium text-gray-900">{{ details.cctvinstlcnt }}대</span>
        </div>
      </div>
    </div>

    <!-- 통학차량 -->
    <div v-if="details.crcargbname" class="flex items-center justify-between">
      <span class="text-sm text-gray-600">통학차량</span>
      <span class="text-sm font-medium text-gray-900">{{ details.crcargbname }}</span>
    </div>

    <!-- 홈페이지 -->
    <div v-if="details.crhome" class="flex flex-col sm:flex-row py-2 border-b border-gray-100 last:border-0 gap-0.5 sm:gap-4">
      <dt class="text-sm font-medium text-gray-600 min-w-[7rem] shrink-0">홈페이지</dt>
      <dd class="text-sm text-gray-900">
        <a
          :href="details.crhome"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary font-medium underline"
        >
          {{ details.crhome }}
        </a>
      </dd>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChildcareDetails } from '~/types/facility'

const props = defineProps<{
  details: ChildcareDetails
}>()

const childcareTypeBadgeClass = computed(() => {
  const type = props.details.crtypename || ''
  if (type.includes('국공립')) return 'bg-blue-100 text-blue-800'
  if (type.includes('민간')) return 'bg-orange-100 text-orange-800'
  if (type.includes('가정')) return 'bg-green-100 text-green-800'
  if (type.includes('직장')) return 'bg-purple-100 text-purple-800'
  if (type.includes('협동')) return 'bg-teal-100 text-teal-800'
  return 'bg-gray-100 text-gray-800'
})

const childcareStatusBadgeClass = computed(() => {
  const status = props.details.crstatusname || ''
  if (status.includes('운영')) return 'bg-green-100 text-green-800'
  if (status.includes('휴지')) return 'bg-yellow-100 text-yellow-800'
  if (status.includes('폐지')) return 'bg-red-100 text-red-800'
  return 'bg-gray-100 text-gray-800'
})

const availabilityRate = computed(() => {
  const cap = props.details.crcapat
  const cur = props.details.crchcnt
  if (cap == null || cur == null || cap === 0) return '-'
  return `${((cap - cur) / cap * 100).toFixed(0)}%`
})

const hasFacilityInfo = computed(() => {
  const d = props.details
  return d.nrtrroomcnt != null || d.nrtrroomsize != null || d.plgrdco != null || d.cctvinstlcnt != null
})
</script>
