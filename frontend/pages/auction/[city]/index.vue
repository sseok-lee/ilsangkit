<template>
  <div class="bg-background-light min-h-screen">
    <main class="mx-auto max-w-[1200px] px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <PageHero
        eyebrow="공매"
        :title="`${cityName} 공매 물건`"
        :description="`${cityName} 구·군별 부동산 공매 물건과 낙찰가율 통계를 확인하세요.`"
      />

      <SectionBlock :subtext="`${cityName} 내 구·군을 선택하면 공매 물건과 낙찰가율 통계를 확인할 수 있습니다.`">
        <template #heading>
          <h2 class="text-display-3 text-slate-900">{{ cityName }} 구·군 목록</h2>
        </template>

        <div v-if="districtCards.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <NuxtLink
            v-for="card in districtCards"
            :key="card.district"
            :to="`/auction/${citySlug}/${card.districtSlug}`"
            class="group bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2 shadow-sm hover:shadow-md hover:border-primary/30 transition-[box-shadow,border-color] duration-200 ease-out block"
          >
            <span class="text-display-3 text-slate-800">{{ card.district }}</span>
            <span class="text-caption text-slate-500">진행 {{ card.activeCount }}건</span>
            <span class="text-caption text-slate-500">낙찰 {{ card.soldCount }}건</span>
          </NuxtLink>
        </div>

        <div v-else class="rounded-xl bg-slate-50 p-12 text-center">
          <p class="text-slate-700 font-semibold">아직 공매 데이터가 없습니다</p>
          <p class="text-slate-500 text-sm mt-1">{{ cityName }} 지역의 공매 데이터가 준비 중입니다.</p>
        </div>
      </SectionBlock>

      <AdBanner />

      <DataSourceSection domain="auction" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { useAuction } from '~/composables/useAuction'
import { computeAuctionCityHead } from '~/utils/auctionHead'
import { useStructuredData } from '~/composables/useStructuredData'
import { SITE_URL } from '~/utils/seoConstants'
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

const auction = useAuction()

const { data: regionsData } = await useAsyncData(
  `auction-city-${citySlug}`,
  async () => {
    try {
      return await auction.getCityDetail(cityName)
    } catch {
      return null
    }
  },
  { default: () => null },
)

interface DistrictCard {
  district: string
  districtSlug: string
  activeCount: number
  soldCount: number
  isIndexable: boolean
}

const districtCards = computed<DistrictCard[]>(() => {
  const districts = regionsData.value?.districts ?? []
  return districts.map((d) => ({
    district: d.district,
    districtSlug: DISTRICT_SLUG_MAP[d.district] ?? d.district.toLowerCase().replace(/\s+/g, '-'),
    activeCount: d.activeCount,
    soldCount: d.soldCount,
    isIndexable: d.isIndexable,
  }))
})

const breadcrumbItems = [
  { label: '홈', href: '/', current: false },
  { label: '공매', href: '/auction', current: false },
  { label: cityName, href: `/auction/${citySlug}`, current: true },
]

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '공매', url: '/auction' },
  { name: cityName, url: `/auction/${citySlug}` },
])

const anyIndexable = computed(() => districtCards.value.some((d) => d.isIndexable))

const selfUrl = `${SITE_URL}/auction/${citySlug}`

useHead(() => computeAuctionCityHead({ city: cityName, anyIndexable: anyIndexable.value }, selfUrl))
</script>
