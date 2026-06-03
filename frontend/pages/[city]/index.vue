<template>
  <div class="bg-background-light min-h-screen">
    <main class="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <!-- Breadcrumb -->
      <Breadcrumb :items="breadcrumbItems" class="mb-4" />

      <!-- Hero -->
      <PageHero
        eyebrow="지역 허브"
        :title="`${cityName} 생활 정보`"
        :description="heroDescription"
        class="mb-5"
      />

      <!-- 로딩 -->
      <div v-if="pending" class="flex justify-center py-20">
        <div class="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>

      <!-- 콘텐츠 -->
      <div v-else-if="cityData">
        <!-- ① 부동산 시세 현황 -->
        <RegionRealEstatePrices
          v-if="cityData.realEstate"
          :cards="realEstateCards"
        />

        <!-- ② 구/군 선택 -->
        <section id="districts" class="mb-6">
          <h2 class="text-display-2 text-slate-900 flex items-center gap-2 mb-3">
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

        <!-- 카테고리별 바로가기 -->
        <section id="categories" class="mb-6">
          <h2 class="text-display-2 text-slate-900 flex items-center gap-2 mb-3">
            <span class="material-symbols-outlined text-primary text-[22px]">category</span>
            카테고리별 바로가기
          </h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <NuxtLink
              v-for="cat in cityCategoryLinks"
              :key="cat.slug"
              :to="cat.to"
              class="group flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 hover:border-primary/30"
            >
              <span class="material-symbols-outlined text-primary text-[22px]">{{ cat.icon }}</span>
              <span class="font-semibold text-slate-900 text-sm">{{ cat.label }}</span>
            </NuxtLink>
          </div>
        </section>

        <!-- Ad: District Grid 후 -->
        <div class="mb-6">
          <AdBanner />
        </div>

        <!-- ③ 생활 가이드 -->
        <section class="mb-6">
          <h2 class="text-display-2 text-slate-900 flex items-center gap-2 mb-3">
            <span class="material-symbols-outlined text-primary text-[22px]">menu_book</span>
            생활 가이드
          </h2>
          <ClientOnly>
            <RecentGuides />
          </ClientOnly>
        </section>

        <!-- ④ 교차 CTA -->
        <RegionRealEstateCta :area-name="cityName" />

        <!-- 데이터 출처 -->
        <DataSourceSection domain="facility" compact class="mt-2" />
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
import { CATEGORY_GROUPS, CATEGORY_META } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'
import RegionRealEstatePrices from '~/components/region/RegionRealEstatePrices.vue'
import RegionRealEstateCta from '~/components/region/RegionRealEstateCta.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
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

const cityCategoryLinks = computed(() =>
  CATEGORY_GROUPS.flatMap(g => g.categories).map((cat) => ({
    slug: cat,
    to: `/${cat}?city=${city.value}`,
    icon: CATEGORY_META[cat as FacilityCategory]?.icon ?? 'place',
    label: CATEGORY_META[cat as FacilityCategory]?.label ?? cat,
  })),
)

// Breadcrumb (시설/부동산 PR과 동일 패턴)
const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: cityName.value, href: `/${city.value}`, current: true },
])

// Area API 단일 호출 (시 단위)
const { data: response, pending } = await useAsyncData(
  `city-area-${city.value}`,
  () => $fetch<any>(`/api/area/${encodeURIComponent(city.value)}`)
    .catch(() => null)
)

const cityData = computed(() => response.value?.data ?? null)

// Hero description (조건부 디스트릭트 수 안내 흡수)
const heroDescription = computed(() => {
  const primary = `${cityName.value}의 부동산 시세와 생활시설을 한눈에 확인하세요`
  const count = cityData.value?.districts?.length
  return count
    ? `${primary}. ${cityName.value}에는 ${count}개 시군구에 걸쳐 생활시설 정보를 제공하고 있습니다.`
    : primary
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
