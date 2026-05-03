<template>
  <div class="bg-background-light min-h-screen">
    <main class="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <!-- 브레드크럼 -->
      <nav class="flex items-center gap-1 text-sm text-slate-500 mb-4">
        <NuxtLink to="/" class="hover:text-primary">홈</NuxtLink>
        <span class="material-symbols-outlined text-[14px]">chevron_right</span>
        <span class="text-slate-800">{{ cityName }}</span>
      </nav>

      <!-- 히어로 -->
      <div class="mb-5">
        <div class="mb-2">
          <h1 class="text-2xl md:text-3xl font-bold text-slate-900">
            {{ cityName }} 생활 정보
          </h1>
        </div>
        <p class="mt-2 text-slate-500 text-sm">{{ cityName }}의 부동산 시세와 생활시설을 한눈에 확인하세요</p>
        <p v-if="cityData?.districts?.length" class="text-gray-600 text-sm leading-relaxed mt-2">
          {{ cityName }}에는 {{ cityData.districts.length }}개 시군구에 걸쳐 생활시설 정보를 제공하고 있습니다.
        </p>
      </div>

      <!-- 로딩 -->
      <div v-if="pending" class="flex justify-center py-20">
        <div class="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>

      <!-- 콘텐츠 -->
      <div v-else-if="cityData">
        <!-- ① 부동산 시세 현황 -->
        <section v-if="cityData.realEstate" id="real-estate" class="mb-6">
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2 mb-3">
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

        <!-- ② 구/군 선택 -->
        <section id="districts" class="mb-6">
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2 mb-3">
            <span class="material-symbols-outlined text-primary text-[22px]">location_city</span>
            구/군 선택
          </h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <NuxtLink
              v-for="d in cityData.districts"
              :key="d.slug"
              :to="`/${city}/${d.slug}`"
              class="group flex flex-col items-center p-4 rounded-2xl border border-slate-200 bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 hover:border-primary/30"
            >
              <span class="font-bold text-slate-900 mb-1">{{ d.name }}</span>
              <span class="text-xs text-slate-500">시설 {{ d.facilityTotal.toLocaleString() }}개</span>
            </NuxtLink>
          </div>
        </section>

        <!-- Ad: District Grid 후 -->
        <div class="mb-6">
          <AdBanner />
        </div>

        <!-- ③ 생활 가이드 -->
        <section class="mb-6">
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2 mb-3">
            <span class="material-symbols-outlined text-primary text-[22px]">menu_book</span>
            생활 가이드
          </h2>
          <ClientOnly>
            <RecentGuides />
          </ClientOnly>
        </section>

        <!-- ④ 교차 CTA -->
        <section class="bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl p-5 md:p-6 text-center">
          <h3 class="text-base md:text-lg font-bold text-slate-800 mb-2">
            {{ cityName }} 부동산 실거래가 상세 보기
          </h3>
          <p class="text-sm text-slate-600 mb-4">아파트, 빌라, 오피스텔 실거래가를 확인해보세요</p>
          <div class="flex justify-center gap-3">
            <NuxtLink
              to="/real-estate/apt-sale"
              class="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-colors"
            >
              아파트
            </NuxtLink>
            <NuxtLink
              to="/real-estate/villa-sale"
              class="px-4 py-2 bg-white text-primary text-sm font-semibold rounded-xl border border-primary hover:bg-primary/5 transition-colors"
            >
              빌라
            </NuxtLink>
            <NuxtLink
              to="/real-estate/offitel-sale"
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
import { CITY_SLUG_MAP } from '~/composables/useRegions'
import { useStructuredData } from '~/composables/useStructuredData'
import { SITE_URL } from '~/utils/seoConstants'
import { useAnalytics } from '~/composables/useAnalytics'

const route = useRoute()
const city = computed(() => route.params.city as string)

// city slug 유효성 검사
if (!CITY_SLUG_MAP[city.value]) {
  throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없습니다' })
}

// CITY_SLUG_MAP에서 한글 이름
const cityName = computed(() => CITY_SLUG_MAP[city.value] || city.value)

// Area API 단일 호출 (시 단위)
const { data: response, pending } = await useAsyncData(
  `city-area-${city.value}`,
  () => $fetch<any>(`/api/area/${encodeURIComponent(city.value)}`)
    .catch(() => null)
)

const cityData = computed(() => response.value?.data ?? null)

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
  const re = cityData.value?.realEstate
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

// SEO 메타
const canonicalUrl = `${SITE_URL}/${city.value}`
useHead(() => {
  const title = `${cityName.value} 생활 정보·부동산 시세 | 일상킷`
  const description = `${cityName.value} 아파트·빌라·오피스텔 실거래가와 병원, 약국, 주차장, 공공화장실 등 주요 생활 정보를 확인하세요.`
  const dynamicOgImage = `${SITE_URL}/og?category=area&city=${encodeURIComponent(cityName.value)}&title=${encodeURIComponent(title)}`
  return {
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:image', content: dynamicOgImage },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:url', content: canonicalUrl },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: '일상킷' },
      { property: 'og:locale', content: 'ko_KR' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: dynamicOgImage },
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
])

watch(cityData, (data) => {
  if (data?.districts) {
    const totalFacilities = data.districts.reduce((sum: number, d: any) => sum + (d.facilityTotal ?? 0), 0)
    setAreaReportSchema({
      city: cityName.value,
      district: '',
      facilityTotal: totalFacilities,
      topCategories: [],
    })
  }
}, { immediate: true })

const { trackRegionPageView } = useAnalytics()
onMounted(() => {
  trackRegionPageView({ city: city.value })
})
</script>
