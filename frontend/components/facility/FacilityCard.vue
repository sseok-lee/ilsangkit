<template>
  <NuxtLink
    :to="`/${facility.category}/${facility.id}`"
    :class="[
      'group bg-white dark:bg-slate-800 rounded-xl p-4 shadow-subtle hover:shadow-lg dark:shadow-none transition-all duration-300 border cursor-pointer',
      isActive
        ? 'border-primary/20 dark:border-primary/40'
        : 'border-transparent hover:border-primary/20 dark:hover:border-primary/40',
    ]"
  >
    <div class="flex items-start gap-4">
      <!-- Icon -->
      <div
        :class="[
          'shrink-0 w-12 h-12 rounded-full flex items-center justify-center',
          isActive
            ? 'bg-primary/10 dark:bg-primary/20'
            : 'bg-slate-100 dark:bg-slate-700',
        ]"
      >
        <CategoryIcon :category-id="facility.category" size="md" />
      </div>

      <!-- Details -->
      <div class="flex-1 min-w-0 flex flex-col justify-center h-full pt-0.5">
        <!-- Title and Distance -->
        <div class="flex justify-between items-start">
          <h3 class="text-slate-900 dark:text-white text-base font-bold truncate pr-2">
            {{ facility.name }}
          </h3>
          <span
            v-if="facility.distance !== undefined"
            :class="[
              'shrink-0 font-semibold text-sm',
              isCloseDistance()
                ? 'text-primary font-bold bg-primary/5 px-2 py-0.5 rounded-md'
                : 'text-slate-500 dark:text-slate-400',
            ]"
          >
            {{ formatDistance(facility.distance) }}
          </span>
        </div>

        <!-- Address -->
        <p class="text-slate-500 dark:text-slate-400 text-xs font-normal mt-1 truncate">
          {{ facility.address }}
        </p>

        <!-- Status and Features -->
        <div class="mt-2.5 flex items-center gap-3">
          <OperatingStatusBadge
            v-if="getOperatingStatus()"
            :status="getOperatingStatus()!"
          />
        </div>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { Facility } from '~/types/facility'
import OperatingStatusBadge from './OperatingStatusBadge.vue'

interface Props {
  facility: Facility
  index?: number
  isActive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  index: undefined,
  isActive: false,
})

const formatDistance = (distance: number): string => {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)}km`
  }
  return `${Math.round(distance)}m`
}

const isCloseDistance = (): boolean => {
  return props.facility.distance !== undefined && props.facility.distance <= 300
}

type OperatingStatus = 'open24h' | 'openNow' | 'closed' | 'limited' | null

const getOperatingStatus = (): OperatingStatus => {
  const details = props.facility.details
  if (!details) return null

  // Check for 24h operation (toilet, kiosk)
  if (details.operatingHours === '24시간' || details.is24Hour) {
    return 'open24h'
  }

  // Check for operating status in wifi
  if (details.operationStatus === '운영') {
    return 'openNow'
  }

  // Check for closed status
  if (details.operationStatus === '중지' || details.status === 'closed') {
    return 'closed'
  }

  // Check for time-limited operation
  if (details.operatingHours || details.weekdayOperatingHours) {
    return 'limited'
  }

  return null
}
</script>
