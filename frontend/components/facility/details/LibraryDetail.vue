<template>
  <div class="space-y-3">
    <DetailRow
      v-if="details.libraryType"
      label="도서관 유형"
      :value="details.libraryType"
    />
    <DetailRow
      v-if="details.operatingOrg"
      label="운영기관"
      :value="details.operatingOrg"
    />
    <DetailRow
      v-if="details.phoneNumber"
      label="전화번호"
      :value="details.phoneNumber"
    />
    <DetailRow
      v-if="details.closedDays"
      label="휴관일"
      :value="details.closedDays"
    />
    <DetailRow
      v-if="details.seatCount"
      label="좌석수"
      :value="`${details.seatCount}석`"
    />
    <DetailRow
      v-if="details.bookCount"
      label="장서수"
      :value="`${details.bookCount.toLocaleString()}권`"
    />
    <DetailRow
      v-if="details.serialCount"
      label="연속간행물"
      :value="`${details.serialCount.toLocaleString()}종`"
    />
    <DetailRow
      v-if="details.nonBookCount"
      label="비도서 자료"
      :value="`${details.nonBookCount.toLocaleString()}점`"
    />
    <DetailRow
      v-if="details.loanableBooks"
      label="대출가능 권수"
      :value="`${details.loanableBooks}권`"
    />
    <DetailRow
      v-if="details.loanableDays"
      label="대출가능 일수"
      :value="`${details.loanableDays}일`"
    />

    <div v-if="operatingHours.length > 0" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-medium text-gray-600 mb-2">운영시간</p>
      <div class="space-y-1">
        <div
          v-for="item in operatingHours"
          :key="item.day"
          class="flex items-center justify-between text-sm"
        >
          <span class="text-gray-600 w-16">{{ item.day }}</span>
          <span class="text-gray-700">{{ item.time }}</span>
        </div>
      </div>
    </div>

    <div v-if="details.homepageUrl" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-medium text-gray-600 mb-1">홈페이지</p>
      <a
        :href="details.homepageUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-blue-600 hover:underline break-all"
      >
        {{ details.homepageUrl }}
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LibraryDetails } from '~/types/facility'

const props = defineProps<{
  details: LibraryDetails
}>()

const operatingHours = computed(() => {
  const entries = [
    { day: '평일', open: props.details.weekdayOpenTime, close: props.details.weekdayCloseTime },
    { day: '토요일', open: props.details.saturdayOpenTime, close: props.details.saturdayCloseTime },
    { day: '공휴일', open: props.details.holidayOpenTime, close: props.details.holidayCloseTime },
  ]

  return entries
    .filter((e) => e.open && e.close)
    .map((e) => ({ day: e.day, time: `${e.open}~${e.close}` }))
})
</script>
