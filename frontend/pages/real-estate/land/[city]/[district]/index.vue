<template>
  <div class="bg-background-light min-h-screen">
    <main class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <PageHero
        eyebrow="토지 실거래가"
        :title="`${districtName} 토지 실거래가`"
        :description="`${cityName} ${districtName} 동별 토지 매매 실거래가를 확인하세요. 국토교통부 공식 데이터 기반.`"
      />

      <SectionBlock :subtext="`${districtName} 내 동을 선택하면 토지 거래 내역을 확인할 수 있습니다.`">
        <template #heading>
          <h2 class="text-display-3 text-slate-900">{{ districtName }} 동 목록</h2>
        </template>

        <div v-if="sortedDongs.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <NuxtLink
            v-for="dong in sortedDongs"
            :key="dong.bjdCode"
            :to="`/real-estate/land/${citySlug}/${districtSlug}/${encodeURIComponent(dong.dongName)}`"
            class="bg-white rounded-xl border border-slate-200 px-4 py-4 flex flex-col gap-1 hover:border-primary hover:shadow-sm transition-all"
          >
            <span class="text-sm font-semibold text-slate-800">{{ dong.dongName }}</span>
            <template v-if="dong.avgPricePerPyeong != null">
              <span class="text-xs text-slate-500">
                평당 {{ formatManwon(dong.avgPricePerPyeong) }}만원
              </span>
              <span class="text-xs text-slate-400">
                (㎡당 {{ formatManwon(pyeongToSqm(dong.avgPricePerPyeong)) }}만원)
              </span>
            </template>
            <span v-else class="text-xs text-slate-400">대지 거래 없음</span>
            <span class="text-xs text-slate-500">거래 {{ dong.transactionCount.toLocaleString('ko-KR') }}건</span>
            <span class="text-xs text-slate-500">대지 {{ dong.daeCount.toLocaleString('ko-KR') }}건</span>
          </NuxtLink>
        </div>

        <div v-else class="rounded-xl bg-slate-50 p-12 text-center">
          <p class="text-slate-700 font-semibold">데이터 없음</p>
          <p class="text-slate-500 text-sm mt-1">{{ districtName }} 지역의 토지 거래 데이터가 준비 중입니다.</p>
        </div>
      </SectionBlock>

      <AdBanner />

      <DataSourceSection domain="real-estate" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useLand } from '~/composables/useLand'
import { buildLandRegionTitle, buildLandRegionDescription } from '~/utils/landMeta'
import { pyeongToSqm, formatManwon } from '~/types/land'
import type { LandRegionSummary } from '~/types/land'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'

const route = useRoute()
const citySlug = route.params.city as string
const districtSlug = route.params.district as string

// citySlug → 한글 이름
const cityName = CITY_SLUG_MAP[citySlug]
if (!cityName) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

// districtSlug → 한글 이름 (역매핑)
const districtSlugToName = Object.fromEntries(
  Object.entries(DISTRICT_SLUG_MAP).map(([name, slug]) => [slug, name]),
)
const districtName = districtSlugToName[districtSlug]
if (!districtName) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const land = useLand()

const { data: regionsData } = await useAsyncData(
  `land-district-${citySlug}-${districtSlug}`,
  () => land.getRegions({ city: cityName, district: districtName, page: 1, limit: 100 }),
  { default: () => null },
)

// Sort dongs by avgPricePerPyeong desc (nulls last)
const sortedDongs = computed<LandRegionSummary[]>(() => {
  const items: LandRegionSummary[] = regionsData.value?.items ?? []
  return [...items].sort((a, b) => {
    if (a.avgPricePerPyeong == null && b.avgPricePerPyeong == null) return 0
    if (a.avgPricePerPyeong == null) return 1
    if (b.avgPricePerPyeong == null) return -1
    return b.avgPricePerPyeong - a.avgPricePerPyeong
  })
})

// SSR: no-store when no data
if (import.meta.server && (regionsData.value?.items ?? []).length === 0) {
  const event = useRequestEvent()
  if (event) {
    setResponseHeader(event, 'Cache-Control', 'no-store')
  }
}

// SEO
const { setMeta } = useFacilityMeta()
setMeta({
  title: buildLandRegionTitle({ city: cityName, district: districtName }),
  description: buildLandRegionDescription({ city: cityName, district: districtName }),
  path: `/real-estate/land/${citySlug}/${districtSlug}`,
})

// Breadcrumb
const breadcrumbItems = [
  { label: '홈', href: '/', current: false },
  { label: '부동산 실거래가', href: '/real-estate', current: false },
  { label: '토지 실거래가', href: '/real-estate/land', current: false },
  { label: cityName, href: `/real-estate/land/${citySlug}`, current: false },
  { label: districtName, href: `/real-estate/land/${citySlug}/${districtSlug}`, current: true },
]

const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
  { name: '토지 실거래가', url: '/real-estate/land' },
  { name: cityName, url: `/real-estate/land/${citySlug}` },
  { name: districtName, url: `/real-estate/land/${citySlug}/${districtSlug}` },
])

setItemListSchema(
  sortedDongs.value.map((d) => ({
    name: `${districtName} ${d.dongName} 토지`,
    url: `/real-estate/land/${citySlug}/${districtSlug}/${encodeURIComponent(d.dongName)}`,
  })),
)
</script>
