<template>
  <NuxtLink
    :to="`/${facility.category}/${facility.id}`"
    :aria-label="`${facility.name} - ${CATEGORY_META[facility.category]?.label || facility.category}${facility.distance !== undefined ? `, ${formatDistance(facility.distance)} 거리` : ''} 상세보기`"
    :aria-current="isActive ? 'location' : undefined"
    :class="[
      'group bg-white rounded-xl p-4 shadow-subtle hover:shadow-lg transition-all duration-300 border cursor-pointer',
      isActive
        ? 'border-primary/20'
        : 'border-transparent hover:border-primary/20',
    ]"
  >
    <div class="flex items-start gap-4">
      <!-- Icon -->
      <div
        :class="[
          'shrink-0 w-12 h-12 rounded-full flex items-center justify-center',
          isActive
            ? 'bg-primary/10'
            : 'bg-slate-100',
        ]"
      >
        <CategoryIcon :category-id="facility.category" size="md" />
      </div>

      <!-- Details -->
      <div class="flex-1 min-w-0 flex flex-col justify-center h-full pt-0.5">
        <!-- Title and Distance -->
        <div class="flex justify-between items-start">
          <h3 class="text-slate-900 text-base font-bold truncate pr-2">
            {{ facility.name }}
          </h3>
          <span
            v-if="facility.distance !== undefined"
            :class="[
              'shrink-0 font-semibold text-sm',
              isCloseDistance()
                ? 'text-primary font-bold bg-primary/5 px-2 py-0.5 rounded-md'
                : 'text-slate-500',
            ]"
          >
            {{ formatDistance(facility.distance) }}
          </span>
        </div>

        <!-- Address -->
        <p class="text-slate-500 text-xs font-normal mt-1 truncate">
          {{ facility.address }}
        </p>

        <!-- Status and Features -->
        <div class="mt-2.5 flex items-center gap-3">
          <OperatingStatusBadge
            v-if="getOperatingStatus(facility)"
            :status="getOperatingStatus(facility)!"
          />
        </div>

        <!-- 카테고리별 추가 정보 뱃지 -->
        <div v-if="facility.extras && Object.keys(facility.extras).length > 0" class="flex flex-wrap gap-1.5 mt-2">
          <!-- toilet -->
          <span v-if="facility.extras.operatingHours === '24시간'" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700">24시간</span>
          <span v-if="facility.extras.hasDisabledToilet" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-violet-50 text-violet-700">장애인화장실</span>

          <!-- wifi -->
          <span v-if="facility.extras.ssid" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 max-w-[140px] truncate">{{ facility.extras.ssid }}</span>
          <span v-if="facility.extras.installLocation" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">{{ facility.extras.installLocation }}</span>

          <!-- parking -->
          <span v-if="facility.extras.feeType" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium" :class="facility.extras.feeType === '무료' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'">
            {{ facility.extras.feeType === '무료' ? '무료' : `${Number(facility.extras.baseFee || 0).toLocaleString()}원~` }}
          </span>
          <span v-if="facility.extras.capacity" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-sky-50 text-sky-700">{{ facility.extras.capacity }}면</span>

          <!-- kiosk -->
          <span v-if="facility.extras.weekdayOperatingHours" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-orange-50 text-orange-700">{{ facility.extras.weekdayOperatingHours }}</span>
          <span v-if="facility.extras.wheelchairAccessible" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-violet-50 text-violet-700">휠체어 접근</span>

          <!-- aed -->
          <span v-if="facility.extras.buildPlace" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-red-50 text-red-700 max-w-[160px] truncate">{{ facility.extras.buildPlace }}</span>
          <span v-if="facility.extras.org" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 max-w-[140px] truncate">{{ facility.extras.org }}</span>

          <!-- library -->
          <span v-if="facility.extras.weekdayOpenTime" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700">{{ facility.extras.weekdayOpenTime }}~{{ facility.extras.weekdayCloseTime }}</span>
          <span v-if="facility.extras.seatCount" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">{{ facility.extras.seatCount }}석</span>

          <!-- clothes -->
          <span v-if="facility.extras.detailLocation" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700 max-w-[180px] truncate">{{ facility.extras.detailLocation }}</span>

          <!-- hospital -->
          <span v-if="facility.extras.clCdNm" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-teal-50 text-teal-700">{{ facility.extras.clCdNm }}</span>
          <span v-if="facility.extras.phone" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">{{ facility.extras.phone }}</span>
          <span v-if="facility.extras.drTotCnt" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700">의사 {{ facility.extras.drTotCnt }}명</span>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { Facility } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'
import { formatDistance } from '~/utils/formatters'
import { getOperatingStatus } from '~/utils/facilityStatus'
import OperatingStatusBadge from './OperatingStatusBadge.vue'

interface Props {
  facility: Facility
  index?: number
  isActive?: boolean
  highlightDistance?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  index: undefined,
  isActive: false,
  highlightDistance: false,
})

const isCloseDistance = (): boolean => {
  if (props.highlightDistance) return true
  return props.facility.distance !== undefined && props.facility.distance <= 300
}
</script>
