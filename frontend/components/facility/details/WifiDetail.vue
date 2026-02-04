<template>
  <div class="space-y-3">
    <DetailRow v-if="details.ssid" label="SSID" :value="details.ssid" />
    <DetailRow
      v-if="details.installDate"
      label="설치연월"
      :value="details.installDate"
    />
    <DetailRow
      v-if="details.serviceProvider"
      label="서비스 제공사"
      :value="details.serviceProvider"
    />
    <DetailRow
      v-if="details.installLocation"
      label="설치장소"
      :value="details.installLocation"
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
  </div>
</template>

<script setup lang="ts">
import type { WifiDetails } from '~/types/facility'

defineProps<{
  details: WifiDetails
}>()
</script>
