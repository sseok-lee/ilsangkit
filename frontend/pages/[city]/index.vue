<template>
  <div class="bg-white text-ink min-h-screen">
    <div class="page-container pb-10">
      <PageHead
        eyebrow="지역 허브"
        :title="`${cityName} 생활 정보`"
        :description="heroDescription"
      >
        <template #breadcrumb>
          <Breadcrumb :items="breadcrumbItems" class="mb-4" />
        </template>
      </PageHead>

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
        <SectionBlock
          id="districts"
          variant="flat"
          heading="구/군 선택"
          subtext="지역을 고르면 구·군별 시설과 부동산 정보를 함께 볼 수 있어요."
        >
          <template #right>
            <UiButton variant="secondary" :to="{ path: '/facilities', query: { city } }">생활시설 전체 보기</UiButton>
          </template>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 md:gap-x-8 border-t border-line">
            <NuxtLink
              v-for="d in cityData.districts"
              :key="d.slug"
              :to="`/${city}/${d.slug}`"
              class="group flex min-h-[56px] items-center justify-between gap-3 py-3 pl-1 pr-1 border-b border-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
            >
              <strong class="font-semibold text-ink group-hover:text-primary">{{ d.name }}</strong>
              <span class="text-[13px] text-muted tabular-nums">시설 {{ d.facilityTotal.toLocaleString() }}개</span>
            </NuxtLink>
          </div>
        </SectionBlock>

        <!-- 카테고리별 바로가기 -->
        <SectionBlock id="categories" variant="flat" heading="카테고리별 바로가기">
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
            <NuxtLink
              v-for="cat in cityCategoryLinks"
              :key="cat.slug"
              :to="cat.to"
              class="group flex min-h-[56px] items-center gap-2.5 rounded-[10px] border border-line bg-white px-3.5 py-2.5 transition-colors hover:border-primary"
            >
              <span class="material-symbols-outlined text-primary text-[22px]" aria-hidden="true">{{ cat.icon }}</span>
              <span class="font-semibold text-ink text-[15px] group-hover:text-primary">{{ cat.label }}</span>
            </NuxtLink>
          </div>
        </SectionBlock>

        <!-- Ad: District Grid 후 -->
        <AdBanner />

        <!-- ③ 생활 가이드 -->
        <SectionBlock variant="flat" heading="생활 가이드">
          <ClientOnly>
            <RecentGuides />
          </ClientOnly>
        </SectionBlock>

        <!-- ④ 교차 CTA -->
        <RegionRealEstateCta :area-name="cityName" />

        <!-- 데이터 출처 -->
        <DataSourceSection domain="facility" compact variant="flat" />
      </div>

      <!-- 에러 -->
      <div v-else class="rounded-xl bg-red-50 border border-red-200 p-8 text-center">
        <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
          <span class="material-symbols-outlined text-[28px] text-red-400" aria-hidden="true">error_outline</span>
        </div>
        <p class="text-red-800 font-semibold">{{ UI_MESSAGES.fetchError }}</p>
        <div class="mt-4 flex items-center justify-center gap-2">
          <button
            class="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            @click="retryFetch"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">refresh</span>
            다시 시도
          </button>
          <UiButton variant="secondary" to="/">홈으로</UiButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CITY_SLUG_MAP } from '~/composables/useRegions'
import { UI_MESSAGES } from '~/utils/uiMessages'
import { formatRegionAvgPrice } from '~/utils/regionPrice'
import { CATEGORY_GROUPS, CATEGORY_META } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'
import RegionRealEstatePrices from '~/components/region/RegionRealEstatePrices.vue'
import RegionRealEstateCta from '~/components/region/RegionRealEstateCta.vue'
import PageHead from '~/components/common/PageHead.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import UiButton from '~/components/common/UiButton.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { staticOgImageUrl } from '~/utils/ogImageUrl'
import { buildCityMetaDescription } from '~/utils/seoHelpers'
import { useAnalytics } from '~/composables/useAnalytics'
import { shouldNoindexSsr } from '~/utils/ssrIndexability'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { watchEffect } from 'vue'
import { suppressAds } from '~/composables/useAdsPolicy'
import { useSyncStatus } from '~/composables/useSyncStatus'

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

const RE_SYNC_KEYS = ['aptSale', 'aptRent', 'villaSale', 'villaRent', 'offitelSale', 'offitelRent'] as const

const { syncStatus: hubSyncStatus } = useSyncStatus()

// 부동산 6개 테이블 중 가장 최근 동기화 시각 (ISO 문자열은 사전순 = 시간순)
const reSyncedAt = computed<string | null>(() => {
  const s = hubSyncStatus.value
  if (!s) return null
  const dates = RE_SYNC_KEYS.map(k => s[k]).filter((v): v is string => !!v)
  return dates.length ? [...dates].sort().at(-1) ?? null : null
})

// 도시 전체 시설 합 (구/군 facilityTotal 합산) — heroStats·JSON-LD 양쪽에서 재사용 (SSR-safe: cityData는 useAsyncData)
const cityFacilityTotal = computed(() =>
  (cityData.value?.districts ?? []).reduce((sum: number, d: any) => sum + (d.facilityTotal ?? 0), 0),
)


const realEstateCards = computed(() => {
  const re = cityData.value?.realEstate
  if (!re) return []
  return [
    {
      type: 'apt',
      label: '아파트',
      icon: 'apartment',
      saleAvg: formatRegionAvgPrice(re.apt?.sale?.avg),
      saleCount: (re.apt?.sale?.count ?? 0).toLocaleString(),
      rentAvg: formatRegionAvgPrice(re.apt?.rent?.avg),
      rentCount: (re.apt?.rent?.count ?? 0).toLocaleString(),
    },
    {
      type: 'villa',
      label: '빌라',
      icon: 'holiday_village',
      saleAvg: formatRegionAvgPrice(re.villa?.sale?.avg),
      saleCount: (re.villa?.sale?.count ?? 0).toLocaleString(),
      rentAvg: formatRegionAvgPrice(re.villa?.rent?.avg),
      rentCount: (re.villa?.rent?.count ?? 0).toLocaleString(),
    },
    {
      type: 'offitel',
      label: '오피스텔',
      icon: 'business',
      saleAvg: formatRegionAvgPrice(re.offitel?.sale?.avg),
      saleCount: (re.offitel?.sale?.count ?? 0).toLocaleString(),
      rentAvg: formatRegionAvgPrice(re.offitel?.rent?.avg),
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

// meta description — 시/도 토큰만 다른 보일러플레이트를 피하려고 실데이터를 앞세운다.
// cityData 가 없으면 빌더가 기존 문구로 폴백한다.
const metaDescription = computed(() => buildCityMetaDescription({
  city: cityName.value,
  districtCount: cityData.value?.districts?.length,
  totalFacilities: cityFacilityTotal.value,
}))

// SEO 메타
const { setMeta } = useFacilityMeta()
watch(
  [cityName, isNoindex, metaDescription],
  ([name]) => {
    // 시/도 허브는 대표 좌표가 없다 — 동적 `/og?...` 는 프로덕션에서 100% 302 이므로
    // 최종 도착지(정적 PNG)를 그대로 쓴다. utils/ogImageUrl.ts 주석 참고.
    const ogImage = staticOgImageUrl()
    setMeta({
      title: `${name} 생활 정보`,
      description: metaDescription.value,
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
    setAreaReportSchema({
      city: cityName.value,
      district: '',
      facilityTotal: cityFacilityTotal.value,
      topCategories: [],
    })
  }
}, { immediate: true })

const { trackRegionPageView } = useAnalytics()
onMounted(() => {
  trackRegionPageView({ city: city.value })
})
</script>
