<template>
  <div class="bg-background-light min-h-screen">
    <div class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <PageHero
        class="exploration-page-hero"
        :title="heroTitle"
        :description="heroDescription"
      />

      <SectionBlock heading="거래 유형과 지역" :subtext="`${cityName} 구/군을 선택하면 지역별 거래를 확인할 수 있습니다.`">
        <ExplorationFilters
          :type="realEstateTypeParam"
          :city="cityName"
        />
        <div class="mt-4 pt-4 border-t border-line flex justify-end">
          <NuxtLink :to="mapHref" class="map-link">{{ mapLinkLabel }}</NuxtLink>
        </div>
      </SectionBlock>

      <AdBanner />

      <SectionBlock :subtext="`${cityName} 내 구/군을 선택하면 단지 목록을 확인할 수 있습니다.`">
        <template #heading>
          <h2 class="text-display-3 text-slate-900">{{ cityName }} 구/군 목록</h2>
        </template>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <NuxtLink
            v-for="district in districts"
            :key="district.name"
            :to="district.url"
            class="flex items-center justify-center p-4 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 text-center text-sm"
          >
            {{ district.name }}
          </NuxtLink>
        </div>
      </SectionBlock>

      <SectionBlock
        v-if="cityListFailed"
        heading="주요 건물"
      >
        <div class="rounded-lg bg-red-50 px-5 py-8 text-center">
          <p class="font-semibold text-red-700">주요 건물을 불러오지 못했습니다</p>
          <p class="mt-1 text-sm text-red-600">잠시 후 다시 시도해 주세요.</p>
          <button class="retry-button" type="button" @click="refreshTopComplexes()">다시 시도</button>
        </div>
      </SectionBlock>

      <SectionBlock
        v-else-if="topComplexes.length > 0"
        class="exploration-list-section"
        heading="주요 건물"
        :subtext="`${cityName} ${typeLabel} 서버 정렬 기준 최대 6곳`"
      >
        <div class="building-list">
          <ExplorationBuildingRow
            v-for="building in topComplexes"
            :key="building.buildingKey ?? `${building.buildingName}:${building.bjdCode}:${building.dongName}:${building.jibun ?? ''}`"
            :building="building"
            :mode="tabPart"
          />
        </div>
      </SectionBlock>

      <SectionBlock v-else heading="주요 건물">
        <p class="rounded-lg bg-background-light px-5 py-8 text-center text-sm text-muted">
          이 지역에는 공개된 주요 건물이 없습니다.
        </p>
      </SectionBlock>

      <DataSourceSection domain="real-estate" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { CITY_SLUG_MAP, REGIONS } from '~/shared/regionSlugs'
import { isRealEstateUrlType, toCitySlug, type RealEstateUrlType } from '~/utils/realEstateUrl'
import { PROPERTY_TYPE_META, buildReCityDescription } from '~/utils/realEstateMeta'
import type { RealEstatePropertyType, TransactionMode, RealEstateType, ComplexInfo } from '~/types/realEstate'
import { KOREA_BOUNDS, type MapRegionItem, type MapResponse } from '~/types/realEstateMap'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useRealEstate } from '~/composables/useRealEstate'
import { suppressAds } from '~/composables/useAdsPolicy'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { explorationListHref, explorationMapHref } from '~/utils/explorationNavigation'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import ExplorationFilters from '~/components/realEstate/ExplorationFilters.vue'
import ExplorationBuildingRow from '~/components/realEstate/ExplorationBuildingRow.vue'

const route = useRoute()
const realEstateTypeParam = route.params.realEstateType as string
const citySlugParam = route.params.city as string

if (!isRealEstateUrlType(realEstateTypeParam)) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const cityNameRaw = CITY_SLUG_MAP[citySlugParam]
if (!cityNameRaw) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}
// 전남광주통합특별시는 예외: 접미사(특별시)를 떼면 '전남광주통합'으로 잘려
// REGIONS/getComplexList 조회가 파손된다. flat 27 시군구 키는 풀네임 그대로여야 한다.
const cityName = cityNameRaw === '전남광주통합특별시'
  ? cityNameRaw
  : cityNameRaw.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')

const [propertyTypePart, tabPart] = realEstateTypeParam.split('-') as [RealEstatePropertyType, TransactionMode]
const propertyMeta = PROPERTY_TYPE_META[propertyTypePart]
const typeLabel = tabPart === 'sale'
  ? `${propertyMeta?.label ?? ''} 매매`
  : `${propertyMeta?.label ?? ''} 전월세`

const heroTitle = `${cityName} ${typeLabel} 실거래가`
const typeHubPath = `/real-estate/${realEstateTypeParam}`
const districts = computed(() =>
  (REGIONS[cityName] ?? []).map((name) => ({
    name,
    url: explorationListHref(realEstateTypeParam as RealEstateUrlType, { city: cityName, district: name }),
  })),
)

const { getComplexList } = useRealEstate()
const { data: topComplexesData, error: topComplexesError, refresh: refreshTopComplexes } = await useAsyncData(
  `re-city-complexes-${realEstateTypeParam}-${citySlugParam}`,
  () => getComplexList(realEstateTypeParam as RealEstateType, cityName, undefined, undefined, 1, 6),
)
if (import.meta.server && topComplexesError.value) markDegradedResponse()
const topComplexes = computed<ComplexInfo[]>(() => topComplexesData.value?.items ?? [])
const cityListFailed = computed(() => !!topComplexesError.value)

watchEffect(() => suppressAds(cityListFailed.value || topComplexes.value.length === 0))

// 시/도 지도 링크는 지도 화면이 실제로 사용하는 전국 city 집계의 좌표만 사용한다.
// 지도 집계 준비 실패는 주요 건물 요청과 분리하고 전국 중심 fallback으로만 처리한다.
const apiBase = useApiBase()
const { data: cityMapCenter } = await useAsyncData(
  `re-city-map-center-${realEstateTypeParam}-${citySlugParam}`,
  async () => {
    try {
      const response = await $fetch<MapResponse>(`${apiBase}/api/real-estate/${realEstateTypeParam}/map`, {
        params: { level: 13, swLat: 33, swLng: 124, neLat: 39, neLng: 132 },
      })
      const item = (response.data.items as MapRegionItem[]).find(
        (region) => toCitySlug(region.name) === citySlugParam,
      )
      if (
        item?.lat == null
        || item.lng == null
        || item.lat < KOREA_BOUNDS.LAT_MIN
        || item.lat > KOREA_BOUNDS.LAT_MAX
        || item.lng < KOREA_BOUNDS.LNG_MIN
        || item.lng > KOREA_BOUNDS.LNG_MAX
      ) return null
      return { lat: item.lat, lng: item.lng, level: 9 }
    } catch {
      return null
    }
  },
  { default: () => null },
)
const mapHref = computed(() =>
  explorationMapHref(realEstateTypeParam as RealEstateUrlType, cityMapCenter.value),
)
const mapLinkLabel = computed(() =>
  cityMapCenter.value ? `${cityName} 지도에서 보기` : '전국 지도에서 보기',
)

// meta/hero description: 구·군 개수 + 대표 단지를 주입해 시 간 설명문 중복을 없앤다.
const heroDescription = computed(() =>
  buildReCityDescription({
    cityName,
    typeLabel,
    districtCount: districts.value.length,
    topComplexName: topComplexes.value[0]?.buildingName,
  }),
)

const breadcrumbItems = [
  { label: '홈', href: '/', current: false },
  { label: '부동산 실거래가', href: '/real-estate', current: false },
  { label: typeLabel, href: typeHubPath, current: false },
  { label: cityName, href: `/real-estate/${realEstateTypeParam}/${citySlugParam}`, current: true },
]

const { setMeta } = useFacilityMeta()
setMeta({
  title: `${cityName} ${typeLabel} 실거래가`,
  description: heroDescription.value,
  path: `/real-estate/${realEstateTypeParam}/${citySlugParam}`,
})

const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
  { name: typeLabel, url: typeHubPath },
  { name: cityName, url: `/real-estate/${realEstateTypeParam}/${citySlugParam}` },
])
setItemListSchema(
  districts.value.map((d) => ({ name: d.name, url: d.url })),
)
</script>

<style scoped>
.exploration-page-hero,
.exploration-list-section {
  border-radius: 0;
  border-right: 0;
  border-left: 0;
  box-shadow: none;
}

.exploration-page-hero :deep(h1) {
  font-size: 27px;
}

@media (min-width: 768px) {
  .exploration-page-hero :deep(h1) {
    font-size: 36px;
  }
}

.map-link,
.retry-button {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 700;
}

.map-link {
  color: #2450dc;
  text-decoration: none;
}

.retry-button {
  margin-top: 1rem;
  border-radius: 0.5rem;
  background: #2450dc;
  padding: 0.5rem 1rem;
  color: #fff;
}

.map-link:focus-visible,
.retry-button:focus-visible {
  outline: 2px solid #2450dc;
  outline-offset: 2px;
}

.building-list {
  border-top: 1px solid #e6e9f0;
}
</style>
