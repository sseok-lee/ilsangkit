<template>
  <div class="bg-background-light min-h-screen">
    <div class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
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
          <HardLink
            v-for="dong in sortedDongs"
            :key="dong.bjdCode"
            :to="`/real-estate/land/${citySlug}/${districtSlug}/${encodeURIComponent(dong.dongName)}`"
            class="group bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2 shadow-sm hover:shadow-md hover:border-primary/30 transition-[box-shadow,border-color] duration-200 ease-out block"
          >
            <span class="text-display-3 text-slate-800">{{ dong.dongName }}</span>
            <template v-if="dong.avgPricePerPyeong != null">
              <span class="text-caption text-primary">
                평당 {{ formatManwon(dong.avgPricePerPyeong) }}만원
              </span>
              <span class="text-caption text-slate-500">
                (㎡당 {{ formatManwon(pyeongToSqm(dong.avgPricePerPyeong)) }}만원)
              </span>
            </template>
            <span v-else class="text-caption text-slate-500">대지 거래 없음</span>
            <span class="text-caption text-slate-500">거래 {{ dong.transactionCount.toLocaleString('ko-KR') }}건</span>
            <span class="text-caption text-slate-500">대지 {{ dong.daeCount.toLocaleString('ko-KR') }}건</span>
          </HardLink>
        </div>

        <div v-else class="rounded-xl bg-slate-50 p-12 text-center">
          <p class="text-slate-700 font-semibold">데이터 없음</p>
          <p class="text-slate-500 text-sm mt-1">{{ districtName }} 지역의 토지 거래 데이터가 준비 중입니다.</p>
        </div>
      </SectionBlock>

      <AdBanner />


      <DataSourceSection domain="real-estate" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useLand } from '~/composables/useLand'
import { buildLandRegionTitle, buildLandRegionDescription } from '~/utils/landMeta'
import { resolveRealEstateListSsrOutcome } from '~/utils/realEstateListSsrOutcome'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { pyeongToSqm, formatManwon } from '~/types/land'
import type { LandRegionSummary } from '~/types/land'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import HardLink from '~/components/common/HardLink.vue'
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

const { data: regionsData, error: regionsError, status: regionsStatus } = await useAsyncData(
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

// SSR 응답 판정 — 장애(degraded)와 정상 0건(empty)을 구분한다.
// 판정 근거·회귀 배경은 utils/realEstateListSsrOutcome.ts 주석 참조.
// h3 의 setResponseHeader 는 server/ 전용 자동 import 라 앱 코드에서 ReferenceError 가 난다.
if (import.meta.server) {
  const outcome = resolveRealEstateListSsrOutcome({
    hasError: !!regionsError.value,
    fetchSettled: regionsStatus.value === 'success',
    hasItems: (regionsData.value?.items ?? []).length > 0,
  })
  if (outcome === 'degraded') {
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

// SEO — 동별 거래 건수·평당 시세(대지건수 가중평균)를 주입해 구·군 간 설명문 중복을 없앤다.
const landTotalTx = sortedDongs.value.reduce((sum, d) => sum + d.transactionCount, 0)
const landAvgPerPyeong = (() => {
  let weightedSum = 0
  let totalWeight = 0
  for (const d of sortedDongs.value) {
    if (d.avgPricePerPyeong != null && d.daeCount > 0) {
      weightedSum += d.avgPricePerPyeong * d.daeCount
      totalWeight += d.daeCount
    }
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null
})()
const { setMeta } = useFacilityMeta()
setMeta({
  title: buildLandRegionTitle({ city: cityName, district: districtName }),
  description: buildLandRegionDescription({
    city: cityName,
    district: districtName,
    avgPricePerPyeong: landAvgPerPyeong,
    count: landTotalTx,
  }),
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
