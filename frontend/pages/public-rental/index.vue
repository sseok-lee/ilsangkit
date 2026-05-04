<template>
  <div class="bg-background-light">
    <div class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100">
      <div class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">공공임대 매물</h1>
        <p class="mt-2 text-slate-500 text-sm">LH·SH 등 공공기관이 운영하는 수시모집 매물 카탈로그입니다. 청약통장 없이 자격만 맞으면 신청할 수 있습니다.</p>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6 space-y-6">
      <div class="flex flex-wrap gap-2 overflow-x-auto md:overflow-visible">
        <NuxtLink
          v-for="(meta, slug) in LH_RENTAL_TYPES"
          :key="slug"
          :to="`/public-rental/${slug}`"
          class="px-4 py-2 rounded-lg font-medium text-sm bg-white text-slate-700 border border-slate-200 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors whitespace-nowrap"
        >
          {{ meta.label }}
        </NuxtLink>
      </div>

      <PublicRentalListView />

      <DataSourceCard :source="PUBLIC_RENTAL_DATA_SOURCE" />
      <p class="-mt-3 px-1 text-xs text-slate-500 leading-relaxed">
        공공임대 매물 정보는 각 공급기관(LH, SH 등)의 공고를 가공한 자료입니다.
        최신 모집 일정과 자격 조건은 반드시 해당 기관 공고문을 확인하세요.
      </p>
    </main>
  </div>
</template>

<script setup lang="ts">
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { LH_RENTAL_TYPES } from '~/utils/subscriptionMeta'
import { PUBLIC_RENTAL_DATA_SOURCE } from '~/utils/dataSource'
import DataSourceCard from '~/components/common/DataSourceCard.vue'
import { useStructuredData } from '~/composables/useStructuredData'

const title = '공공임대 매물 | 일상킷'
const description = 'LH·SH 등 공공기관이 운영하는 매입임대·전세임대 매물 정보를 한눈에 비교하세요. 청약통장 없이 자격만 맞으면 수시 신청할 수 있는 공공 직접 공급 매물입니다.'
const canonicalUrl = `${SITE_URL}/public-rental`

useHead({
  title,
  meta: [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: DEFAULT_OG_IMAGE },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:locale', content: 'ko_KR' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: DEFAULT_OG_IMAGE },
  ],
  link: [{ rel: 'canonical', href: canonicalUrl }],
})

const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약·임대', url: `${SITE_URL}/subscription` },
  { name: '공공임대', url: canonicalUrl },
])

setItemListSchema([
  { name: '매입임대', url: '/public-rental/buy-lease' },
  { name: '전세임대', url: '/public-rental/charter' },
])
</script>
