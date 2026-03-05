<template>
  <div class="space-y-4">
    <!-- 기본 정보 -->
    <div class="space-y-3">
      <DetailRow
        v-if="details.detailLocation"
        label="설치위치"
        :value="details.detailLocation"
      />
      <DetailRow
        v-if="details.providerName"
        label="운영기관"
        :value="details.providerName"
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

    <!-- 수거 가능/불가 품목 안내 -->
    <div class="bg-green-50 border border-green-200 rounded-lg p-4">
      <h4 class="font-semibold text-green-900 text-sm mb-2 flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[18px]">check_circle</span>
        수거 가능 품목
      </h4>
      <p class="text-sm text-green-800 leading-relaxed">
        깨끗하게 세탁된 의류, 가방, 신발, 모자, 벨트 등을 넣을 수 있습니다. 봉투에 담아 넣으면 비에 젖거나 오염되는 것을 방지할 수 있습니다.
      </p>
    </div>
    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
      <h4 class="font-semibold text-red-900 text-sm mb-2 flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[18px]">cancel</span>
        수거 불가 품목
      </h4>
      <p class="text-sm text-red-800 leading-relaxed">
        젖거나 오염된 옷, 속옷류, 이불, 베개, 쿠션, 카펫 등은 넣을 수 없습니다. 일반 쓰레기나 음식물을 넣으면 다른 의류까지 오염되어 재활용이 어려워집니다.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ClothesDetails } from '~/types/facility'

defineProps<{
  details: ClothesDetails
}>()
</script>
