<template>
  <div class="property-redesign bg-white min-h-screen">
    <div class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <PageHero
        class="property-hero"
        eyebrow="토지 실거래가"
        :title="`${cityName} 토지 실거래가`"
        :description="`${cityName} 구·군별 토지 매매 실거래가를 확인하세요. 국토교통부 공식 데이터 기반.`"
      />

      <nav aria-label="상위 지역" class="property-actions"><HardLink to="/real-estate/land">시·도 다시 선택</HardLink></nav>
      <LandRegionNavigation :city-slug="citySlug">
      <SectionBlock class="property-section" :subtext="`${cityName} 내 구·군을 선택하면 동별 토지 거래 내역을 확인할 수 있습니다.`">
        <template #heading>
          <h2 class="text-display-3 text-slate-900">{{ cityName }} 구·군 목록</h2>
        </template>

        <form class="property-search" @submit.prevent="regionSearch = regionDraft.trim()">
          <label class="sr-only" for="land-region-search">지역명 검색</label>
          <input id="land-region-search" v-model="regionDraft" placeholder="지역명 검색" maxlength="100">
          <button type="submit">검색</button>
        </form>
        <div v-if="regionCandidates.length > 0" class="property-region-list">
          <HardLink
            v-for="card in regionCandidates"
            :key="card.district"
            :to="`/real-estate/land/${citySlug}/${card.districtSlug}`"
            class="property-region-link"
          >
            <span class="text-display-3 text-slate-800">{{ card.district }}</span>
            <span class="text-caption text-slate-500">동 {{ card.dongCount }}개</span>
            <span class="text-caption text-slate-500">거래 {{ card.totalTransactions.toLocaleString('ko-KR') }}건</span>
          </HardLink>
        </div>

        <div v-else-if="regionsError" role="alert" class="py-8 text-sm text-muted">지역 정보를 불러오지 못했습니다. <button class="min-h-11 underline" @click="refresh()">다시 시도</button></div>
        <p v-else-if="regionSearch" class="py-8 text-sm text-muted">검색한 지역이 없습니다.</p>
        <div v-else class="rounded-xl bg-slate-50 p-12 text-center">
          <p class="text-slate-700 font-semibold">아직 토지 거래 데이터가 없습니다</p>
          <p class="text-slate-500 text-sm mt-1">{{ cityName }} 지역의 토지 거래 데이터가 준비 중입니다.</p>
        </div>
      </SectionBlock>
      </LandRegionNavigation>

      <AdBanner />


      <DataSourceSection domain="real-estate" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import LandRegionNavigation from '~/components/realEstate/LandRegionNavigation.vue'
import { loadLandRegions } from '~/utils/landRegionNavigation'
import { useLand } from '~/composables/useLand'
import { buildLandRegionTitle, buildLandRegionDescription } from '~/utils/landMeta'
import { resolveRealEstateListSsrOutcome } from '~/utils/realEstateListSsrOutcome'
import { isListingDocumentIndexable } from '~/utils/indexability'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import type { LandRegionSummary } from '~/types/land'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import HardLink from '~/components/common/HardLink.vue'
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

const { data: regionsData, error: regionsError, status: regionsStatus, refresh } = await useAsyncData(
  `land-city-${citySlug}`,
  () => loadLandRegions(page => land.getRegions({ city: cityName, page, limit: 100 })),
  { default: () => null },
)

// Group items by district
interface DistrictCard {
  district: string
  districtSlug: string
  dongCount: number
  totalTransactions: number
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

    const districtSlug =
      DISTRICT_SLUG_MAP[district] ?? district.toLowerCase().replace(/\s+/g, '-')

    cards.push({ district, districtSlug, dongCount, totalTransactions })
  }

  return cards
})

// 응답 판정 — 장애(degraded)와 정상 0건(empty)을 구분한다.
// 판정 근거·회귀 배경은 utils/realEstateListSsrOutcome.ts 주석 참조.
// 아래 색인 판정(fail-open)도 같은 결과를 쓴다 — 503 과 noindex 가 서로 어긋나지 않게 하기 위해서다.
// h3 의 setResponseHeader 는 server/ 전용 자동 import 라 앱 코드에서 ReferenceError 가 난다.
const listOutcome = resolveRealEstateListSsrOutcome({
  hasError: !!regionsError.value,
  fetchSettled: regionsStatus.value === 'success',
  hasItems: (regionsData.value?.items ?? []).length > 0,
})

if (import.meta.server) {
  if (listOutcome === 'degraded') {
    // 503 + no-store. 200 으로 내보내면 빈 본문이 swr(s-maxage=300) 캐시에 박혀 색인된다.
    markDegradedResponse()
  }
  // outcome === 'empty' 는 의도적으로 아무것도 하지 않는다.
  //
  // 예전엔 여기서 no-store 를 걸었다. 목적은 "한 번의 fetch 실패로 생긴 빈 본문이
  // swr 캐시에 박혀 5분간 서빙되는" 사고(2026-05 villa-sale) 방지였다.
  // 그 실패 경로는 #686 이 degraded(503) 로 분리했고, 503 은
  // server/plugins/no-store-on-server-error.ts 가 실제로 no-store 를 강제한다.
  //
  // 그래서 여기 남는 건 "페치 성공 + 진짜로 0건" = 거래가 없는 지역이다.
  // 정확한 내용이므로 캐시되어도 문제가 없다.
  //
  // 게다가 그 no-store 는 애초에 동작하지도 않았다. Nitro 의 cachedEventHandler 가
  // swr 이 걸린 경로의 cache-control 을 무조건 덮어쓰고(errorResponseCache.ts 주석 참조),
  // beforeResponse 훅의 교정은 5xx 에만 적용된다. 200 에는 손이 닿지 않는다.
  // 동작하지 않는 코드를 살리려 커스텀 헤더 신호 같은 기계장치를 늘리는 대신 제거했다.
}

// SEO uses the same source transaction count as the region list.
const landCityTotalTx = districtCards.value.reduce((sum, d) => sum + d.totalTransactions, 0)
// 색인 판정 — 실제로 렌더되는 구·군 카드 수 기준(utils/indexability.ts).
// 구·군이 0개면 본문이 "아직 토지 거래 데이터가 없습니다" 한 줄로 무너지는데도
// 이 허브는 조건 없이 색인·사이트맵 대상이었다.
// 장애(degraded)는 fail-open — 일시 장애가 정상 허브를 색인에서 떨어뜨리면 안 된다.
const cityIndexable = isListingDocumentIndexable({
  itemCount: districtCards.value.length,
  fetchFailed: listOutcome === 'degraded',
})

const { setMeta } = useFacilityMeta()
setMeta({
  title: buildLandRegionTitle({ city: cityName }),
  description: buildLandRegionDescription({
    city: cityName,
    count: landCityTotalTx,
  }),
  path: `/real-estate/land/${citySlug}`,
  // noindex-canonical-policy: noindex 문서는 canonical 을 함께 내보내지 않는다(혼합 신호 방지).
  canonical: cityIndexable ? undefined : false,
})

if (!cityIndexable) {
  useHead({ meta: [{ name: 'robots', content: 'noindex, follow' }] })
}

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
const regionDraft = ref('')
const regionSearch = ref('')
const regionCandidates = computed(() => (districtCards.value).filter(row => row.district.includes(regionSearch.value)))
</script>

<style src="~/assets/css/remaining-property.css"></style>
