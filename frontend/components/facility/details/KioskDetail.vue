<template>
  <div class="space-y-3">
    <DetailRow
      v-if="details.detailLocation"
      label="설치위치"
      :value="details.detailLocation"
    />
    <DetailRow
      v-if="details.operationAgency"
      label="운영기관"
      :value="details.operationAgency"
    />
    <DetailRow
      v-if="details.weekdayOperatingHours"
      label="평일 운영시간"
      :value="details.weekdayOperatingHours"
    />
    <DetailRow
      v-if="details.saturdayOperatingHours"
      label="토요일 운영시간"
      :value="details.saturdayOperatingHours"
    />
    <DetailRow
      v-if="details.holidayOperatingHours"
      label="공휴일 운영시간"
      :value="details.holidayOperatingHours"
    />

    <div v-if="availableDocumentsList.length > 0" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-medium text-gray-600 mb-2">발급 가능 서류</p>
      <ul class="list-disc list-inside space-y-0.5">
        <li
          v-for="doc in availableDocumentsList"
          :key="doc"
          class="text-sm text-gray-700"
        >
          {{ doc }}
        </li>
      </ul>
    </div>

    <div v-if="hasAccessibilityFeatures" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-medium text-gray-600 mb-2">장애인 편의시설</p>
      <div class="grid grid-cols-2 gap-2">
        <div v-if="details.blindKeypad" class="flex items-center gap-1.5 text-sm text-gray-700">
          <span class="text-green-600">✓</span>
          <span>점자키패드</span>
        </div>
        <div v-if="details.voiceGuide" class="flex items-center gap-1.5 text-sm text-gray-700">
          <span class="text-green-600">✓</span>
          <span>음성안내</span>
        </div>
        <div v-if="details.brailleOutput" class="flex items-center gap-1.5 text-sm text-gray-700">
          <span class="text-green-600">✓</span>
          <span>점자출력</span>
        </div>
        <div v-if="details.wheelchairAccessible" class="flex items-center gap-1.5 text-sm text-gray-700">
          <span class="text-green-600">✓</span>
          <span>휠체어 접근</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KioskDetails } from '~/types/facility'

const props = defineProps<{
  details: KioskDetails
}>()

const availableDocumentsList = computed(() => {
  if (!props.details.availableDocuments) return []
  if (Array.isArray(props.details.availableDocuments)) return props.details.availableDocuments.filter(Boolean)
  return []
})

const hasAccessibilityFeatures = computed(() => {
  return (
    props.details.blindKeypad ||
    props.details.voiceGuide ||
    props.details.brailleOutput ||
    props.details.wheelchairAccessible
  )
})
</script>
