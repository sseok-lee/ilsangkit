<template>
  <div class="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
    <!-- Category Filter -->
    <div>
      <h3 class="text-sm font-semibold text-gray-700 mb-3">카테고리</h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="cat in categories"
          :key="cat.value"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
            category === cat.value
              ? 'bg-primary-600 text-white ring-2 ring-primary-300'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100',
          ]"
          @click="handleCategoryChange(cat.value)"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>

    <!-- Sort Filter -->
    <div>
      <h3 class="text-sm font-semibold text-gray-700 mb-3">정렬</h3>
      <select
        :value="sort"
        class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        @change="handleSortChange"
      >
        <option value="distance">거리순</option>
        <option value="name">이름순</option>
      </select>
      <div data-testid="sort-indicator" class="sr-only">
        {{ sort === 'distance' ? '거리순' : '이름순' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FacilityCategory } from '~/types/facility'

interface Props {
  category: FacilityCategory | undefined
  sort: 'distance' | 'name'
}

interface Emits {
  (e: 'update:category', value: FacilityCategory | undefined): void
  (e: 'update:sort', value: 'distance' | 'name'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const categories = [
  { label: '전체', value: undefined },
  { label: '공공화장실', value: 'toilet' as FacilityCategory },
  { label: '무료와이파이', value: 'wifi' as FacilityCategory },
  { label: '의류수거함', value: 'clothes' as FacilityCategory },
  { label: '무인민원발급기', value: 'kiosk' as FacilityCategory },
  { label: '공영주차장', value: 'parking' as FacilityCategory },
  { label: '자동심장충격기', value: 'aed' as FacilityCategory },
  { label: '공공도서관', value: 'library' as FacilityCategory },
  { label: '쓰레기배출', value: 'trash' as FacilityCategory },
  { label: '병원', value: 'hospital' as FacilityCategory },
  { label: '약국', value: 'pharmacy' as FacilityCategory },
]

const handleCategoryChange = (value: FacilityCategory | undefined) => {
  emit('update:category', value)
}

const handleSortChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('update:sort', target.value as 'distance' | 'name')
}
</script>
