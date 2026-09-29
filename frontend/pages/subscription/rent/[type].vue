<template>
  <div class="bg-white">
    <div class="mx-auto max-w-6xl px-4 pb-5 pt-8 md:flex md:items-end md:justify-between md:gap-8 md:px-6 md:pb-7 md:pt-10">
      <div>
        <h1 class="text-[27px] md:text-[36px] leading-tight font-bold text-slate-900">{{ typeMeta.label }}</h1>
        <p class="mt-3 text-slate-600 text-sm md:text-base">{{ typeMeta.description }}</p>
      </div>
      <p class="mt-3 text-left text-xs text-slate-500 md:mt-0 md:shrink-0 md:text-right md:text-sm">
        <strong class="font-semibold text-slate-900 md:block md:text-lg">청약홈 · 마이홈 · LH</strong>
        <span class="md:block">공개 자료 기준</span>
      </p>
    </div>
    <div class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
      <SubscriptionListView
        v-if="dataSource === 'integrated'"
        :scope="scope"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SITE_URL } from '~/utils/seoConstants'
import { RENT_TYPES } from '~/utils/subscriptionMeta'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { isSubscriptionListQueryFiltered, subscriptionListHead } from '~/utils/subscriptionListHead'

const route = useRoute()
const type = computed(() => route.params.type as string)

const typeMeta = computed(() => RENT_TYPES[type.value])
if (!typeMeta.value) {
  throw createError({ statusCode: 404, statusMessage: '존재하지 않는 임대 카테고리입니다' })
}

const dataSource = computed(() => typeMeta.value.dataSource ?? 'integrated')
const scope = computed(() => ({
  category: 'rent' as const,
  type: type.value,
  sourceType: typeMeta.value.sourceType,
  rentType: typeMeta.value.rentType,
}))
const filtered = computed(() => isSubscriptionListQueryFiltered(route.query, scope.value))

const { setMeta } = useFacilityMeta()
setMeta({
  title: typeMeta.value.label,
  description: `${typeMeta.value.label} - ${typeMeta.value.description}`,
  path: `/subscription/rent/${type.value}`,
  canonical: false,
})

useHead(() => subscriptionListHead(route.path, filtered.value))

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
  { name: '임대', url: `${SITE_URL}/subscription/rent` },
  { name: typeMeta.value.label, url: `${SITE_URL}/subscription/rent/${type.value}` },
])
</script>
