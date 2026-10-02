<template>
  <div class="bg-white">
    <div class="page-container pb-5 pt-8 md:flex md:items-end md:justify-between md:gap-8 md:pb-7 md:pt-10">
      <div>
        <h1 class="text-[27px] md:text-[36px] leading-tight font-bold text-ink">{{ typeMeta.label }} 분양 청약</h1>
        <p class="mt-3 text-muted text-sm md:text-base">{{ typeMeta.description }}</p>
      </div>
      <p class="mt-3 text-left text-xs text-muted md:mt-0 md:shrink-0 md:text-right md:text-sm">
        <strong class="font-semibold text-ink md:block md:text-lg">한국부동산원 청약홈</strong>
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
import { SALE_TYPES } from '~/utils/subscriptionMeta'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { isSubscriptionListQueryFiltered, subscriptionListHead } from '~/utils/subscriptionListHead'

const route = useRoute()
const type = computed(() => route.params.type as string)

const typeMeta = computed(() => SALE_TYPES[type.value])
if (!typeMeta.value) {
  throw createError({ statusCode: 404, statusMessage: '존재하지 않는 청약 카테고리입니다' })
}

const scope = computed(() => ({
  category: 'sale' as const,
  type: type.value,
  sourceType: typeMeta.value.sourceType,
}))
const filtered = computed(() => isSubscriptionListQueryFiltered(route.query, scope.value))

const { setMeta } = useFacilityMeta()
setMeta({
  title: `${typeMeta.value.label} 분양 청약 일정`,
  description: `${typeMeta.value.label} 분양 청약 일정과 접수 상태, 공급 정보를 확인하세요.`,
  path: `/subscription/sale/${type.value}`,
  canonical: false,
})

useHead(() => subscriptionListHead(route.path, filtered.value))

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
  { name: '분양', url: `${SITE_URL}/subscription/sale` },
  { name: typeMeta.value.label, url: `${SITE_URL}/subscription/sale/${type.value}` },
])
</script>
