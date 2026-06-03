<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1.5">지역</label>
      <div class="relative">
        <select
          :value="city"
          aria-label="시/도 선택"
          class="w-full bg-slate-50 border border-line rounded-lg py-2.5 px-3 text-slate-900 text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
          @change="onCityChange"
        >
          <option value="">전국</option>
          <option v-for="c in cityOptions" :key="c.slug" :value="c.value">{{ c.name }}</option>
        </select>
        <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
      </div>
    </div>
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1.5">구/군</label>
      <div class="relative">
        <select
          :value="district"
          :disabled="!city"
          aria-label="구/군 선택"
          class="w-full bg-slate-50 border border-line rounded-lg py-2.5 px-3 text-slate-900 text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          @change="onDistrictChange"
        >
          <option value="">전체</option>
          <option v-for="d in districtOptions" :key="d" :value="d">{{ d }}</option>
        </select>
        <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRegions } from '~/composables/useRegions'

const props = withDefaults(
  defineProps<{ city: string; district: string; cityValueMode?: 'short' | 'slug' }>(),
  { cityValueMode: 'short' },
)
const emit = defineEmits<{ 'update:city': [string]; 'update:district': [string] }>()

const { loadRegions, citiesWithDistricts, getDistrictsByCity } = useRegions()

onMounted(() => {
  void loadRegions()
})

const cityOptions = computed(() =>
  citiesWithDistricts.value.map((c) => ({
    slug: c.slug,
    name: c.name,
    value: props.cityValueMode === 'slug' ? c.slug : c.name,
  })),
)

const selectedSlug = computed(() => {
  if (!props.city) return ''
  const found = citiesWithDistricts.value.find(
    (c) => (props.cityValueMode === 'slug' ? c.slug : c.name) === props.city,
  )
  return found?.slug ?? ''
})

const districtOptions = computed(() =>
  selectedSlug.value ? getDistrictsByCity(selectedSlug.value).map((d) => d.name) : [],
)

function onCityChange(e: Event) {
  emit('update:city', (e.target as HTMLSelectElement).value)
  emit('update:district', '')
}
function onDistrictChange(e: Event) {
  emit('update:district', (e.target as HTMLSelectElement).value)
}
</script>
