<template>
  <section
    v-if="!loading && hasData"
    class="bg-white border border-line rounded-2xl shadow-card p-5"
    aria-label="쓰레기 수거 일정"
  >
    <header class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-primary text-[22px]" aria-hidden="true">recycling</span>
        <h2 class="text-base font-bold text-slate-900">{{ district }} 수거 일정</h2>
      </div>
      <NuxtLink to="/trash" class="text-xs text-primary font-bold hover:underline">전체 →</NuxtLink>
    </header>

    <ul class="divide-y divide-slate-100">
      <li
        v-for="item in items"
        :key="item.type"
        class="flex items-center gap-3 py-3"
      >
        <span class="material-symbols-outlined text-slate-500 text-[20px]" aria-hidden="true">{{ iconFor(item.type) }}</span>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-bold text-slate-900">{{ item.label }}</div>
          <div class="text-xs text-slate-500 truncate">{{ item.daysOfWeekLabel || '요일 정보 없음' }}<span v-if="item.beginTime"> · {{ item.beginTime }}~{{ item.endTime ?? '' }}</span></div>
        </div>
        <div v-if="item.dDay !== null" class="text-right shrink-0">
          <div :class="['text-xs font-extrabold', dDayClass(item.dDay)]">D-{{ item.dDay }}</div>
          <div class="text-[10px] text-slate-500">{{ item.nextDateLabel }}</div>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRegionStore } from '~/stores/region'
import { useRegions } from '~/composables/useRegions'

interface UpcomingItem {
  type: 'living' | 'food' | 'recyclable'
  label: string
  daysOfWeekLabel: string
  beginTime: string | null
  endTime: string | null
  dDay: number | null
  nextDateLabel: string | null
}

const regionStore = useRegionStore()
const { loadRegions, getCityName, getDistrictsByCity, isLoaded } = useRegions()
const config = useRuntimeConfig()

const cityName = ref<string | null>(null)
const districtName = ref<string | null>(null)

watch(
  () => [regionStore.citySlug, regionStore.districtSlug] as const,
  async ([cs, ds]) => {
    if (!cs || !ds) {
      cityName.value = null
      districtName.value = null
      return
    }
    if (!isLoaded.value) await loadRegions()
    cityName.value = getCityName(cs)
    const districts = getDistrictsByCity(cs)
    districtName.value = districts.find((d) => d.slug === ds)?.name ?? null
  },
  { immediate: true }
)

const enabled = computed(() => Boolean(cityName.value && districtName.value))

const { data, pending } = useAsyncData(
  () => `waste-upcoming-${cityName.value ?? ''}-${districtName.value ?? ''}`,
  () => {
    if (!enabled.value) return Promise.resolve(null)
    return $fetch<{ success: boolean; data: { hasData: boolean; items: UpcomingItem[] } }>(
      `${config.public.apiBase}/api/waste-schedules/upcoming`,
      { query: { city: cityName.value, district: districtName.value } }
    ).catch(() => null)
  },
  { watch: [cityName, districtName] }
)

const district = computed(() => districtName.value ?? '')
const loading = computed(() => pending.value)
const hasData = computed(() => enabled.value && Boolean(data.value?.data?.hasData))
const items = computed<UpcomingItem[]>(() => data.value?.data?.items ?? [])

function iconFor(type: UpcomingItem['type']): string {
  if (type === 'recyclable') return 'recycling'
  if (type === 'food') return 'restaurant'
  return 'delete'
}

function dDayClass(dDay: number): string {
  if (dDay === 0) return 'text-red-600'
  if (dDay === 1) return 'text-amber-600'
  return 'text-slate-700'
}
</script>
