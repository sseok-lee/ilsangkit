<template>
  <div class="bg-background-light min-h-screen">
    <main class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <PageHero
        eyebrow="토지 실거래가"
        :title="`${cityName} 토지 실거래가`"
        :description="`${cityName} 구·군별 토지 매매 실거래가를 확인하세요. 국토교통부 공식 데이터 기반.`"
      />

      <SectionBlock :subtext="`${cityName} 내 구·군을 선택하면 동별 토지 거래 내역을 확인할 수 있습니다.`">
        <template #heading>
          <h2 class="text-display-3 text-slate-900">{{ cityName }} 구·군 목록</h2>
        </template>

        <div v-if="districtCards.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <NuxtLink
            v-for="card in districtCards"
            :key="card.district"
            :to="`/real-estate/land/${citySlug}/${card.districtSlug}`"
            class="bg-white rounded-xl border border-slate-200 px-4 py-4 flex flex-col gap-1 hover:border-primary hover:shadow-sm transition-all"
          >
            <span class="text-sm font-semibold text-slate-800">{{ card.district }}</span>
            <span class="text-xs text-slate-500">동 {{ card.dongCount }}개</span>
            <span class="text-xs text-slate-500">거래 {{ card.totalTransactions.toLocaleString('ko-KR') }}건</span>
            <span v-if="card.avgPricePerPyeong != null" class="text-xs text-slate-500">
              평당 {{ card.avgPricePerPyeong.toLocaleString('ko-KR') }}원
            </span>
          </NuxtLink>
        </div>

        <div v-else class="rounded-xl bg-slate-50 p-12 text-center">
          <p class="text-slate-700 font-semibold">아직 토지 거래 데이터가 없습니다</p>
          <p class="text-slate-500 text-sm mt-1">{{ cityName }} 지역의 토지 거래 데이터가 준비 중입니다.</p>
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
import type { LandRegionSummary } from '~/types/land'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'

const route = useRoute()
const citySlug = route.params.city as string

const cityName = CITY_SLUG_MAP[citySlug]
if (!cityName) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const land = useLand()

const { data: regionsData } = await useAsyncData(
  `land-city-${citySlug}`,
  () => land.getRegions({ city: cityName, page: 1, limit: 100 }),
  { default: () => null },
)

// Group items by district
interface DistrictCard {
  district: string
  districtSlug: string
  dongCount: number
  totalTransactions: number
  avgPricePerPyeong: number | null
}

const districtCards = computed<DistrictCard[]>(() => {
  const items: LandRegionSummary[] = regionsData.value?.items ?? []
  if (items.length === 0) return []

  const districtMap = new Map<string, LandRegionSummary[]>()
  for (const item of items) {
    const key = item.district
    if (!districtMap.has(key)) districtMap.set(key, [])
    districtMap.get(key)!.push(item)
  }

  const cards: DistrictCard[] = []
  for (const [district, rows] of districtMap) {
    const dongCount = rows.length
    const totalTransactions = rows.reduce((sum, r) => sum + r.transactionCount, 0)

    // Weighted average of avgPricePerPyeong by daeCount
    let weightedSum = 0
    let totalWeight = 0
    for (const r of rows) {
      if (r.avgPricePerPyeong != null && r.daeCount > 0) {
        weightedSum += r.avgPricePerPyeong * r.daeCount
        totalWeight += r.daeCount
      }
    }
    const avgPricePerPyeong = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null

    const districtSlug =
      DISTRICT_SLUG_MAP[district] ?? district.toLowerCase().replace(/\s+/g, '-')

    cards.push({ district, districtSlug, dongCount, totalTransactions, avgPricePerPyeong })
  }

  return cards
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
  title: buildLandRegionTitle({ city: cityName }),
  description: buildLandRegionDescription({ city: cityName }),
  path: `/real-estate/land/${citySlug}`,
})

// Breadcrumb
const breadcrumbItems = [
  { label: '홈', href: '/', current: false },
  { label: '부동산 실거래가', href: '/real-estate', current: false },
  { label: '토지 실거래가', href: '/real-estate/land', current: false },
  { label: cityName, href: `/real-estate/land/${citySlug}`, current: true },
]

const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
  { name: '토지 실거래가', url: '/real-estate/land' },
  { name: cityName, url: `/real-estate/land/${citySlug}` },
])

setItemListSchema(
  districtCards.value.map((d) => ({
    name: `${cityName} ${d.district} 토지`,
    url: `/real-estate/land/${citySlug}/${d.districtSlug}`,
  })),
)
</script>
