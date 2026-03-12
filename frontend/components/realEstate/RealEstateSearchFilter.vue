<template>
  <div class="bg-white border border-gray-200 rounded-xl p-5">
    <div class="flex flex-col md:flex-row gap-3">
      <!-- 시/도 select -->
      <div class="flex-1">
        <label class="block text-xs font-medium text-gray-600 mb-1">시/도</label>
        <select
          v-model="filter.city"
          class="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          @change="onCityChange"
        >
          <option value="">전체</option>
          <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
        </select>
      </div>

      <!-- 구/군 select -->
      <div class="flex-1">
        <label class="block text-xs font-medium text-gray-600 mb-1">구/군</label>
        <select
          v-model="filter.district"
          :disabled="!filter.city"
          class="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
        >
          <option value="">전체</option>
          <option v-for="d in districts" :key="d" :value="d">
            {{ d }}
          </option>
        </select>
      </div>

      <!-- 건물명 입력 -->
      <div class="flex-1">
        <label class="block text-xs font-medium text-gray-600 mb-1">건물명</label>
        <input
          v-model="filter.buildingName"
          type="text"
          placeholder="건물명 입력"
          class="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          @keyup.enter="handleSearch"
        />
      </div>

      <!-- 버튼 -->
      <div class="flex items-end gap-2">
        <button
          class="px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          @click="handleSearch"
        >
          검색
        </button>
        <button
          class="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
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
