<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1.5">지역</label>
      <div class="relative">
        <select
          v-model="cityModel"
          :class="{ 'min-h-11': preserveCurrentSelection }"
          aria-label="시/도 선택"
          class="w-full bg-slate-50 border border-line rounded-lg py-2.5 px-3 text-slate-900 text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
        >
          <option value="">전국</option>
          <option v-if="preserveCurrentSelection && city && !cityOptions.some(c => c.value === city)" :value="city">{{ city }}</option>
          <option v-for="c in cityOptions" :key="c.slug" :value="c.value">{{ c.name }}</option>
        </select>
        <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
      </div>
    </div>
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1.5">구/군</label>
      <div class="relative">
        <select
          v-model="districtModel"
          :disabled="!city"
          :class="{ 'min-h-11': preserveCurrentSelection }"
          aria-label="구/군 선택"
          class="w-full bg-slate-50 border border-line rounded-lg py-2.5 px-3 text-slate-900 text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">전체</option>
          <option v-if="preserveCurrentSelection && district && !districtOptions.includes(district)" :value="district">{{ district }}</option>
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
  defineProps<{ city: string; district: string; cityValueMode?: 'short' | 'slug'; preserveCurrentSelection?: boolean }>(),
  { cityValueMode: 'short', preserveCurrentSelection: false },
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

const cityModel = computed({
  get: () => props.city,
  set: (value: string) => {
    emit('update:city', value)
    emit('update:district', '')
  },
})

const districtModel = computed({
  get: () => props.district,
  set: (value: string) => {
    emit('update:district', value)
  },
})
</script>
