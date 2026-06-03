<template>
  <div class="bg-background-light">
    <div class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100">
      <div class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">분양 청약</h1>
        <p class="mt-2 text-slate-500 text-sm">아파트·오피스텔·무순위 분양 청약 일정과 정보를 조회하세요.</p>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
      <!-- Sub-category Tabs -->
      <div class="mb-4 flex flex-wrap gap-2">
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
import { SITE_URL } from '~/utils/seoConstants'
import { SALE_TYPES } from '~/utils/subscriptionMeta'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'

const activeType = null

const { setMeta } = useFacilityMeta()
setMeta({
  title: '분양 청약 일정',
  description: '아파트, 오피스텔, 무순위·잔여세대 분양 청약 일정과 접수 상태, 유형별 정보를 확인하세요.',
  path: '/subscription/sale',
})

const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
  { name: '분양', url: `${SITE_URL}/subscription/sale` },
])

// ItemList schema for sale subscriptions list page
setItemListSchema([
  { name: '아파트 분양 청약', url: '/subscription/sale/apt' },
  { name: '오피스텔 분양 청약', url: '/subscription/sale/offitel' },
  { name: '무순위 분양 청약', url: '/subscription/sale/unrestricted' },
])
</script>
