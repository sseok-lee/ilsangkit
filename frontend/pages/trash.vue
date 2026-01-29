<template>
  <div class="trash-page flex flex-col min-h-[calc(100vh-8rem)]">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 px-4 py-4">
      <h1 class="text-xl font-bold text-gray-900">내 지역 쓰레기 배출 일정</h1>
      <p class="text-sm text-gray-500 mt-1">지역을 선택하면 배출 일정을 확인할 수 있습니다</p>
    </div>

    <!-- Region Selector -->
    <div class="bg-white border-b border-gray-200 px-4 py-3">
      <TrashRegionSelector
        v-model:city="selectedCity"
        v-model:district="selectedDistrict"
        :cities="cities"
        :districts="districts"
        :loading="isLoadingRegions"
      />
    </div>

    <!-- Schedule Content -->
    <div class="flex-1 bg-gray-50 p-4">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-16">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!selectedCity || !selectedDistrict" class="flex flex-col items-center justify-center py-16 text-center">
        <div class="text-5xl mb-4">🗑️</div>
        <p class="text-gray-500">지역을 선택해주세요</p>
      </div>

      <!-- No Schedule -->
      <div v-else-if="schedules.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
        <div class="text-5xl mb-4">📭</div>
        <p class="text-gray-500">해당 지역의 배출 일정이 없습니다</p>
      </div>

      <!-- Schedule List -->
      <div v-else class="space-y-4">
        <TrashScheduleList :schedules="schedules" />

        <!-- Contact Info -->
        <div v-if="contactInfo" class="bg-white rounded-xl p-4 shadow-sm">
          <h3 class="text-sm font-medium text-gray-700 mb-2">관리기관 연락처</h3>
          <div class="flex items-center gap-3">
            <span class="text-2xl">📞</span>
            <div>
              <p class="font-medium text-gray-900">{{ contactInfo.name }}</p>
              <a
                v-if="contactInfo.phone"
                :href="`tel:${contactInfo.phone}`"
                class="text-primary-500 hover:text-primary-600"
              >
                {{ contactInfo.phone }}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  title: '쓰레기 배출 일정'
})

useHead({
  title: '쓰레기 배출 일정'
})

interface WasteSchedule {
  id: string
  wasteType: string
  dayOfWeek: string[]
  time?: string
  note?: string
}

interface ContactInfo {
  name: string
  phone?: string
}

const selectedCity = ref('')
const selectedDistrict = ref('')
const cities = ref<string[]>([])
const districts = ref<string[]>([])
const schedules = ref<WasteSchedule[]>([])
const contactInfo = ref<ContactInfo | null>(null)
const isLoading = ref(false)
const isLoadingRegions = ref(false)

const { getCities, getDistricts, getSchedules } = useWasteSchedule()

// Load cities on mount
onMounted(async () => {
  isLoadingRegions.value = true
  try {
    cities.value = await getCities()
  } finally {
    isLoadingRegions.value = false
  }
})

// Load districts when city changes
watch(selectedCity, async (newCity) => {
  selectedDistrict.value = ''
  districts.value = []
  schedules.value = []
  contactInfo.value = null

  if (newCity) {
    isLoadingRegions.value = true
    try {
      districts.value = await getDistricts(newCity)
    } finally {
      isLoadingRegions.value = false
    }
  }
})

// Load schedules when district changes
watch(selectedDistrict, async (newDistrict) => {
  schedules.value = []
  contactInfo.value = null

  if (selectedCity.value && newDistrict) {
    isLoading.value = true
    try {
      const result = await getSchedules(selectedCity.value, newDistrict)
      schedules.value = result.schedules
      contactInfo.value = result.contact || null
    } finally {
      isLoading.value = false
    }
  }
})
</script>
