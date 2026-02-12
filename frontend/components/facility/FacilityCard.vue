<template>
  <NuxtLink
    :to="`/${facility.category}/${facility.id}`"
    :aria-label="`${facility.name} - ${CATEGORY_META[facility.category]?.label || facility.category} 상세보기`"
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
            v-if="getOperatingStatus(facility)"
            :status="getOperatingStatus(facility)!"
          />
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
}

const props = withDefaults(defineProps<Props>(), {
  index: undefined,
  isActive: false,
})

const isCloseDistance = (): boolean => {
  return props.facility.distance !== undefined && props.facility.distance <= 300
}
</script>
