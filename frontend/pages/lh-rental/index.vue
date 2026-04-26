<template>
  <div class="bg-background-light">
    <div class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100">
      <div class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">LH 매입·전세임대</h1>
        <p class="mt-2 text-slate-500 text-sm">LH 가 운영하는 수시모집 매물 카탈로그입니다. 청약통장 없이 자격만 맞으면 신청할 수 있습니다.</p>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6 space-y-6">
      <div class="flex flex-wrap gap-2 overflow-x-auto md:overflow-visible">
        <NuxtLink
          v-for="(meta, slug) in LH_RENTAL_TYPES"
          :key="slug"
          :to="`/lh-rental/${slug}`"
          class="px-4 py-2 rounded-lg font-medium text-sm bg-white text-slate-700 border border-slate-200 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors whitespace-nowrap"
        >
          {{ meta.label }}
        </NuxtLink>
      </div>

      <PublicRentalListView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { LH_RENTAL_TYPES } from '~/utils/subscriptionMeta'
import { useStructuredData } from '~/composables/useStructuredData'

const title = 'LH 매입·전세임대 매물 | 일상킷'
const description = 'LH 매입임대·전세임대 매물 정보를 한눈에 비교하세요. 청약통장 없이 자격만 맞으면 수시 신청할 수 있는 LH 직접 공급 매물입니다.'
const canonicalUrl = `${SITE_URL}/lh-rental`

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
  { name: 'LH 임대', url: canonicalUrl },
])

setItemListSchema([
  { name: 'LH 매입임대', url: '/lh-rental/buy-lease' },
  { name: 'LH 전세임대', url: '/lh-rental/charter' },
])
</script>
