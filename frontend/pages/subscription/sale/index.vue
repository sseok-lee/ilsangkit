<template>
  <div class="bg-white">
    <div class="page-container pt-3 md:pt-5">
      <PageHead title="분양 청약 공고" description="아파트·오피스텔·무순위 청약의 접수기간을 비교하세요.">
        <template #actions>
          <p class="text-right text-xs text-muted md:text-sm">
            <strong class="block font-semibold text-ink md:text-lg">한국부동산원 청약홈</strong>
            <span class="block">공개 자료 기준</span>
          </p>
        </template>
      </PageHead>
    </div>
    <div class="page-container py-5 md:py-6">
      <SubscriptionListView :scope="scope" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHead from '~/components/common/PageHead.vue'
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
