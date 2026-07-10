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
          :synced-at="reSyncedAt"
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
            <span class="material-symbols-outlined text-primary text-[22px]">grid_view</span>
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
      <div v-else class="rounded-xl bg-red-50 border border-red-200 p-8 text-center">
        <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
          <span class="material-symbols-outlined text-[28px] text-red-400">error_outline</span>
        </div>
        <p class="text-red-800 font-semibold">{{ UI_MESSAGES.fetchError }}</p>
        <div class="mt-4 flex items-center justify-center gap-2">
          <button
            class="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            @click="retryFetch"
          >
            <span class="material-symbols-outlined text-[16px]">refresh</span>
            다시 시도
          </button>
          <NuxtLink
            to="/"
            class="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            홈으로
          </NuxtLink>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { CITY_SLUG_MAP } from '~/composables/useRegions'
import { UI_MESSAGES } from '~/utils/uiMessages'
import { CATEGORY_GROUPS, CATEGORY_META } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'
import RegionRealEstatePrices from '~/components/region/RegionRealEstatePrices.vue'
import RegionRealEstateCta from '~/components/region/RegionRealEstateCta.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { SITE_URL } from '~/utils/seoConstants'
import { useAnalytics } from '~/composables/useAnalytics'
import { shouldNoindexSsr } from '~/utils/ssrIndexability'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { watchEffect } from 'vue'
import { suppressAds } from '~/composables/useAdsPolicy'

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
const { data: response, pending, error, refresh } = await useAsyncData(
  `city-area-${city.value}`,
  () => $fetch<any>(`/api/area/${encodeURIComponent(city.value)}`)
)
const fetchFailed = computed(() => !!error.value)
if (import.meta.server && error.value) markDegradedResponse()

function retryFetch() {
  void refresh()
}

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

const RE_SYNC_KEYS = ['aptSale', 'aptRent', 'villaSale', 'villaRent', 'offitelSale', 'offitelRent'] as const

const hubSyncApiBase = useApiBase()
const { data: hubSyncStatus } = useAsyncData<Record<string, string | null> | null>(
  'city-hub-sync-status',
  async () => {
    const res = await $fetch<{ success: boolean; data: Record<string, string | null> }>(
      `${hubSyncApiBase}/api/meta/sync-status`,
      { signal: AbortSignal.timeout(8000) },
    )
    return res.data ?? null
  },
  { server: false },
)

// 부동산 6개 테이블 중 가장 최근 동기화 시각 (ISO 문자열은 사전순 = 시간순)
const reSyncedAt = computed<string | null>(() => {
  const s = hubSyncStatus.value
  if (!s) return null
  const dates = RE_SYNC_KEYS.map(k => s[k]).filter((v): v is string => !!v)
  return dates.length ? [...dates].sort().at(-1) ?? null : null
})

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

// noindex 조건: fetch 실패는 noindex 금지(fail-open), 성공 후 빈값만 noindex
// 정책: noindex 페이지는 canonical 을 출력하지 않는다 (noindex-canonical-policy.md)
const isNoindex = computed(() => shouldNoindexSsr({
  fetchFailed: fetchFailed.value,
  confirmedEmpty: !fetchFailed.value && cityData.value === null,
}))

watchEffect(() => suppressAds(fetchFailed.value || isNoindex.value))

// SEO 메타
const { setMeta } = useFacilityMeta()
watch(
  [cityName, isNoindex],
  ([name]) => {
    const ogImage = `${SITE_URL}/og?category=area&city=${encodeURIComponent(name)}&title=${encodeURIComponent(`${name} 생활 정보`)}`
    setMeta({
      title: `${name} 생활 정보`,
      description: `${name} 아파트·빌라·오피스텔·토지 실거래가와 병원, 약국, 주차장, 공공화장실 등 주요 생활 정보를 확인하세요.`,
      path: `/${city.value}`,
      image: ogImage,
      canonical: isNoindex.value ? false : undefined,
    })
  },
  { immediate: true },
)

useHead(() => isNoindex.value
  ? { meta: [{ name: 'robots', content: 'noindex, follow' }] }
  : {})

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
