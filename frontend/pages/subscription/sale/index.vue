<template>
  <div class="bg-background-light">
    <div class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100">
      <div class="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">분양 청약</h1>
        <p class="mt-2 text-slate-500 text-sm">아파트·오피스텔·무순위 분양 청약 일정과 정보를 조회하세요.</p>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <!-- Sub-category Tabs -->
      <div class="mb-6 flex flex-wrap gap-2">
        <NuxtLink
          to="/subscription/sale"
          :class="['px-4 py-2 rounded-lg font-medium text-sm transition-colors', !activeType ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50']"
        >
          전체
        </NuxtLink>
        <NuxtLink
          v-for="(meta, slug) in SALE_TYPES"
          :key="slug"
          :to="`/subscription/sale/${slug}`"
          class="px-4 py-2 rounded-lg font-medium text-sm bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          {{ meta.label }}
        </NuxtLink>
      </div>

      <SubscriptionListView category="sale" :breadcrumb-label="'분양'" :breadcrumb-path="'/subscription/sale'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { SALE_TYPES } from '~/utils/subscriptionMeta'
import { useStructuredData } from '~/composables/useStructuredData'

const activeType = null

const title = '분양 아파트·오피스텔·무순위 청약 일정 조회 | 일상킷'
const description = '아파트, 오피스텔, 무순위·잔여세대 분양 청약 접수 일정과 분양정보를 한눈에 조회하세요. 접수예정·진행중·마감 상태별 필터와 지역별 검색을 지원합니다.'
const canonicalUrl = `${SITE_URL}/subscription/sale`

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
  ],
  link: [{ rel: 'canonical', href: canonicalUrl }],
})

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
  { name: '분양', url: canonicalUrl },
])
</script>
