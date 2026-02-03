<template>
  <div class="space-y-3">
    <DetailRow
      v-if="details.detailLocation"
      label="설치위치"
      :value="details.detailLocation"
    />
    <DetailRow
      v-if="details.managementAgency"
      label="관리기관"
      :value="details.managementAgency"
    />
    <DetailRow
      v-if="details.phoneNumber"
      label="연락처"
      :value="details.phoneNumber"
    />
    <DetailRow
      v-if="details.dataDate"
      label="데이터 기준일"
      :value="details.dataDate"
    />
  </div>
</template>

<script setup lang="ts">
import type { ClothesDetails } from '../../../../types/facility'

defineProps<{
  details: ClothesDetails
}>()
</script>
