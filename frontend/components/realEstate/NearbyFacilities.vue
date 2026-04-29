<template>
  <div>
    <!-- 로딩 스피너 -->
    <div v-if="loading" data-testid="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
    </div>

    <!-- 빈 상태 -->
    <div v-else-if="facilityGroups.length === 0" class="rounded-2xl bg-slate-50 p-8 text-center text-slate-500 text-sm">
      주변에 등록된 시설이 없습니다
    </div>

    <!-- 카테고리별 시설 카드 그리드 -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="group in facilityGroups"
        :key="group.category"
        class="rounded-2xl bg-white border border-slate-100 overflow-hidden"
      >
        <!-- 카테고리 헤더 -->
        <div class="flex items-center gap-2 px-4 py-3 border-b border-slate-50" :class="categoryBgClass(group.category)">
          <CategoryIcon :category-id="group.category" size="sm" />
          <h4 class="text-sm font-semibold text-slate-700">{{ group.label }}</h4>
          <span class="ml-auto text-[11px] text-slate-500 font-medium">{{ group.items.length }}곳</span>
        </div>
        <!-- 시설 목록 -->
        <ul class="divide-y divide-slate-50">
          <li v-for="facility in group.items" :key="facility.id">
            <NuxtLink
              :to="`/${facility.category}/${facility.id}`"
              class="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <span class="flex-1 text-sm text-slate-700 truncate">{{ facility.name }}</span>
              <span
                class="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full"
                :class="distanceBadgeClass(facility.distance)"
              >
                {{ facility.distance }}m
              </span>
              <span class="material-symbols-outlined text-[16px] text-slate-300">chevron_right</span>
            </NuxtLink>
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
import CategoryIcon from '~/components/common/CategoryIcon.vue'

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
  items: FacilityItem[]
}

interface Props {
  lat: number
  lng: number
}

const props = defineProps<Props>()

const loading = ref(true)
const facilityGroups = ref<FacilityGroup[]>([])

const DISPLAY_CATEGORIES: FacilityCategory[] = ['school', 'childcare', 'park', 'sports', 'hospital', 'pharmacy']
const MAX_PER_CATEGORY = 3

function categoryBgClass(category: FacilityCategory): string {
  const map: Partial<Record<FacilityCategory, string>> = {
    toilet: 'bg-blue-50/60',
    parking: 'bg-sky-50/60',
    pharmacy: 'bg-amber-50/60',
    aed: 'bg-red-50/60',
    wifi: 'bg-green-50/60',
    hospital: 'bg-rose-50/60',
    library: 'bg-orange-50/60',
    park: 'bg-green-50/60',
    school: 'bg-indigo-50/60',
    market: 'bg-orange-50/60',
    clothes: 'bg-purple-50/60',
    trash: 'bg-slate-50/60',
    childcare: 'bg-pink-50/60',
    'ev-charger': 'bg-teal-50/60',
    sports: 'bg-cyan-50/60',
  }
  return map[category] ?? 'bg-slate-50/60'
}

function distanceBadgeClass(distance?: number): string {
  if (!distance || distance <= 100) return 'bg-emerald-50 text-emerald-600'
  if (distance <= 300) return 'bg-blue-50 text-blue-500'
  return 'bg-slate-100 text-slate-500'
}

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

    // 부동산 상세 페이지에 표시할 6개 카테고리만 필터링
    const usedCategories = DISPLAY_CATEGORIES.filter((cat) =>
      items.some((item) => item.category === cat)
    )

    for (const cat of usedCategories) {
      const catItems = items
        .filter((item) => item.category === cat)
        .slice(0, MAX_PER_CATEGORY)

      if (catItems.length > 0) {
        grouped.push({
          category: cat,
          label: CATEGORY_META[cat]?.label ?? cat,
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
