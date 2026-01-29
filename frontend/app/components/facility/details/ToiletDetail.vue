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
  </div>
</template>

<script setup lang="ts">
import type { ToiletDetails } from '../../../../types/facility'

defineProps<{
  details: ToiletDetails
}>()
</script>
