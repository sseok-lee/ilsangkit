<template>
  <div
    ref="sheetRef"
    class="facility-bottom-sheet absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-lg transition-transform duration-300 touch-none"
    :class="{ 'translate-y-0': isExpanded, 'translate-y-[calc(100%-8rem)]': !isExpanded }"
    :style="{ maxHeight: 'calc(100% - 4rem)' }"
  >
    <!-- Handle -->
    <div
      class="handle flex justify-center py-3 cursor-pointer"
      @click="isExpanded = !isExpanded"
    >
      <div class="w-10 h-1 bg-slate-300 rounded-full"></div>
    </div>

    <!-- Header -->
    <div class="px-4 pb-2 flex items-center justify-between">
      <h3 class="text-sm font-medium text-slate-700">
        주변 시설 <span class="text-primary-500">{{ facilities.length }}</span>곳
      </h3>
      <button
        v-if="isExpanded"
        type="button"
        aria-label="시설 목록 접기"
        class="text-sm text-slate-500 hover:text-slate-700 min-h-11 px-3 py-2"
        @click="isExpanded = false"
      >
        접기
      </button>
    </div>

    <!-- Content -->
    <div class="overflow-y-auto" :style="{ maxHeight: 'calc(100vh - 16rem)' }">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-8">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
      </div>

      <!-- Empty -->
      <div v-else-if="facilities.length === 0" class="text-center py-8 text-slate-500">
        <p>{{ emptyFiltered('시설') }}</p>
        <p class="text-sm mt-1">지도를 이동하거나 검색해보세요</p>
      </div>

      <!-- List -->
      <ul v-else class="divide-y divide-slate-100">
        <li
          v-for="facility in facilities"
          :key="facility.id"
          class="facility-item px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
          :class="{ 'bg-primary-50': selectedId === facility.id }"
          @click="$emit('select', facility)"
        >
          <div class="flex items-start gap-3">
            <span class="text-xl flex-shrink-0">{{ getCategoryIcon(category) }}</span>
            <div class="flex-1 min-w-0">
              <h4 class="font-medium text-slate-900 truncate">{{ facility.name }}</h4>
              <p class="text-sm text-slate-500 truncate mt-0.5">
                {{ facility.roadAddress || facility.address }}
              </p>
            </div>
            <div class="flex-shrink-0 text-right">
              <span
                v-if="facility.distance !== undefined"
                class="text-sm font-medium"
                :style="{ color: getCategoryColor(category) }"
              >
                {{ formatDistance(facility.distance) }}
              </span>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FacilitySearchItem, FacilityCategory } from '~/types'
import { getMarkerColor as getSharedCategoryColor } from '~/utils/categoryColors'
import { emptyFiltered } from '~/utils/uiMessages'

interface Props {
  facilities: FacilitySearchItem[]
  loading?: boolean
  selectedId?: string | null
  category: FacilityCategory
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  selectedId: null
})

defineEmits<{
  (e: 'select', facility: FacilitySearchItem): void
}>()

const sheetRef = ref<HTMLElement | null>(null)
const isExpanded = ref(false)

const categoryIcons: Record<string, string> = {
  toilet: '🚻',
  wifi: '📶',
  clothes: '👕',
  trash: '🗑️',
  parking: '🅿️',
  park: '🌳',
  school: '🏫',
  market: '🏪',
}

// Category colors — shared constant from utils/categoryColors.ts

function getCategoryIcon(category: string): string {
  return categoryIcons[category] || '📍'
}

function getCategoryColor(category: string): string {
  return getSharedCategoryColor(category)
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}

// Auto expand when facility is selected
watch(() => props.selectedId, (newId) => {
  if (newId) {
    isExpanded.value = true
  }
})
</script>

<style scoped>
.facility-bottom-sheet {
  z-index: 30;
}
</style>
