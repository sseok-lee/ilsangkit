<template>
  <div class="bg-background-light min-h-screen">
    <main class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <PageHero
        eyebrow="부동산 지역"
        :title="heroTitle"
        :description="heroDescription"
      />

      <SectionBlock :subtext="`${cityName} 내 구/군을 선택하면 단지 목록을 확인할 수 있습니다.`">
        <template #heading>
          <h2 class="text-base md:text-lg font-bold text-slate-900 leading-tight">{{ cityName }} 구/군 목록</h2>
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

      <AdBanner />

      <DataSourceCard :source="REAL_ESTATE_DATA_SOURCE" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP, REGIONS } from '~/shared/regionSlugs'
import { isRealEstateUrlType } from '~/utils/realEstateUrl'
import { PROPERTY_TYPE_META } from '~/utils/realEstateMeta'
import type { RealEstatePropertyType, TransactionMode } from '~/types/realEstate'
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { REAL_ESTATE_DATA_SOURCE } from '~/utils/dataSource'
import { useStructuredData } from '~/composables/useStructuredData'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceCard from '~/components/common/DataSourceCard.vue'

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

const districts = computed(() =>
  (REGIONS[cityName] ?? []).map((name) => ({
    name,
    url: `/real-estate/${realEstateTypeParam}/${citySlugParam}/${
      DISTRICT_SLUG_MAP[name] ?? name.toLowerCase().replace(/\s+/g, '-')
    }`,
  })),
)

const breadcrumbItems = [
  { label: '홈', href: '/', current: false },
  { label: '부동산', href: '/real-estate', current: false },
  { label: typeLabel, href: typeHubPath, current: false },
  { label: cityName, href: `/real-estate/${realEstateTypeParam}/${citySlugParam}`, current: true },
]

const canonicalUrl = `${SITE_URL}/real-estate/${realEstateTypeParam}/${citySlugParam}`

useHead({
  title: `${cityName} ${typeLabel} 실거래가 | 일상킷`,
  meta: [
    { name: 'description', content: heroDescription },
    { property: 'og:title', content: `${cityName} ${typeLabel} 실거래가 | 일상킷` },
    { property: 'og:description', content: heroDescription },
    { property: 'og:image', content: DEFAULT_OG_IMAGE },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:locale', content: 'ko_KR' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: `${cityName} ${typeLabel} 실거래가 | 일상킷` },
    { name: 'twitter:description', content: heroDescription },
    { name: 'twitter:image', content: DEFAULT_OG_IMAGE },
  ],
  link: [{ rel: 'canonical', href: canonicalUrl }],
})

const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산', url: '/real-estate' },
  { name: typeLabel, url: typeHubPath },
  { name: cityName, url: `/real-estate/${realEstateTypeParam}/${citySlugParam}` },
])
setItemListSchema(
  districts.value.map((d) => ({ name: d.name, url: d.url })),
)
</script>
