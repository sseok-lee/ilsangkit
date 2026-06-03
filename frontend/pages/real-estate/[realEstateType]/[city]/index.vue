<template>
  <div class="bg-background-light min-h-screen">
    <main class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <PageHero
        eyebrow="부동산 지역"
        :title="heroTitle"
        :description="heroDescription"
      />

      <section class="bg-white border border-line rounded-xl p-4 md:p-5">
        <p class="text-sm md:text-[15px] leading-relaxed text-slate-700">{{ introParagraph }}</p>
      </section>

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
        v-if="topComplexes.length > 0"
        :subtext="`${cityName} ${typeLabel} 거래가 활발한 단지`"
      >
        <template #heading>
          <h2 class="text-display-3 text-slate-900">주요 단지</h2>
        </template>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ComplexCard
            v-for="c in topComplexes"
            :key="`${c.buildingName}-${c.bjdCode}`"
            :complex="c"
            :property-type="propertyTypePart"
            :tab="tabPart"
          />
        </div>
      </SectionBlock>

      <AdBanner />

      <DataSourceSection domain="real-estate" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP, REGIONS } from '~/shared/regionSlugs'
import { isRealEstateUrlType } from '~/utils/realEstateUrl'
import { PROPERTY_TYPE_META } from '~/utils/realEstateMeta'
import type { RealEstatePropertyType, TransactionMode, RealEstateType, ComplexInfo } from '~/types/realEstate'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useRealEstate } from '~/composables/useRealEstate'
import ComplexCard from '~/components/realEstate/ComplexCard.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'

const route = useRoute()
const realEstateTypeParam = route.params.realEstateType as string
const citySlugParam = route.params.city as string

if (!isRealEstateUrlType(realEstateTypeParam)) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const cityName = CITY_SLUG_MAP[citySlugParam]
if (!cityName) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const [propertyTypePart, tabPart] = realEstateTypeParam.split('-') as [RealEstatePropertyType, TransactionMode]
const propertyMeta = PROPERTY_TYPE_META[propertyTypePart]
const typeLabel = tabPart === 'sale'
  ? `${propertyMeta?.label ?? ''} 매매`
  : `${propertyMeta?.label ?? ''} 전월세`

const heroTitle = `${cityName} ${typeLabel} 실거래가`
const heroDescription = `${cityName} ${typeLabel} 단지를 구/군별로 확인하세요. 국토교통부 공식 데이터 기반.`
const typeHubPath = `/real-estate/${realEstateTypeParam}`
const introParagraph = `${cityName} ${typeLabel} 실거래가 정보입니다. ${propertyMeta?.description ?? ''} 아래 구/군을 선택하면 ${cityName} 내 단지별 실거래 내역과 시세 추이를 확인할 수 있습니다. 모든 데이터는 국토교통부 실거래가 공개시스템 기준이며 매일 갱신됩니다.`

const districts = computed(() =>
  (REGIONS[cityName] ?? []).map((name) => ({
    name,
    url: `/real-estate/${realEstateTypeParam}/${citySlugParam}/${
      DISTRICT_SLUG_MAP[name] ?? name.toLowerCase().replace(/\s+/g, '-')
    }`,
  })),
)

const { getComplexList } = useRealEstate()
const { data: topComplexesData } = await useAsyncData(
  `re-city-complexes-${realEstateTypeParam}-${citySlugParam}`,
  () =>
    getComplexList(realEstateTypeParam as RealEstateType, cityName, undefined, undefined, 1, 6)
      .then((r) => r.items)
      .catch(() => [] as ComplexInfo[]),
  { default: () => [] as ComplexInfo[] },
)
const topComplexes = computed(() => topComplexesData.value ?? [])

const breadcrumbItems = [
  { label: '홈', href: '/', current: false },
  { label: '부동산 실거래가', href: '/real-estate', current: false },
  { label: typeLabel, href: typeHubPath, current: false },
  { label: cityName, href: `/real-estate/${realEstateTypeParam}/${citySlugParam}`, current: true },
]

const { setMeta } = useFacilityMeta()
setMeta({
  title: `${cityName} ${typeLabel} 실거래가`,
  description: heroDescription,
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
