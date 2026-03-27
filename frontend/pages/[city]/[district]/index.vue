<template>
  <div class="bg-background-light min-h-screen">
    <main class="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <!-- 브레드크럼 -->
      <nav class="flex items-center gap-1 text-sm text-slate-500 mb-6">
        <NuxtLink to="/" class="hover:text-primary">홈</NuxtLink>
        <span class="material-symbols-outlined text-[14px]">chevron_right</span>
        <NuxtLink :to="`/${city}`" class="hover:text-primary">{{ cityName }}</NuxtLink>
        <span class="material-symbols-outlined text-[14px]">chevron_right</span>
        <span class="text-slate-800">{{ districtName }}</span>
      </nav>

      <!-- 히어로 -->
      <div class="mb-8">
        <div class="mb-2">
          <h1 class="text-2xl md:text-3xl font-bold text-slate-900">
            {{ districtName }} 생활 정보
          </h1>
        </div>
        <p class="mt-2 text-slate-500 text-sm">{{ cityName }} {{ districtName }}의 부동산 시세와 생활시설을 한눈에 확인하세요</p>
        <p v-if="areaDescription" class="text-gray-600 text-sm leading-relaxed mt-4">{{ areaDescription }}</p>
      </div>

      <!-- 로딩 -->
      <div v-if="pending" class="flex justify-center py-20">
        <div class="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>

      <!-- 콘텐츠 -->
      <div v-else-if="areaData">
        <!-- ① 부동산 시세 현황 -->
        <section v-if="areaData.realEstate" id="real-estate" class="mb-10">
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span class="material-symbols-outlined text-primary text-[22px]">apartment</span>
            부동산 시세 현황
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NuxtLink
              v-for="item in realEstateCards"
              :key="item.type"
              :to="`/real-estate/${item.type}`"
              class="group bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div class="flex items-center gap-2 mb-4">
                <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <img :src="`/icons/category/${item.type}.webp?v2`" :alt="item.label" class="w-7 h-7" width="28" height="28" />
                </div>
                <h3 class="font-bold text-slate-900">{{ item.label }}</h3>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-slate-100">
                <span class="text-sm text-slate-500">매매 평균</span>
                <span class="text-sm font-semibold text-slate-800">{{ item.saleAvg }}</span>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-slate-100">
                <span class="text-sm text-slate-500">매매 거래</span>
                <span class="text-sm text-slate-600">{{ item.saleCount }}건</span>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-slate-100">
                <span class="text-sm text-slate-500">전월세 평균 보증금</span>
                <span class="text-sm font-semibold text-slate-800">{{ item.rentAvg }}</span>
              </div>
              <div class="flex items-center justify-between py-2">
                <span class="text-sm text-slate-500">전월세 거래</span>
                <span class="text-sm text-slate-600">{{ item.rentCount }}건</span>
              </div>
            </NuxtLink>
          </div>
        </section>

        <!-- ② 생활시설 현황 -->
        <section v-if="areaData.facilities" id="facilities" class="mb-10">
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span class="material-symbols-outlined text-primary text-[22px]">location_city</span>
            생활시설 현황
          </h2>
          <p class="text-sm text-slate-500 mb-4">총 {{ areaData.facilities.total.toLocaleString() }}개 시설</p>
          <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
            <NuxtLink
              v-for="(count, cat) in sortedFacilityCategories"
              :key="cat"
              :to="`/${city}/${district}/${cat}`"
              :class="[
                'group flex flex-col items-center p-4 rounded-2xl border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
                areaData.facilities.topCategories?.includes(String(cat))
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-slate-200 bg-white hover:bg-slate-50',
              ]"
            >
              <img :src="`/icons/category/${cat}.webp?v2`" :alt="CATEGORY_META[cat as FacilityCategory]?.label" class="w-8 h-8 mb-2" width="32" height="32" loading="lazy" />
              <span class="text-xs text-slate-600 mb-1">{{ CATEGORY_META[cat as FacilityCategory]?.label }}</span>
              <span class="text-sm font-bold text-slate-800">{{ count }}개</span>
            </NuxtLink>
          </div>
        </section>

        <!-- ③ 교차 CTA -->
        <section class="bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl p-6 md:p-8 text-center">
          <h3 class="text-base md:text-lg font-bold text-slate-800 mb-2">
            {{ districtName }} 부동산 실거래가 상세 보기
          </h3>
          <p class="text-sm text-slate-600 mb-4">아파트, 빌라, 오피스텔 실거래가를 확인해보세요</p>
          <div class="flex justify-center gap-3">
            <NuxtLink
              to="/real-estate/apt"
              class="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-colors"
            >
              아파트
            </NuxtLink>
            <NuxtLink
              to="/real-estate/villa"
              class="px-4 py-2 bg-white text-primary text-sm font-semibold rounded-xl border border-primary hover:bg-primary/5 transition-colors"
            >
              빌라
            </NuxtLink>
            <NuxtLink
              to="/real-estate/offitel"
              class="px-4 py-2 bg-white text-primary text-sm font-semibold rounded-xl border border-primary hover:bg-primary/5 transition-colors"
            >
              오피스텔
            </NuxtLink>
          </div>
        </section>
      </div>

      <!-- 에러 -->
      <div v-else class="py-20 text-center text-slate-500">
        데이터를 불러올 수 없습니다.
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRegions, CITY_SLUG_MAP } from '~/composables/useRegions'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { generateAreaDescription } from '~/utils/seoHelpers'

const route = useRoute()
const city = computed(() => route.params.city as string)
const district = computed(() => route.params.district as string)

// city slug 유효성 검사
if (!CITY_SLUG_MAP[city.value]) {
  throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없습니다' })
}

// 지역 이름 해석
const { loadRegions, syncFromHydration, getCityName, getDistrictName, getDistrictsByCity } = useRegions()

const { data: regionsData } = await useAsyncData(
  `hub-regions-${city.value}`,
  () => loadRegions()
)
syncFromHydration(regionsData)

// district slug 유효성 검사
const validDistricts = getDistrictsByCity(city.value)
if (validDistricts.length === 0 || !validDistricts.some(d => d.slug === district.value)) {
  throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없습니다' })
}

const cityName = computed(() => getCityName(city.value))
const districtName = computed(() => getDistrictName(city.value, district.value))

// Area API 단일 호출
const { data: response, pending } = await useAsyncData(
  `area-${city.value}-${district.value}`,
  () => $fetch<any>(`/api/area/${encodeURIComponent(city.value)}/${encodeURIComponent(district.value)}`)
    .catch(() => null)
)

const areaData = computed(() => response.value?.data ?? null)

// 시설 카테고리 정렬 (개수 내림차순)
const sortedFacilityCategories = computed(() => {
  if (!areaData.value?.facilities?.categories) return {}
  const cats = areaData.value.facilities.categories as Record<string, number>
  return Object.fromEntries(
    Object.entries(cats)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
  )
})

// 금액 포맷
function formatPrice(amount: number | null): string {
  if (!amount || amount === 0) return '데이터 없음'
  if (amount >= 10000) {
    const eok = Math.floor(amount / 10000)
    const remainder = amount % 10000
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만원` : `${eok}억`
  }
  return `${amount.toLocaleString()}만원`
}

const realEstateCards = computed(() => {
  const re = areaData.value?.realEstate
  if (!re) return []
  return [
    {
      type: 'apt',
      label: '아파트',
      icon: 'apartment',
      saleAvg: formatPrice(re.apt?.sale?.avg),
      saleCount: (re.apt?.sale?.count ?? 0).toLocaleString(),
      rentAvg: formatPrice(re.apt?.rent?.avg),
      rentCount: (re.apt?.rent?.count ?? 0).toLocaleString(),
    },
    {
      type: 'villa',
      label: '빌라',
      icon: 'holiday_village',
      saleAvg: formatPrice(re.villa?.sale?.avg),
      saleCount: (re.villa?.sale?.count ?? 0).toLocaleString(),
      rentAvg: formatPrice(re.villa?.rent?.avg),
      rentCount: (re.villa?.rent?.count ?? 0).toLocaleString(),
    },
    {
      type: 'offitel',
      label: '오피스텔',
      icon: 'business',
      saleAvg: formatPrice(re.offitel?.sale?.avg),
      saleCount: (re.offitel?.sale?.count ?? 0).toLocaleString(),
      rentAvg: formatPrice(re.offitel?.rent?.avg),
      rentCount: (re.offitel?.rent?.count ?? 0).toLocaleString(),
    },
  ]
})

// 서술형 설명
const areaDescription = computed(() => {
  if (!areaData.value?.facilities) return ''
  const cats = areaData.value.facilities.categories as Record<string, number> | undefined
  return generateAreaDescription({
    city: cityName.value,
    district: districtName.value,
    facilityStats: cats,
    totalFacilities: areaData.value.facilities.total,
  })
})

// SEO 메타
const canonicalUrl = `${SITE_URL}/${city.value}/${district.value}`
useHead(() => {
  const count = areaData.value?.facilities?.total
  const title = count
    ? `${districtName.value} 생활 정보 - 시설 ${count.toLocaleString()}곳 | 일상킷`
    : `${cityName.value} ${districtName.value} 생활 정보 | 일상킷`
  const description = `${cityName.value} ${districtName.value} 아파트·빌라·오피스텔 실거래가와 주요 생활시설 현황을 확인하세요. 병원, 약국, 주차장, 화장실 등 생활 인프라 정보를 한눈에 제공합니다.`
  return {
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:image', content: DEFAULT_OG_IMAGE },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:url', content: canonicalUrl },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:locale', content: 'ko_KR' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: DEFAULT_OG_IMAGE },
    ],
    link: [
      { rel: 'canonical', href: canonicalUrl },
    ],
  }
})

// JSON-LD 구조화 데이터
const { setAreaReportSchema, setBreadcrumbSchema } = useStructuredData()

setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: cityName.value, url: `/${city.value}` },
  { name: districtName.value, url: `/${city.value}/${district.value}` },
])

watch(areaData, (data) => {
  if (data?.facilities) {
    setAreaReportSchema({
      city: cityName.value,
      district: districtName.value,
      facilityTotal: data.facilities.total,
      topCategories: data.facilities.topCategories || [],
    })
  }
}, { immediate: true })
</script>
