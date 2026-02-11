<template>
  <div class="space-y-3">
    <DetailRow
      v-if="details.parkingType"
      label="주차구분"
      :value="details.parkingType"
    />
    <DetailRow
      v-if="details.lotType"
      label="주차장유형"
      :value="details.lotType"
    />
    <DetailRow
      v-if="details.capacity"
      label="주차면수"
      :value="`${details.capacity}면`"
    />
    <DetailRow
      v-if="details.operatingHours"
      label="운영시간"
      :value="details.operatingHours"
    />
    <DetailRow
      v-if="details.phone"
      label="전화번호"
      :value="details.phone"
    />
    <DetailRow
      v-if="details.paymentMethod"
      label="결제방법"
      :value="details.paymentMethod"
    />
    <DetailRow
      v-if="details.hasDisabledParking"
      label="장애인전용주차"
      value="보유"
    />

    <div v-if="hasFeeInfo" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-medium text-gray-600 mb-2">요금 정보</p>
      <div class="space-y-1.5">
        <div v-if="details.baseFee != null" class="flex justify-between text-sm">
          <span class="text-gray-500">기본요금</span>
          <span class="text-gray-900">{{ formatFee(details.baseFee) }}{{ details.baseTime ? ` / ${details.baseTime}분` : '' }}</span>
        </div>
        <div v-if="details.additionalFee != null" class="flex justify-between text-sm">
          <span class="text-gray-500">추가요금</span>
          <span class="text-gray-900">{{ formatFee(details.additionalFee) }}{{ details.additionalTime ? ` / ${details.additionalTime}분` : '' }}</span>
        </div>
        <div v-if="details.dailyMaxFee != null" class="flex justify-between text-sm">
          <span class="text-gray-500">일최대요금</span>
          <span class="text-gray-900">{{ formatFee(details.dailyMaxFee) }}</span>
        </div>
        <div v-if="details.monthlyFee != null" class="flex justify-between text-sm">
          <span class="text-gray-500">월정기권</span>
          <span class="text-gray-900">{{ formatFee(details.monthlyFee) }}</span>
        </div>
      </div>
    </div>

    <div v-if="details.remarks" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-medium text-gray-600 mb-1">특기사항</p>
      <p class="text-sm text-gray-700">{{ details.remarks }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ParkingDetails } from '~/types/facility'

const props = defineProps<{
  details: ParkingDetails
}>()

const hasFeeInfo = computed(() => {
  return (
    props.details.baseFee != null ||
    props.details.additionalFee != null ||
    props.details.dailyMaxFee != null ||
    props.details.monthlyFee != null
  )
})

function formatFee(fee: number): string {
  if (fee === 0) return '무료'
  return `${fee.toLocaleString('ko-KR')}원`
}
</script>
