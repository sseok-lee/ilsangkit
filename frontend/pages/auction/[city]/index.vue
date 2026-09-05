<template>
  <div class="bg-background-light min-h-screen">
    <div class="mx-auto max-w-[1200px] px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <PageHero
        eyebrow="공매"
        :title="`${cityName} 공매 물건`"
        :description="`${cityName} 구·군별 부동산 공매 물건과 낙찰가율 통계를 확인하세요.`"
      />

      <SectionBlock
        :heading="`${cityName} 구·군 목록`"
        :subtext="`${cityName} 내 구·군을 선택하면 공매 물건과 낙찰가율 통계를 확인할 수 있습니다.`"
      >
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

        <div v-else>
          <EmptyState icon="gavel" title="아직 공매 데이터가 없습니다" :description="`${cityName} 지역의 공매 데이터가 준비 중입니다.`">
            <NuxtLink
              to="/auction"
              class="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              전국 공매 허브로
            </NuxtLink>
          </EmptyState>
        </div>
      </SectionBlock>

      <AdBanner />


      <DataSourceSection domain="auction" />
    </div>
  </div>
</template>

<script setup lang="ts">
// 전역 TrustLine 억제 — 이 페이지는 자체 데이터 출처 카드를 렌더한다 (#766)
definePageMeta({ hasSourceCard: true })

import { computed } from 'vue'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { useAuction } from '~/composables/useAuction'
import { computeAuctionCityHead } from '~/utils/auctionHead'
import { useStructuredData } from '~/composables/useStructuredData'
import { SITE_URL } from '~/utils/seoConstants'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import EmptyState from '~/components/common/EmptyState.vue'

const route = useRoute()
const citySlug = route.params.city as string

const cityName = CITY_SLUG_MAP[citySlug]
if (!cityName) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const auction = useAuction()

const { data: regionsData, error: regionsError } = await useAsyncData(
  `auction-city-${citySlug}`,
  () => auction.getCityDetail(cityName),
  { default: () => null },
)

// 일시 장애를 200 + index 로 굳히지 않는다 (#467 / #674). 사용자에겐 페이지를 그대로
// 보여주되(fail-open) 크롤러에겐 503 + no-store 로 알린다.
//
// ⚠️ useAsyncData 핸들러 **밖**에서 불러야 한다. 핸들러 본문은 중첩 async 라 Nuxt 인스턴스
// 컨텍스트가 없고, 그 안에서 부르면 useNuxtApp() 이 throw 해 503 이 영영 나가지 않는다.
const regionsFetchFailed = computed(() => Boolean(regionsError.value))
if (regionsFetchFailed.value && import.meta.server) markDegradedResponse()

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

// 일시 장애는 절대 noindex 로 굳히지 않는다 (utils/indexability.ts 원칙 1, #467).
// regionsData 가 null 이면 districtCards 가 [] 가 되어 some() 이 false 를 내고,
// 그 결과 이 허브가 **503 + noindex** 로 나갔다 — 503 은 "잠시 후 다시 오라"인데
// noindex 는 "빼라"라서 서로 어긋난다. 백엔드가 한 번 흔들린 것으로 색인을 잃는 형태다.
const anyIndexable = computed(() =>
  regionsFetchFailed.value || districtCards.value.some((d) => d.isIndexable),
)

const selfUrl = `${SITE_URL}/auction/${citySlug}`

useHead(() => computeAuctionCityHead({ city: cityName, anyIndexable: anyIndexable.value }, selfUrl))
</script>
