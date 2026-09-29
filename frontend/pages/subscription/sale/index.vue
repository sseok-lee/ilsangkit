<template>
  <div class="bg-white">
    <div class="mx-auto max-w-6xl px-4 pb-5 pt-8 md:flex md:items-end md:justify-between md:gap-8 md:px-6 md:pb-7 md:pt-10">
      <div>
        <h1 class="text-[27px] md:text-[36px] leading-tight font-bold text-slate-900">분양 청약 공고</h1>
        <p class="mt-3 text-slate-600 text-sm md:text-base">아파트·오피스텔·무순위 청약의 접수기간을 비교하세요.</p>
      </div>
      <p class="mt-3 text-left text-xs text-slate-500 md:mt-0 md:shrink-0 md:text-right md:text-sm">
        <strong class="font-semibold text-slate-900 md:block md:text-lg">한국부동산원 청약홈</strong>
        <span class="md:block">공개 자료 기준</span>
      </p>
    </div>
    <div class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
      <SubscriptionListView :scope="scope" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SITE_URL } from '~/utils/seoConstants'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { isSubscriptionListQueryFiltered, subscriptionListHead } from '~/utils/subscriptionListHead'

const route = useRoute()
const scope = { category: 'sale' as const }
const filtered = computed(() => isSubscriptionListQueryFiltered(route.query, scope))

const { setMeta } = useFacilityMeta()
setMeta({
  title: '분양 청약 일정',
  description: '아파트, 오피스텔, 무순위·잔여세대 분양 청약 일정과 접수 상태, 유형별 정보를 확인하세요.',
  path: '/subscription/sale',
  canonical: false,
})

useHead(() => subscriptionListHead(route.path, filtered.value))

const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
  { name: '분양', url: `${SITE_URL}/subscription/sale` },
])

setItemListSchema([
  { name: '아파트 분양 청약', url: '/subscription/sale/apt' },
  { name: '오피스텔 분양 청약', url: '/subscription/sale/offitel' },
  { name: '무순위 분양 청약', url: '/subscription/sale/remaining' },
])
</script>
