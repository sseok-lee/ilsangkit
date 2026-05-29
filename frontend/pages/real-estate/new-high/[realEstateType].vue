<template>
  <div class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <nav class="text-xs text-slate-400 mb-3">
      <HardLink to="/" class="hover:underline">홈</HardLink> ›
      <HardLink to="/real-estate" class="hover:underline">부동산</HardLink> ›
      {{ typeLabel }} 신고가 경신 단지
    </nav>

    <h1 class="text-2xl font-bold text-slate-900">{{ typeLabel }} 신고가 경신 단지</h1>
    <p class="text-sm text-slate-500 mt-2 leading-relaxed">{{ meta.description }}</p>

    <!-- 기준일 표시 -->
    <p v-if="asOfYmFormatted" class="text-xs text-slate-400 mt-1">
      최근 신고된 거래 기준: {{ asOfYmFormatted }}
    </p>

    <!-- 신고가 경신 단지 TOP -->
    <section class="mt-8">
      <h2 class="text-lg font-bold text-slate-900 mb-3">신고가 경신 단지 TOP</h2>
      <ol
        v-if="items.length"
        class="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100"
      >
        <li
          v-for="(item, i) in items"
          :key="item.bjdCode + item.buildingName + item.areaBucket"
          class="flex items-start gap-3 px-4 py-3"
        >
          <span class="w-5 text-center text-sm font-bold text-slate-400 mt-0.5">{{ i + 1 }}</span>
          <div class="flex-1 min-w-0">
            <HardLink
              :to="complexUrl(item)"
              class="text-sm font-semibold text-slate-900 hover:text-primary hover:underline truncate block"
            >
              {{ item.buildingName }}
            </HardLink>
            <span class="text-[11px] text-slate-400">
              {{ item.city }} {{ item.district }} · {{ item.areaBucket }}㎡대
            </span>
          </div>
          <div class="text-right shrink-0">
            <div class="text-sm font-bold text-rose-600">{{ formatPriceManwon(item.curMax) }}</div>
            <div class="text-[11px] text-slate-400">+{{ item.risePct }}%</div>
          </div>
        </li>
      </ol>
      <p v-else class="text-sm text-slate-500 py-4">최근 신고가 경신 단지가 없습니다.</p>
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
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceCard from '~/components/common/DataSourceCard.vue'
import { toRealEstateUrl, type RealEstateUrlType } from '~/utils/realEstateUrl'
import { NEW_HIGH_META, NEW_HIGH_FAQ, NEW_HIGH_TYPES, RANKING_TYPE_LABEL } from '~/utils/realEstateMeta'
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { REAL_ESTATE_DATA_SOURCE } from '~/utils/dataSource'
import { useStructuredData } from '~/composables/useStructuredData'
import { formatPriceManwon } from '~/utils/priceFormat'

const route = useRoute()
const realEstateType = computed(() => String(route.params.realEstateType))

// 유효성 검사: 매매 3슬러그만 유효, 그 외 404
if (!(NEW_HIGH_TYPES as readonly string[]).includes(realEstateType.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const reType = realEstateType.value as typeof NEW_HIGH_TYPES[number]

const meta = NEW_HIGH_META[reType]
const faqs = NEW_HIGH_FAQ[reType]
const typeLabel = RANKING_TYPE_LABEL[reType as RealEstateUrlType]

const apiBase = useApiBase()

const { data } = await useAsyncData(`re-new-high-${reType}`, () =>
  $fetch<{ success: boolean; data: { items: NewHighItem[]; asOfYm: number | null } }>(
    `${apiBase}/api/real-estate/new-high`,
    { query: { propertyType: reType } },
  ),
)

interface NewHighItem {
  buildingName: string
  city: string
  district: string
  bjdCode: string
  areaBucket: number
  curMax: number
  histMax: number
  risePct: number
  priorCnt: number
  curYm: number
}

const items = computed<NewHighItem[]>(() => data.value?.data?.items ?? [])
const asOfYm = computed<number | null>(() => data.value?.data?.asOfYm ?? null)

// asOfYm 202603 → '2026.03'
const asOfYmFormatted = computed<string | null>(() => {
  const ym = asOfYm.value
  if (!ym) return null
  const y = Math.floor(ym / 100)
  const m = String(ym % 100).padStart(2, '0')
  return `${y}.${m}`
})

function complexUrl(item: NewHighItem): string {
  return toRealEstateUrl({
    type: reType,
    city: item.city,
    district: item.district,
    buildingName: item.buildingName,
  })
}

// 빈 결과면 noindex,follow
const isEmpty = computed(() => items.value.length === 0)

const canonicalUrl = `${SITE_URL}/real-estate/new-high/${reType}`

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
    ...(isEmpty.value ? [{ name: 'robots', content: 'noindex,follow' }] : []),
  ],
  link: isEmpty.value ? [] : [{ rel: 'canonical', href: canonicalUrl }],
}))

const { setBreadcrumbSchema, setItemListSchema, setDatasetSchema, setFAQSchema } =
  useStructuredData()

setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '부동산', url: `${SITE_URL}/real-estate` },
  { name: `${typeLabel} 신고가 경신 단지`, url: canonicalUrl },
])

setFAQSchema(faqs.map((f) => ({ question: f.q, answer: f.a })))

setDatasetSchema({
  name: `${typeLabel} 신고가 경신 단지`,
  description: meta.description,
  url: canonicalUrl,
  sources: [REAL_ESTATE_DATA_SOURCE],
  keywords: [typeLabel, '신고가', '실거래가', '전고점'],
})

if (items.value.length) {
  setItemListSchema(
    items.value.map((item, i) => ({
      name: item.buildingName,
      url: `${SITE_URL}${complexUrl(item)}`,
      position: i + 1,
      type: 'Apartment' as const,
      address: {
        addressLocality: item.district,
        addressRegion: item.city,
      },
    })),
    { name: `${typeLabel} 신고가 경신 단지 TOP`, key: 'jsonld-new-high-complexes' },
  )
}
</script>
