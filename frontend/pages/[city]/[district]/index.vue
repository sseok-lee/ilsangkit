<template>
  <div class="bg-background-light min-h-screen">
    <main class="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <!-- Breadcrumb -->
      <Breadcrumb :items="breadcrumbItems" class="mb-4" />

      <!-- Hero -->
      <PageHero
        eyebrow="지역 허브"
        :title="`${districtName} 생활 정보`"
        :description="heroDescription"
        class="mb-5"
      />

      <!-- Ad: 헤더 직후 -->
      <AdBanner class="mb-5" />

      <!-- 로딩 -->
      <div v-if="pending" class="flex justify-center py-20">
        <div class="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>

      <!-- 콘텐츠 -->
      <div v-else-if="areaData">
        <!-- ① 부동산 시세 현황 -->
        <RegionRealEstatePrices
          v-if="areaData.realEstate"
          :cards="realEstateCards"
        />

        <!-- ② 생활시설 현황 -->
        <RegionFacilityCategoryGrid
          v-if="areaData.facilities"
          :city="city"
          :district="district"
          :total="areaData.facilities.total"
          :categories="sortedFacilityCategories"
          :top-categories="areaData.facilities.topCategories ?? []"
        />

        <!-- Ad: Facilities 후 -->
        <div class="mb-6">
          <AdBanner />
        </div>

        <!-- ③ 교차 CTA -->
        <RegionRealEstateCta :area-name="districtName" />

        <!-- 데이터 출처 -->
        <DataSourceSection domain="facility" compact class="mt-2" />
      </div>

      <!-- 에러 -->
      <div v-else class="py-20 text-center text-slate-500">
        {{ UI_MESSAGES.fetchError }}
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRegions, CITY_SLUG_MAP } from '~/composables/useRegions'
import { UI_MESSAGES } from '~/utils/uiMessages'
import RegionRealEstatePrices from '~/components/region/RegionRealEstatePrices.vue'
import RegionFacilityCategoryGrid from '~/components/region/RegionFacilityCategoryGrid.vue'
import RegionRealEstateCta from '~/components/region/RegionRealEstateCta.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { CATEGORY_META } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'
import { SITE_URL } from '~/utils/seoConstants'
import { generateAreaDescription } from '~/utils/seoHelpers'
import { useAnalytics } from '~/composables/useAnalytics'
import { shouldNoindexSsr } from '~/utils/ssrIndexability'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { watchEffect } from 'vue'
import { suppressAds } from '~/composables/useAdsPolicy'

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

// Breadcrumb (시설/부동산 PR과 동일 패턴)
const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: cityName.value, href: `/${city.value}`, current: false },
  { label: districtName.value, href: `/${city.value}/${district.value}`, current: true },
])

// Area API 단일 호출
const { data: response, pending, error } = await useAsyncData(
  `area-${city.value}-${district.value}`,
  () => $fetch<any>(`/api/area/${encodeURIComponent(city.value)}/${encodeURIComponent(district.value)}`)
)
const fetchFailed = computed(() => !!error.value)
if (import.meta.server && error.value) markDegradedResponse()

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

// 서술형 설명 (PageHero description으로 통합)
const heroDescription = computed(() => {
  const primary = `${cityName.value} ${districtName.value}의 부동산 시세와 생활시설을 한눈에 확인하세요`
  if (!areaData.value?.facilities) return primary
  const cats = areaData.value.facilities.categories as Record<string, number> | undefined
  const areaInfo = generateAreaDescription({
    city: cityName.value,
    district: districtName.value,
    facilityStats: cats,
    totalFacilities: areaData.value.facilities.total,
  })
  return areaInfo ? `${primary}. ${areaInfo}` : primary
})

// noindex 조건: fetch 실패는 noindex 금지(fail-open), 성공 후 빈값만 noindex
// 정책: noindex 페이지는 canonical 을 출력하지 않는다 (noindex-canonical-policy.md)
const isNoindex = computed(() => shouldNoindexSsr({
  fetchFailed: fetchFailed.value,
  confirmedEmpty: !fetchFailed.value && areaData.value === null,
}))

watchEffect(() => suppressAds(fetchFailed.value || isNoindex.value))

// SEO 메타
const { setMeta } = useFacilityMeta()
watch(
  [cityName, districtName, isNoindex],
  ([cName, dName]) => {
    const ogImage = `${SITE_URL}/og?category=area&city=${encodeURIComponent(cName)}&district=${encodeURIComponent(dName)}&title=${encodeURIComponent(`${cName} ${dName} 생활 정보`)}`
    setMeta({
      title: `${cName} ${dName} 생활 정보`,
      description: `${cName} ${dName}의 부동산 실거래가와 병원, 약국, 주차장, 공공화장실 등 주요 생활 인프라 정보를 확인하세요.`,
      path: `/${city.value}/${district.value}`,
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

const { trackRegionPageView } = useAnalytics()
onMounted(() => {
  trackRegionPageView({ city: city.value, district: district.value })
})
</script>
