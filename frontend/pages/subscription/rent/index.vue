<template>
  <div class="bg-white">
    <div class="page-container pb-5 pt-8 md:flex md:items-end md:justify-between md:gap-8 md:pb-7 md:pt-10">
      <div>
        <h1 class="text-[27px] md:text-[36px] leading-tight font-bold text-ink">임대주택 모집공고</h1>
        <p class="mt-3 text-muted text-sm md:text-base">공공임대부터 공공지원 민간임대까지, 지역별로 찾아보세요.</p>
      </div>
      <p class="mt-3 text-left text-xs text-muted md:mt-0 md:shrink-0 md:text-right md:text-sm">
        <strong class="font-semibold text-ink md:block md:text-lg">청약홈 · 마이홈 · LH</strong>
        <span class="md:block">공개 자료 기준</span>
      </p>
    </div>
    <div class="page-container py-5 md:py-6">
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
const scope = { category: 'rent' as const }
const filtered = computed(() => isSubscriptionListQueryFiltered(route.query, scope))

const { setMeta } = useFacilityMeta()
setMeta({
  title: '임대 청약 일정',
  description: '청약홈·마이홈·LH 공공임대와 공공지원 민간임대 모집공고를 한 곳에서 비교하세요.',
  path: '/subscription/rent',
  canonical: false,
})

useHead(() => subscriptionListHead(route.path, filtered.value))

const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
  { name: '임대', url: `${SITE_URL}/subscription/rent` },
])

setItemListSchema([
  { name: '공공임대 청약', url: '/subscription/rent/public' },
  { name: '공공지원 민간임대', url: '/subscription/rent/private' },
])
</script>
