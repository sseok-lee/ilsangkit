<template>
  <div>
    <div v-if="loading" data-testid="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
    </div>

    <div v-else-if="facilityGroups.length === 0" class="rounded-2xl bg-slate-50 p-8 text-center text-slate-500 text-sm">
      주변에 등록된 시설이 없습니다
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="group in facilityGroups"
        :key="group.category"
        class="rounded-2xl bg-white border border-slate-100 overflow-hidden"
      >
        <div class="flex items-center gap-2 px-4 py-3 border-b border-slate-50" :class="categoryBgClass(group.category)">
          <span class="text-lg">{{ group.icon }}</span>
          <h4 class="text-sm font-semibold text-slate-700">{{ group.label }}</h4>
          <span class="ml-auto text-[11px] text-slate-500 font-medium">{{ group.items.length }}곳</span>
        </div>
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
import { computed } from 'vue'
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

const CATEGORY_ICONS: Partial<Record<FacilityCategory, string>> = {
  school: '🏫',
  childcare: '🧒',
  park: '🌳',
  sports: '🏅',
  hospital: '🏥',
  pharmacy: '💊',
}

const DISPLAY_CATEGORIES: FacilityCategory[] = ['school', 'childcare', 'park', 'sports', 'hospital', 'pharmacy']
const MAX_PER_CATEGORY = 3

const { data: facilityResponse, status } = await useAsyncData(
  `nearby-facilities-${props.lat}-${props.lng}`,
  () => {
    if (!props.lat || !props.lng) return Promise.resolve(null)
    return $fetch('/api/facilities/search', {
      method: 'POST',
      body: { lat: props.lat, lng: props.lng, radius: 1000 },
    })
  },
)

const loading = computed(() => status.value === 'pending')

const facilityGroups = computed<FacilityGroup[]>(() => {
  if (!facilityResponse.value) return []
  const items: FacilityItem[] = (facilityResponse.value as any)?.data?.items ?? (facilityResponse.value as any)?.items ?? []

  return DISPLAY_CATEGORIES
    .filter((cat) => items.some((item) => item.category === cat))
    .map((cat) => ({
      category: cat,
      label: CATEGORY_META[cat]?.label ?? cat,
      icon: CATEGORY_ICONS[cat] ?? '📍',
      items: items.filter((item) => item.category === cat).slice(0, MAX_PER_CATEGORY),
    }))
})

function categoryBgClass(category: FacilityCategory): string {
  const map: Partial<Record<FacilityCategory, string>> = {
    school: 'bg-indigo-50/60',
    childcare: 'bg-pink-50/60',
    park: 'bg-green-50/60',
    sports: 'bg-cyan-50/60',
    hospital: 'bg-rose-50/60',
    pharmacy: 'bg-amber-50/60',
  }
  return map[category] ?? 'bg-slate-50/60'
}

function distanceBadgeClass(distance?: number): string {
  if (!distance || distance <= 100) return 'bg-emerald-50 text-emerald-600'
  if (distance <= 300) return 'bg-blue-50 text-blue-500'
  return 'bg-slate-100 text-slate-500'
}
</script>
