<template>
  <div class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display min-h-screen">
    <!-- Header -->
    <header class="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div class="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
        <button
          aria-label="이전 페이지로 돌아가기"
          class="shrink-0 flex items-center justify-center w-11 h-11 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          @click="goBack"
        >
          <span class="material-symbols-outlined text-slate-700 dark:text-slate-200 text-[24px]">arrow_back</span>
        </button>
        <h1 class="text-base font-bold truncate">
          {{ data ? `${data.city} ${data.district}` : '쓰레기 배출 정보' }}
        </h1>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
        <p class="text-slate-500 dark:text-slate-400 text-sm">정보 조회 중...</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="errorMsg" class="max-w-2xl mx-auto px-4 py-20 text-center">
      <div class="text-4xl mb-4">😔</div>
      <p class="text-slate-600 dark:text-slate-400 font-medium">{{ errorMsg }}</p>
      <button
        class="mt-4 text-primary hover:text-primary/80 font-medium text-sm"
        @click="goBack"
      >
        돌아가기
      </button>
    </div>

    <!-- Content -->
    <main v-else-if="data" class="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <!-- 지역 정보 -->
      <section class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[20px]">location_on</span>
          </div>
          <div>
            <h2 class="font-bold text-slate-900 dark:text-white">{{ data.city }} {{ data.district }}</h2>
            <p v-if="data.targetRegion" class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {{ data.targetRegion }}
              <span v-if="data.emissionPlace"> · {{ data.emissionPlace }}</span>
            </p>
            <p v-if="data.details?.emissionPlaceType" class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {{ data.details.emissionPlaceType }}
            </p>
          </div>
        </div>
      </section>

      <!-- 일반쓰레기 -->
      <WasteTypeSection
        v-if="data.details?.livingWaste"
        icon="delete"
        icon-color="amber"
        title="일반쓰레기"
        :info="data.details.livingWaste"
      />

      <!-- 음식물쓰레기 -->
      <WasteTypeSection
        v-if="data.details?.foodWaste"
        icon="restaurant"
        icon-color="green"
        title="음식물쓰레기"
        :info="data.details.foodWaste"
      />

      <!-- 재활용 -->
      <WasteTypeSection
        v-if="data.details?.recyclable"
        icon="recycling"
        icon-color="teal"
        title="재활용"
        :info="data.details.recyclable"
      />

      <!-- 대형폐기물 -->
      <section
        v-if="data.details?.bulkWaste"
        class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700"
      >
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <span class="material-symbols-outlined text-purple-600 dark:text-purple-400 text-[20px]">weekend</span>
          </div>
          <h3 class="font-bold text-slate-900 dark:text-white">대형폐기물</h3>
        </div>
        <div class="text-sm text-slate-600 dark:text-slate-300 space-y-2 pl-1">
          <div v-if="formatTimeRange(data.details.bulkWaste.beginTime, data.details.bulkWaste.endTime)" class="flex items-start gap-2">
            <span class="material-symbols-outlined text-[18px] text-slate-400 shrink-0 mt-0.5">schedule</span>
            <p>
              <span class="font-medium text-slate-700 dark:text-slate-200">배출 시간:</span>
              <span class="ml-1">{{ formatTimeRange(data.details.bulkWaste.beginTime, data.details.bulkWaste.endTime) }}</span>
            </p>
          </div>
          <div v-if="data.details.bulkWaste.method" class="flex items-start gap-2">
            <span class="material-symbols-outlined text-[18px] text-slate-400 shrink-0 mt-0.5">info</span>
            <p>
              <span class="font-medium text-slate-700 dark:text-slate-200">배출 방법:</span>
              <span class="ml-1">{{ data.details.bulkWaste.method }}</span>
            </p>
          </div>
          <div v-if="data.details.bulkWaste.place" class="flex items-start gap-2">
            <span class="material-symbols-outlined text-[18px] text-slate-400 shrink-0 mt-0.5">place</span>
            <p>
              <span class="font-medium text-slate-700 dark:text-slate-200">배출 장소:</span>
              <span class="ml-1">{{ data.details.bulkWaste.place }}</span>
            </p>
          </div>
        </div>
      </section>

      <!-- 미수거일 -->
      <section
        v-if="data.details?.uncollectedDay"
        class="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-100 dark:border-red-800"
      >
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-red-500 text-[20px]">warning</span>
          <span class="font-semibold text-red-900 dark:text-red-100 text-sm">미수거일</span>
        </div>
        <p class="text-red-700 dark:text-red-300 text-sm mt-1 pl-7">{{ data.details.uncollectedDay }}</p>
      </section>

      <!-- 관리부서 연락처 -->
      <section
        v-if="data.details?.manageDepartment || data.details?.managePhone"
        class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800"
      >
        <div class="flex items-center gap-2 mb-1">
          <span class="material-symbols-outlined text-blue-500 text-[18px]">support_agent</span>
          <span class="font-semibold text-blue-900 dark:text-blue-100 text-sm">{{ data.details.manageDepartment || '관리부서' }}</span>
        </div>
        <a
          v-if="data.details?.managePhone"
          :href="`tel:${data.details.managePhone}`"
          class="text-blue-600 dark:text-blue-400 text-sm hover:underline flex items-center gap-1 pl-7"
        >
          <span class="material-symbols-outlined text-[16px]">call</span>
          {{ data.details.managePhone }}
        </a>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWasteSchedule } from '~/composables/useWasteSchedule'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import WasteTypeSection from '~/components/trash/WasteTypeSection.vue'

const route = useRoute()
const router = useRouter()
const { getScheduleDetail } = useWasteSchedule()
const { setWasteScheduleDetailMeta } = useFacilityMeta()
const { setBreadcrumbSchema, setWasteScheduleSchema } = useStructuredData()

interface WasteTypeInfo {
  dayOfWeek?: string
  beginTime?: string
  endTime?: string
  method?: string
}

interface BulkWasteInfo {
  beginTime?: string
  endTime?: string
  method?: string
  place?: string
}

interface ScheduleDetail {
  id: number
  city: string
  district: string
  targetRegion: string | null
  emissionPlace: string | null
  details: {
    emissionPlaceType?: string
    managementZone?: string
    livingWaste?: WasteTypeInfo
    foodWaste?: WasteTypeInfo
    recyclable?: WasteTypeInfo
    bulkWaste?: BulkWasteInfo
    uncollectedDay?: string
    manageDepartment?: string
    managePhone?: string
    dataCreatedDate?: string
    lastModified?: string
  } | null
}

const loading = ref(true)
const errorMsg = ref<string | null>(null)
const data = ref<ScheduleDetail | null>(null)

function formatTimeRange(begin?: string, end?: string): string | null {
  if (!begin && !end) return null
  if (begin && end) return `${begin} ~ ${end}`
  return begin || end || null
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    navigateTo('/search?category=trash')
  }
}

onMounted(async () => {
  const id = parseInt(route.params.id as string, 10)
  if (isNaN(id)) {
    errorMsg.value = '잘못된 요청입니다'
    loading.value = false
    return
  }

  const result = await getScheduleDetail(id)
  if (!result) {
    errorMsg.value = '배출 정보를 찾을 수 없습니다'
  } else {
    data.value = result
  }
  loading.value = false
})

// 데이터 로드 후 메타태그 및 JSON-LD 설정
watch(data, (newData) => {
  if (newData) {
    setWasteScheduleDetailMeta(newData)
    setWasteScheduleSchema(newData)
    setBreadcrumbSchema([
      { name: '홈', url: '/' },
      { name: '쓰레기 배출', url: '/search?category=trash' },
      { name: `${newData.city} ${newData.district}`, url: `/trash/${newData.id}` },
    ])
  }
})
</script>
