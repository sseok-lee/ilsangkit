<template>
  <div class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <nav class="text-xs text-slate-400 mb-3">
      <HardLink to="/" class="hover:underline">홈</HardLink> ›
      <HardLink to="/real-estate" class="hover:underline">부동산</HardLink> ›
      {{ typeLabel }} 시세 순위
    </nav>

    <h1 class="text-2xl font-bold text-slate-900">{{ typeLabel }} 시세 순위</h1>
    <p class="text-sm text-slate-500 mt-2 leading-relaxed">{{ meta.description }}</p>

    <!-- 핫스팟 카드 (상승/하락/거래급증) -->
    <div class="grid gap-4 mt-5 md:grid-cols-3">
      <template v-if="!isRentMode">
        <HotspotCard
          signal="rising"
          :regions="bundle.rising"
          :property-type="propertyType"
          :txn-type="txnType"
        />
        <HotspotCard
          signal="falling"
          :regions="bundle.falling"
          :property-type="propertyType"
          :txn-type="txnType"
        />
      </template>
      <template v-else>
        <!-- rent 랜딩: 전세 상승/하락 -->
        <HotspotCard
          signal="rising"
          :regions="bundle.rising"
          :property-type="propertyType"
          txn-type="jeonse"
        />
        <HotspotCard
          signal="falling"
          :regions="bundle.falling"
          :property-type="propertyType"
          txn-type="jeonse"
        />
      </template>
      <!-- 거래 급증: 매매는 sale bundle의 active, 전세는 jeonse bundle의 active -->
      <HotspotCard
        signal="active"
        :regions="activeRegions"
        :property-type="propertyType"
        :txn-type="txnType"
      />
    </div>

    <!-- 상승 지역 내부링크 (SEO: 자치구 허브로 연결) -->
    <nav v-if="bundle.rising.length" class="mt-4 flex flex-wrap gap-2" aria-label="평당가 상승 자치구">
      <HardLink
        v-for="region in bundle.rising"
        :key="region.citySlug + region.districtSlug"
        :to="districtUrl(region)"
        class="text-xs text-primary hover:underline"
      >{{ region.district }}</HardLink>
    </nav>

    <!-- 거래량 TOP 단지 -->
    <section class="mt-8">
      <h2 class="text-lg font-bold text-slate-900 mb-3">거래량 TOP 단지</h2>
      <ol
        v-if="topComplexes.length"
        class="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100"
      >
        <li
          v-for="(b, i) in topComplexes"
          :key="b.bjdCode + b.buildingName"
          class="flex items-center gap-3 px-4 py-3"
        >
          <span class="w-5 text-center text-sm font-bold text-slate-400">{{ i + 1 }}</span>
          <HardLink
            :to="complexUrl(b)"
            class="flex-1 text-sm font-semibold text-slate-900 hover:text-primary hover:underline truncate"
          >
            {{ b.buildingName }}
          </HardLink>
          <span class="text-[11px] text-slate-400">
            {{ shortRegion(b.city, b.district) }} · {{ b.transactionCount }}건
          </span>
        </li>
      </ol>
      <p v-else class="text-sm text-slate-500 py-4">거래 데이터를 불러오는 중입니다.</p>
    </section>

    <!-- FAQ -->
    <SectionBlock v-if="faqs.length" heading="자주 묻는 질문" class="mt-8">
      <details
        v-for="(f, i) in faqs"
        :key="i"
        class="border-b border-slate-100 py-3"
      >
        <summary class="text-sm font-semibold text-slate-900 cursor-pointer">{{ f.q }}</summary>
        <p class="text-sm text-slate-600 mt-2">{{ f.a }}</p>
      </details>
    </SectionBlock>

    <DataSourceCard :source="REAL_ESTATE_DATA_SOURCE" class="mt-6" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import HotspotCard from '~/components/home/hotspot/HotspotCard.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceCard from '~/components/common/DataSourceCard.vue'
import {
  isRealEstateUrlType,
  toRealEstateUrl,
  toRealEstateListUrl,
  type RealEstateUrlType,
} from '~/utils/realEstateUrl'
import { RANKING_META, RANKING_FAQ } from '~/utils/realEstateMeta'
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { REAL_ESTATE_DATA_SOURCE } from '~/utils/dataSource'
import { useRealEstate } from '~/composables/useRealEstate'
import { useStructuredData } from '~/composables/useStructuredData'
import type { RealEstatePropertyType } from '~/types/realEstate'
import type { HotspotRegion, HotspotBundle, WolseHotspotBundle } from '~/composables/useHomeDashboard'

const route = useRoute()
const realEstateType = computed(() => String(route.params.realEstateType))

// 유효성 검사: 잘못된 타입은 404
if (!isRealEstateUrlType(realEstateType.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const reType = realEstateType.value as RealEstateUrlType
const segments = reType.split('-') as [string, string]
const property = segments[0] as RealEstatePropertyType
const mode = segments[1] as 'sale' | 'rent'

const propertyType = property
const isRentMode = mode === 'rent'
// rent 랜딩은 전세 카드 기준 (6슬러그에 wolse 전용 없음 → jeonse 우선)
const txnType = computed<'sale' | 'jeonse' | 'wolse'>(() =>
  mode === 'sale' ? 'sale' : 'jeonse',
)

const meta = RANKING_META[reType]
const faqs = RANKING_FAQ[reType]
const typeLabel = computed(() => meta.title.split(' 시세')[0])

const apiBase = useApiBase()
const { getComplexList } = useRealEstate()

const { data } = await useAsyncData(`re-ranking-${reType}`, async () => {
  const [hotspotRes, complexRes] = await Promise.all([
    $fetch<{ success: boolean; data: any }>(`${apiBase}/api/meta/hotspots`, {
      query: { propertyType },
    }),
    getComplexList(reType, undefined, undefined, undefined, 1, 10),
  ])
  return {
    hotspots: hotspotRes?.data ?? null,
    complexes: complexRes?.items ?? [],
  }
})

const EMPTY_BUNDLE: HotspotBundle = { rising: [], falling: [], active: [] }

const bundle = computed<HotspotBundle>(() => {
  const h = data.value?.hotspots
  if (!h) return EMPTY_BUNDLE
  if (mode === 'sale') return h.sale ?? EMPTY_BUNDLE
  // rent 랜딩은 jeonse 카드를 주 표시
  return h.jeonse ?? EMPTY_BUNDLE
})

// 거래 급증 지역: sale은 sale.active, rent는 jeonse.active (wolse.active 추가 노출)
const activeRegions = computed<HotspotRegion[]>(() => {
  const h = data.value?.hotspots
  if (!h) return []
  if (mode === 'sale') return h.sale?.active ?? []
  // rent 랜딩: jeonse active + wolse active 합산 (중복 제거 없이 순서대로)
  const jeonseActive = h.jeonse?.active ?? []
  const wolseActive: HotspotRegion[] = (h.wolse as WolseHotspotBundle)?.active ?? []
  return [...jeonseActive, ...wolseActive]
})

const topComplexes = computed(() => data.value?.complexes ?? [])

const CITY_SHORT: Record<string, string> = {
  서울특별시: '서울',
  부산광역시: '부산',
  대구광역시: '대구',
  인천광역시: '인천',
  광주광역시: '광주',
  대전광역시: '대전',
  울산광역시: '울산',
  세종특별자치시: '세종',
  경기도: '경기',
  강원특별자치도: '강원',
  충청북도: '충북',
  충청남도: '충남',
  전북특별자치도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  제주특별자치도: '제주',
}

function shortRegion(city: string, district: string): string {
  return `${CITY_SHORT[city] ?? city} ${district}`
}

function complexUrl(b: { city: string; district: string; buildingName: string }): string {
  return toRealEstateUrl({
    type: reType,
    city: b.city,
    district: b.district,
    buildingName: b.buildingName,
  })
}

function districtUrl(region: HotspotRegion): string {
  return toRealEstateListUrl({
    type: reType,
    city: region.citySlug,
    district: region.districtSlug,
  })
}

// thin 가드: 시그널 합계가 부족하면 noindex,follow
const signalCount = computed(
  () =>
    bundle.value.rising.length +
    bundle.value.falling.length +
    activeRegions.value.length +
    topComplexes.value.length,
)
const isThin = computed(() => signalCount.value < 5)

const canonicalUrl = `${SITE_URL}/real-estate/ranking/${reType}`

useHead(() => ({
  title: meta.title,
  meta: [
    { name: 'description', content: meta.description },
    { property: 'og:title', content: meta.title },
    { property: 'og:description', content: meta.description },
    { property: 'og:image', content: DEFAULT_OG_IMAGE },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: SITE_NAME },
    ...(isThin.value ? [{ name: 'robots', content: 'noindex, follow' }] : []),
  ],
  link: isThin.value ? [] : [{ rel: 'canonical', href: canonicalUrl }],
}))

const { setBreadcrumbSchema, setItemListSchema, setDatasetSchema, setFAQSchema } =
  useStructuredData()

setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '부동산', url: `${SITE_URL}/real-estate` },
  { name: `${typeLabel.value} 시세 순위`, url: canonicalUrl },
])

setFAQSchema(faqs.map((f) => ({ question: f.q, answer: f.a })))

setDatasetSchema({
  name: `${typeLabel.value} 시세 순위`,
  description: meta.description,
  url: canonicalUrl,
  sources: [REAL_ESTATE_DATA_SOURCE],
  keywords: [typeLabel.value, '시세 순위', '평당가', '실거래가'],
})

if (topComplexes.value.length) {
  setItemListSchema(
    topComplexes.value.map((b, i) => ({
      name: b.buildingName,
      url: `${SITE_URL}${complexUrl(b)}`,
      position: i + 1,
      type: 'Apartment' as const,
      address: {
        addressLocality: b.district,
        addressRegion: b.city,
      },
    })),
    { name: `${typeLabel.value} 거래량 TOP 단지`, key: 'jsonld-ranking-complexes' },
  )
}
</script>
