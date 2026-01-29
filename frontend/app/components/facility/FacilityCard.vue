<template>
  <NuxtLink
    :to="`/facility/${facility.category}/${facility.id}`"
    class="block p-5 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-primary-400 transition-all duration-200"
  >
    <!-- Category Badge -->
    <div class="flex items-start justify-between gap-3 mb-3">
      <span
        :class="[
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
          getCategoryClasses(facility.category),
        ]"
      >
        <span>{{ getCategoryIcon(facility.category) }}</span>
        <span>{{ getCategoryLabel(facility.category) }}</span>
      </span>

      <!-- Distance Badge -->
      <span
        v-if="facility.distance !== undefined"
        class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
      >
        {{ formatDistance(facility.distance) }}
      </span>
    </div>

    <!-- Facility Name -->
    <h3 class="text-lg font-bold text-gray-900 mb-2 leading-snug">
      {{ facility.name }}
    </h3>

    <!-- Address -->
    <p class="text-sm text-gray-600 leading-relaxed">
      {{ facility.address }}
    </p>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { Facility, FacilityCategory } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'

interface Props {
  facility: Facility
}

defineProps<Props>()

const getCategoryLabel = (category: FacilityCategory): string => {
  return CATEGORY_META[category]?.label || category
}

const getCategoryIcon = (category: FacilityCategory): string => {
  return CATEGORY_META[category]?.icon || '📍'
}

const getCategoryClasses = (category: FacilityCategory): string => {
  const colorMap = {
    toilet: 'bg-blue-50 text-blue-700',
    wifi: 'bg-green-50 text-green-700',
    clothes: 'bg-purple-50 text-purple-700',
    kiosk: 'bg-orange-50 text-orange-700',
  }
  return colorMap[category] || 'bg-gray-50 text-gray-700'
}

const formatDistance = (distance: number): string => {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)}km`
  }
  return `${Math.round(distance)}m`
}
</script>
