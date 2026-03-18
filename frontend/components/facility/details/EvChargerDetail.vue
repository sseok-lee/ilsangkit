<template>
  <div class="space-y-3">
    <!-- 충전기 요약 뱃지 -->
    <div v-if="details.chargers?.length" class="flex items-center gap-2 flex-wrap">
      <span class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-slate-100 text-slate-800">
        총 {{ details.chargers.length }}대
      </span>
      <span v-if="rapidCount > 0" class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800">
        급속 {{ rapidCount }}대
      </span>
      <span v-if="slowCount > 0" class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-green-100 text-green-800">
        완속 {{ slowCount }}대
      </span>
    </div>

    <!-- 충전소 기본 정보 -->
    <DetailRow
      v-if="details.useTime"
      label="이용시간"
      :value="formatOperatingHours(details.useTime)"
    />
    <DetailRow
      v-if="details.busiNm"
      label="운영기관"
      :value="details.busiNm"
    />
    <DetailRow
      v-if="details.busiCall"
      label="운영기관 연락처"
      :value="details.busiCall"
      type="phone"
    />
    <DetailRow
      v-if="details.year"
      label="설치년도"
      :value="`${details.year}년`"
    />

    <!-- 주차/이용제한 정보 -->
    <div
      v-if="details.parkingFree != null || details.limitYn != null"
      class="pt-3 border-t border-gray-200"
    >
      <p class="text-xs font-medium text-gray-500 mb-2">이용 정보</p>
      <div class="flex flex-col gap-2">
        <div v-if="details.parkingFree != null" class="flex items-center gap-1.5 text-sm text-gray-700">
          <span :class="details.parkingFree === 'Y' ? 'text-green-600' : 'text-gray-400'">{{ details.parkingFree === 'Y' ? '✓' : '✗' }}</span>
          <span>{{ details.parkingFree === 'Y' ? '무료주차' : '유료주차' }}</span>
        </div>
        <div v-if="details.limitYn != null" class="flex items-center gap-1.5 text-sm text-gray-700">
          <span :class="details.limitYn === 'Y' ? 'text-red-500' : 'text-green-600'">{{ details.limitYn === 'Y' ? '✓' : '✗' }}</span>
          <span>이용제한 {{ details.limitYn === 'Y' ? '있음' : '없음' }}</span>
        </div>
        <p v-if="details.limitYn === 'Y' && details.limitDetail" class="text-sm text-gray-500 ml-5">{{ details.limitDetail }}</p>
      </div>
    </div>

    <!-- 위치 정보 -->
    <div v-if="details.addrDetail || details.location" class="pt-3 border-t border-gray-200">
      <p class="text-xs font-medium text-gray-500 mb-2">위치 정보</p>
      <div class="flex flex-col gap-1">
        <p v-if="details.addrDetail" class="text-sm text-gray-900">{{ details.addrDetail }}</p>
        <p v-if="details.location" class="text-sm text-gray-500">{{ details.location }}</p>
      </div>
    </div>

    <!-- 안내사항 -->
    <div v-if="details.note" class="pt-3 border-t border-gray-200">
      <p class="text-xs font-medium text-gray-500 mb-2">안내사항</p>
      <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ details.note }}</p>
    </div>

    <!-- 충전기 목록 -->
    <div v-if="details.chargers?.length" class="pt-3 border-t border-gray-200">
      <p class="text-xs font-medium text-gray-500 mb-3">충전기 현황</p>
      <div class="space-y-2">
        <div
          v-for="(charger, index) in details.chargers"
          :key="charger.chgerId || index"
          class="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
        >
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-mono text-slate-500">#{{ charger.chgerId || index + 1 }}</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              :class="getTypeBadgeClass(charger)"
            >
              {{ getTypeLabel(charger) }}
            </span>
            <span v-if="charger.output" class="text-xs text-slate-600">{{ charger.output }}kW</span>
            <span v-if="charger.method" class="text-xs text-slate-500">{{ charger.method }}</span>
          </div>
          <span
            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            :class="getStatBadgeClass(charger)"
          >
            {{ getStatLabel(charger) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EvChargerDetails, EvChargerItem } from '~/types/facility'
import { formatOperatingHours } from '~/utils/formatOperatingHours'

const props = defineProps<{
  details: EvChargerDetails
}>()

const rapidCount = computed(() =>
  props.details.chargers?.filter(c => parseFloat(c.output || '0') >= 50).length || 0
)
const slowCount = computed(() =>
  props.details.chargers?.filter(c => parseFloat(c.output || '0') < 50).length || 0
)

function getTypeLabel(charger: EvChargerItem): string {
  return parseFloat(charger.output || '0') >= 50 ? '급속' : '완속'
}

function getTypeBadgeClass(charger: EvChargerItem): string {
  return parseFloat(charger.output || '0') >= 50 ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
}

function getStatLabel(charger: EvChargerItem): string {
  const stat = charger.stat || ''
  if (stat === '2') return '충전대기'
  if (stat === '3') return '충전중'
  if (stat === '4') return '운영중지'
  if (stat === '1') return '통신이상'
  if (stat === '9') return '상태미확인'
  return '상태미확인'
}

function getStatBadgeClass(charger: EvChargerItem): string {
  const stat = charger.stat || ''
  if (stat === '2') return 'bg-green-100 text-green-800'
  if (stat === '3') return 'bg-yellow-100 text-yellow-800'
  if (stat === '4') return 'bg-red-100 text-red-800'
  return 'bg-gray-100 text-gray-800'
}
</script>
