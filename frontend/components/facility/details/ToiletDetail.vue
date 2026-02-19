<template>
  <div class="space-y-3">
    <DetailRow
      v-if="details.operatingHours"
      label="운영시간"
      :value="details.operatingHours"
    />
    <DetailRow
      v-if="details.openTime"
      label="개방시간"
      :value="details.openTime"
    />
    <DetailRow
      v-if="details.femaleToilets !== undefined && details.femaleToilets !== null"
      label="여성용 화장실"
      :value="`${details.femaleToilets}개`"
    />
    <DetailRow
      v-if="details.maleToilets !== undefined && details.maleToilets !== null"
      label="남성용 화장실"
      :value="`${details.maleToilets}개`"
    />
    <DetailRow
      v-if="details.maleUrinals !== undefined && details.maleUrinals !== null"
      label="남성용 소변기"
      :value="`${details.maleUrinals}개`"
    />
    <DetailRow
      v-if="details.hasDisabledToilet !== undefined"
      label="장애인 화장실"
      :value="details.hasDisabledToilet ? '있음' : '없음'"
    />
    <DetailRow
      v-if="details.managingOrg"
      label="관리기관"
      :value="details.managingOrg"
    />
    <DetailRow
      v-if="details.phoneNumber"
      label="연락처"
      :value="details.phoneNumber"
    />

    <div v-if="hasSafetyFeatures" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-medium text-gray-600 mb-2">안전/편의시설</p>
      <div class="grid grid-cols-2 gap-2">
        <div v-if="details.hasCCTV !== undefined" class="flex items-center gap-1.5 text-sm text-gray-700">
          <span :class="details.hasCCTV ? 'text-green-600' : 'text-gray-400'">{{ details.hasCCTV ? '✓' : '✗' }}</span>
          <span>CCTV</span>
        </div>
        <div v-if="details.hasEmergencyBell !== undefined" class="flex items-center gap-1.5 text-sm text-gray-700">
          <span :class="details.hasEmergencyBell ? 'text-green-600' : 'text-gray-400'">{{ details.hasEmergencyBell ? '✓' : '✗' }}</span>
          <span>비상벨</span>
        </div>
        <div v-if="details.hasDiaperChangingTable !== undefined" class="flex items-center gap-1.5 text-sm text-gray-700">
          <span :class="details.hasDiaperChangingTable ? 'text-green-600' : 'text-gray-400'">{{ details.hasDiaperChangingTable ? '✓' : '✗' }}</span>
          <span>기저귀교환대</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ToiletDetails } from '~/types/facility'

const props = defineProps<{
  details: ToiletDetails
}>()

const hasSafetyFeatures = computed(() => {
  return (
    props.details.hasCCTV !== undefined ||
    props.details.hasEmergencyBell !== undefined ||
    props.details.hasDiaperChangingTable !== undefined
  )
})
</script>
