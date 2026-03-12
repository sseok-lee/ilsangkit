<template>
  <div class="bg-white border border-gray-200 rounded-xl p-5">
    <h3 class="text-sm font-semibold text-gray-700 mb-4">주변 공공시설</h3>

    <!-- 로딩 스피너 -->
    <div v-if="loading" data-testid="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- 빈 상태 -->
    <div v-else-if="facilityGroups.length === 0" class="text-center py-8 text-gray-400 text-sm">
      주변에 등록된 시설이 없습니다
    </div>

    <!-- 카테고리별 시설 목록 -->
    <div v-else class="space-y-4">
      <div v-for="group in facilityGroups" :key="group.category">
        <h4 class="text-xs font-medium text-gray-500 mb-2">{{ group.label }}</h4>
        <ul class="space-y-2">
          <li
            v-for="facility in group.items"
            :key="facility.id"
            class="flex items-center gap-3 text-sm"
          >
            <span class="text-base">{{ group.icon }}</span>
            <span class="flex-1 text-gray-700 truncate">{{ facility.name }}</span>
            <span class="text-xs text-gray-400 shrink-0">{{ facility.distance }}m</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { CATEGORY_META } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'

interface FacilityItem {
  id: string
  name: string
  category: FacilityCategory
  address: string | null
  lat: number
  lng: number
  distance?: number
}

interface FacilityGroup {
  category: FacilityCategory
  label: string
  icon: string
  items: FacilityItem[]
}

interface Props {
  lat: number
  lng: number
}

const props = defineProps<Props>()

const loading = ref(true)
const facilityGroups = ref<FacilityGroup[]>([])

const CATEGORY_ICONS: Partial<Record<FacilityCategory, string>> = {
  toilet: '🚻',
  parking: '🅿️',
  pharmacy: '💊',
  aed: '❤️',
  wifi: '📶',
  hospital: '🏥',
  library: '📚',
  kiosk: '🖨️',
  clothes: '👕',
  trash: '🗑️',
}

const DISPLAY_CATEGORIES: FacilityCategory[] = ['toilet', 'parking', 'pharmacy', 'aed', 'wifi', 'hospital', 'library']
const MAX_PER_CATEGORY = 3

onMounted(async () => {
  try {
    const response = await ($fetch as any)('/api/facilities/search', {
      method: 'POST',
      body: {
        lat: props.lat,
        lng: props.lng,
        radius: 1000,
      },
    })

    const items: FacilityItem[] = response?.data?.items ?? response?.items ?? []

    // 카테고리별로 그룹화 (상위 3개씩)
    const grouped: FacilityGroup[] = []

    const usedCategories = DISPLAY_CATEGORIES.filter((cat) =>
      items.some((item) => item.category === cat)
    )

    // DISPLAY_CATEGORIES에 없는 카테고리도 포함
    const allCategories = Array.from(new Set([
      ...usedCategories,
      ...items.map((item) => item.category).filter((cat) => !DISPLAY_CATEGORIES.includes(cat)),
    ]))

    for (const cat of allCategories) {
      const catItems = items
        .filter((item) => item.category === cat)
        .slice(0, MAX_PER_CATEGORY)

      if (catItems.length > 0) {
        grouped.push({
          category: cat,
          label: CATEGORY_META[cat]?.label ?? cat,
          icon: CATEGORY_ICONS[cat] ?? '📍',
          items: catItems,
        })
      }
    }

    facilityGroups.value = grouped
  } catch {
    facilityGroups.value = []
  } finally {
    loading.value = false
  }
})
</script>
