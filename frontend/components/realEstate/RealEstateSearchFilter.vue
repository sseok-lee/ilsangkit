<template>
  <div class="bg-white border border-line rounded-xl p-4 shadow-card">
    <div class="flex items-center gap-2 mb-3 md:hidden">
      <span class="material-symbols-outlined text-primary text-[20px]">location_city</span>
      <span class="font-bold text-strong text-sm">검색 조건</span>
    </div>
    <div class="flex flex-col md:flex-row gap-3">
      <!-- 시/도 select -->
      <div class="flex-1">
        <label class="block text-xs font-medium text-muted mb-1">시/도</label>
        <div class="relative">
          <select
            v-model="filter.city"
            class="w-full px-3 py-2.5 bg-surface-2 border border-line-2 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
          >
            <option value="">전체</option>
            <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
          </select>
          <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
        </div>
      </div>

      <!-- 구/군 select -->
      <div class="flex-1">
        <label class="block text-xs font-medium text-muted mb-1">구/군</label>
        <div class="relative">
          <select
            v-model="filter.district"
            :disabled="!filter.city"
            class="w-full px-3 py-2.5 bg-surface-2 border border-line-2 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">전체</option>
            <option v-for="d in districts" :key="d" :value="d">
              {{ d }}
            </option>
          </select>
          <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
        </div>
      </div>

      <!-- 건물명 입력 -->
      <div class="flex-1">
        <label class="block text-xs font-medium text-muted mb-1">건물명</label>
        <div class="relative">
          <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <span class="material-symbols-outlined text-slate-500 text-[18px]">search</span>
          </div>
          <input
            v-model="filter.buildingName"
            type="text"
            placeholder="건물명 입력"
            class="w-full pl-9 pr-3 py-2.5 bg-surface-2 border border-line-2 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            @keyup.enter="handleSearch"
          />
        </div>
      </div>

      <!-- 버튼 -->
      <div class="flex items-end gap-2">
        <button
          class="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
          @click="handleSearch"
        >
          검색
        </button>
        <button
          class="px-4 py-2.5 bg-surface-2 border border-line-2 text-muted rounded-lg text-sm font-medium hover:bg-background-light transition-colors"
          @click="handleReset"
        >
          초기화
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { REGIONS } from '~/shared/regionSlugs'

defineProps<{
  type?: string
}>()

const emit = defineEmits<{
  search: [params: { city: string; district: string; buildingName: string }]
}>()

const filter = reactive({
  city: '',
  district: '',
  buildingName: '',
})

const cities = Object.keys(REGIONS)
const districts = ref<string[]>([])

watch(
  () => filter.city,
  (city) => {
    filter.district = ''
    districts.value = city ? (REGIONS[city] || []) : []
  },
)

function handleSearch() {
  emit('search', { city: filter.city, district: filter.district, buildingName: filter.buildingName })
}

function handleReset() {
  filter.city = ''
  filter.district = ''
  filter.buildingName = ''
}
</script>
