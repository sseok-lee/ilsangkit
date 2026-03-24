<template>
  <div class="bg-background-light text-slate-900 font-display min-h-screen">
    <!-- Header -->
    <header class="sticky top-0 z-30 bg-background-light/95 backdrop-blur-md border-b border-slate-200">
      <div class="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
        <button
          aria-label="이전 페이지로 돌아가기"
          class="shrink-0 flex items-center justify-center w-11 h-11 rounded-full hover:bg-black/5 transition-colors"
          @click="goBack"
        >
          <span class="material-symbols-outlined text-slate-700 text-[24px]">arrow_back</span>
        </button>
        <h1 class="text-base font-bold truncate">
          {{ data ? `${data.city} ${data.district}` : '쓰레기 배출 정보' }}
        </h1>
      </div>
    </header>

    <!-- Breadcrumb -->
    <div v-if="data" class="max-w-2xl mx-auto px-4 pt-4">
      <Breadcrumb :items="breadcrumbItems" />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
        <p class="text-slate-500 text-sm">정보 조회 중...</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="errorMsg" class="max-w-2xl mx-auto px-4 py-20 text-center">
      <div class="text-4xl mb-4">😔</div>
      <p class="text-slate-600 font-medium">{{ errorMsg }}</p>
      <NuxtLink
        to="/search?category=trash"
        class="mt-4 inline-block text-primary hover:text-primary/80 font-medium text-sm"
      >
        쓰레기 배출 목록으로
      </NuxtLink>
    </div>

    <!-- Content -->
    <main v-else-if="data" class="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <!-- 지역 정보 -->
      <section class="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-blue-600 text-[20px]">location_on</span>
          </div>
          <div>
            <h2 class="font-bold text-slate-900">{{ data.city }} {{ data.district }}</h2>
            <div v-if="data.targetRegion" class="flex flex-wrap gap-1 mt-1.5">
              <span
                v-for="dong in data.targetRegion.split('+').map((d: string) => d.trim()).filter(Boolean)"
                :key="dong"
                class="inline-block px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full"
              >{{ dong }}</span>
              <span v-if="data.emissionPlace" class="inline-block px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded-full">{{ data.emissionPlace }}</span>
            </div>
            <p v-if="data.details?.emissionPlaceType" class="text-sm text-slate-500 mt-0.5">
              {{ data.details.emissionPlaceType }}
            </p>
            <p v-if="data.details?.managementZone" class="text-xs text-slate-500 mt-0.5">
              관리구역: {{ data.details.managementZone }}
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
        class="bg-white rounded-xl p-4 shadow-sm border border-slate-100"
      >
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <span class="material-symbols-outlined text-purple-600 text-[20px]">weekend</span>
          </div>
          <h3 class="font-bold text-slate-900">대형폐기물</h3>
        </div>
        <div class="text-sm text-slate-600 space-y-2 pl-1">
          <div v-if="formatTimeRange(data.details.bulkWaste.beginTime, data.details.bulkWaste.endTime)" class="flex items-start gap-2">
            <span class="material-symbols-outlined text-[18px] text-slate-500 shrink-0 mt-0.5">schedule</span>
            <p>
              <span class="font-medium text-slate-700">배출 시간:</span>
              <span class="ml-1">{{ formatTimeRange(data.details.bulkWaste.beginTime, data.details.bulkWaste.endTime) }}</span>
            </p>
          </div>
          <div v-if="data.details.bulkWaste.method" class="flex items-start gap-2">
            <span class="material-symbols-outlined text-[18px] text-slate-500 shrink-0 mt-0.5">info</span>
            <p>
              <span class="font-medium text-slate-700">배출 방법:</span>
              <span class="ml-1">{{ data.details.bulkWaste.method }}</span>
            </p>
          </div>
          <div v-if="data.details.bulkWaste.place" class="flex items-start gap-2">
            <span class="material-symbols-outlined text-[18px] text-slate-500 shrink-0 mt-0.5">place</span>
            <p>
              <span class="font-medium text-slate-700">배출 장소:</span>
              <span class="ml-1">{{ data.details.bulkWaste.place }}</span>
            </p>
          </div>
        </div>
      </section>

      <!-- 미수거일 -->
      <section
        v-if="data.details?.uncollectedDay"
        class="bg-red-50 rounded-xl p-4 border border-red-100"
      >
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-red-500 text-[20px]">warning</span>
          <span class="font-semibold text-red-900 text-sm">미수거일</span>
        </div>
        <p class="text-red-700 text-sm mt-1 pl-7">{{ data.details.uncollectedDay }}</p>
      </section>

      <!-- 관리부서 연락처 -->
      <section
        v-if="data.details?.manageDepartment || data.details?.managePhone"
        class="bg-blue-50 rounded-xl p-4 border border-blue-100"
      >
        <div class="flex items-center gap-2 mb-1">
          <span class="material-symbols-outlined text-blue-500 text-[18px]">support_agent</span>
          <span class="font-semibold text-blue-900 text-sm">{{ data.details.manageDepartment || '관리부서' }}</span>
        </div>
        <a
          v-if="data.details?.managePhone"
          :href="`tel:${data.details.managePhone}`"
          class="text-blue-600 text-sm hover:underline flex items-center gap-1 pl-7"
        >
          <span class="material-symbols-outlined text-[16px]">call</span>
          {{ data.details.managePhone }}
        </a>
      </section>

      <!-- 같은 지역 링크 -->
      <nav v-if="trashRegionLink" class="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div class="flex items-center gap-2 mb-3">
          <span class="material-symbols-outlined text-primary text-[20px]">explore</span>
          <h3 class="font-bold text-slate-900">같은 지역</h3>
        </div>
        <div class="flex flex-col gap-2">
          <NuxtLink
            :to="trashRegionLink.searchHref"
            class="flex items-center gap-2 text-primary hover:text-blue-600 text-sm font-medium transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
            {{ trashRegionLink.searchLabel }}
          </NuxtLink>
          <NuxtLink
            :to="trashRegionLink.regionHref"
            class="flex items-center gap-2 text-slate-600 hover:text-primary text-sm font-medium transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
            {{ trashRegionLink.regionLabel }}
          </NuxtLink>
        </div>
      </nav>

      <!-- 이용 팁 -->
      <section class="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div class="flex items-center gap-2 mb-3">
          <span class="material-symbols-outlined text-slate-500 text-[20px]">lightbulb</span>
          <h3 class="font-bold text-slate-900">쓰레기 배출 이용 팁</h3>
        </div>
        <ul class="space-y-2">
          <li v-for="(tip, i) in trashTips" :key="i" class="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
            <span class="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">check</span>
            {{ tip }}
          </li>
        </ul>
      </section>

      <!-- FAQ -->
      <section v-if="trashFaqItems.length > 0" class="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div class="flex items-center gap-2 mb-3">
          <span class="material-symbols-outlined text-slate-500 text-[20px]">help</span>
          <h3 class="font-bold text-slate-900">자주 묻는 질문</h3>
        </div>
        <div class="space-y-4">
          <div v-for="(faq, i) in trashFaqItems" :key="i">
            <h4 class="text-sm font-bold text-slate-900 mb-1">Q. {{ faq.question }}</h4>
            <p class="text-sm text-slate-600 leading-relaxed">{{ faq.answer }}</p>
          </div>
        </div>
      </section>

      <!-- 데이터 정보 -->
      <section class="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div class="flex items-center gap-2 mb-3">
          <span class="material-symbols-outlined text-slate-500 text-[20px]">description</span>
          <h3 class="font-bold text-slate-900">데이터 정보</h3>
        </div>
        <div class="space-y-2">
          <div v-if="data.details?.lastModified" class="flex items-center justify-between text-sm">
            <span class="text-slate-500">데이터 기준일</span>
            <span class="font-medium text-slate-900">{{ formatDataDate(data.details.lastModified) }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-slate-500">출처</span>
            <a href="https://www.data.go.kr/data/15155080/openapi.do" target="_blank" rel="noopener noreferrer" class="font-medium text-primary hover:underline">
              공공데이터포털
            </a>
          </div>
          <div class="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
            <span class="material-symbols-outlined text-[14px] mt-px">info</span>
            <span>공공데이터포털 기준 정보입니다</span>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CITY_NAME_TO_SLUG, generateSlug } from '~/composables/useRegions'
import WasteTypeSection from '~/components/trash/WasteTypeSection.vue'
import { CATEGORY_TIPS } from '~/utils/categoryDescriptions'
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'

const trashTips = CATEGORY_TIPS.trash
const trashFaqItems = CATEGORY_FAQ.trash.slice(0, 3)

const route = useRoute()
const router = useRouter()
const { setWasteScheduleDetailMeta } = useFacilityMeta()
const { setBreadcrumbSchema, setWasteScheduleSchema, setFAQSchema, setHowToSchema } = useStructuredData()

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

// SSR: useAsyncData로 서버에서 데이터 fetch
const scheduleId = computed(() => parseInt(route.params.id as string, 10))
const { data: scheduleResponse, status, error: fetchError } = await useAsyncData(
  `trash-${route.params.id}`,
  () => {
    if (isNaN(scheduleId.value)) {
      throw createError({ statusCode: 400, message: '잘못된 요청입니다' })
    }
    return $fetch<{ success: boolean; data: ScheduleDetail }>(
      `/api/waste-schedules/${scheduleId.value}`
    )
  }
)
// fetch 에러 처리: 실제 404만 hard 404, 네트워크/서버 에러는 soft error로 처리 (SEO 보호)
if (fetchError.value) {
  const errStatus = fetchError.value.statusCode
  if (errStatus === 404 || errStatus === 422) {
    throw createError({ statusCode: 404, statusMessage: '배출 정보를 찾을 수 없습니다' })
  }
  // 5xx/네트워크 에러는 페이지를 유지하여 Googlebot이 404로 인식하지 않도록 함
}

const data = computed(() => scheduleResponse.value?.data ?? null)
const loading = computed(() => status.value === 'pending')
const errorMsg = computed(() => {
  if (isNaN(scheduleId.value)) return '잘못된 요청입니다'
  return null
})

function formatTimeRange(begin?: string, end?: string): string | null {
  if (!begin && !end) return null
  if (begin && end) return `${begin} ~ ${end}`
  return begin || end || null
}

function formatDataDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  if (/^\d{8}/.test(raw)) return `${raw.substring(0, 4)}-${raw.substring(4, 6)}-${raw.substring(6, 8)}`
  const d = new Date(raw)
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return raw
}

function goBack() {
  if (import.meta.client && window.history.length > 1) {
    router.back()
  } else {
    navigateTo('/search?category=trash')
  }
}

// 브레드크럼 아이템
const breadcrumbItems = computed(() => {
  if (!data.value) return []
  return [
    { label: '홈', href: '/', current: false },
    { label: '쓰레기 배출', href: '/search?category=trash', current: false },
    { label: `${data.value.city} ${data.value.district}`, href: `/trash/${data.value.id}`, current: true },
  ]
})

// 같은 지역 링크
const trashRegionLink = computed(() => {
  if (!data.value) return null
  const city = data.value.city
  const shortCity = city.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
  const citySlug = CITY_NAME_TO_SLUG[city] || CITY_NAME_TO_SLUG[shortCity]
  if (!citySlug) return null
  const districtSlug = generateSlug(data.value.district)
  return {
    searchHref: `/search?category=trash&city=${encodeURIComponent(data.value.city)}&district=${encodeURIComponent(data.value.district)}`,
    searchLabel: `${data.value.city} ${data.value.district} 쓰레기 배출 전체보기`,
    regionHref: `/${citySlug}/${districtSlug}`,
    regionLabel: `${data.value.city} ${data.value.district} 전체 시설 보기`,
  }
})

// SSR에서 메타태그 및 JSON-LD 설정
watchEffect(() => {
  if (data.value) {
    setWasteScheduleDetailMeta(data.value)
    setWasteScheduleSchema(data.value)
    setBreadcrumbSchema([
      { name: '홈', url: '/' },
      { name: '쓰레기 배출', url: '/search?category=trash' },
      { name: `${data.value.city} ${data.value.district}`, url: `/trash/${data.value.id}` },
    ])
    // FAQPage 스키마 — Google FAQ rich result 노출용
    if (trashFaqItems.length > 0) {
      setFAQSchema(trashFaqItems)
    }
    // HowTo 스키마 — 쓰레기 배출 절차 안내
    setHowToSchema({
      name: `${data.value.city} ${data.value.district} 쓰레기 올바르게 배출하는 방법`,
      description: `${data.value.city} ${data.value.district} 지역 쓰레기 배출 절차 안내`,
      totalTime: 'PT10M',
      steps: [
        { name: '종량제 봉투 구매', text: '주민센터 또는 인근 편의점·마트에서 해당 지역 종량제 봉투를 구매하세요.' },
        { name: '분리배출', text: '재활용 가능한 품목(종이, 플라스틱, 유리, 금속)은 분리하여 전용 수거함에 배출하세요.' },
        { name: '배출 요일 확인', text: '지역별 배출 요일이 다르니 반드시 해당 페이지에서 배출 요일을 확인하세요.' },
        { name: '지정 장소 배출', text: '지정된 배출 장소에 배출 시간에 맞춰 쓰레기를 내놓으세요.' },
      ],
    })
  }
})
</script>
