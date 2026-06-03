<template>
  <div class="bg-background-light">
    <div class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100">
      <div class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">{{ typeMeta.label }} 분양 청약</h1>
        <p class="mt-2 text-slate-500 text-sm">{{ typeMeta.description }}</p>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
      <!-- Sub-category Tabs -->
      <div class="mb-4 flex flex-wrap gap-2">
        <NuxtLink
          to="/subscription/sale"
          class="px-4 py-2 rounded-lg font-medium text-sm bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          전체
        </NuxtLink>
        <NuxtLink
          v-for="(meta, slug) in SALE_TYPES"
          :key="slug"
          :to="`/subscription/sale/${slug}`"
          :class="['px-4 py-2 rounded-lg font-medium text-sm transition-colors', slug === type ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50']"
        >
          {{ meta.label }}
        </NuxtLink>
      </div>

      <SubscriptionListView
        :source-type="typeMeta.sourceType"
        :rent-type="typeMeta.rentType"
      />

      <!-- 데이터 출처 -->
      <DataSourceSection domain="subscription" class="mt-6" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { SALE_TYPES } from '~/utils/subscriptionMeta'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'

const route = useRoute()
const type = route.params.type as string

const typeMeta = SALE_TYPES[type]
if (!typeMeta) {
  throw createError({ statusCode: 404, statusMessage: '존재하지 않는 청약 카테고리입니다' })
}

const { setMeta } = useFacilityMeta()
setMeta({
  title: `${typeMeta.label} 분양 청약 일정`,
  description: `${typeMeta.label} 분양 청약 일정과 접수 상태, 공급 정보를 확인하세요.`,
  path: `/subscription/sale/${type}`,
})

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
  { name: '분양', url: `${SITE_URL}/subscription/sale` },
  { name: typeMeta.label, url: canonicalUrl },
])
</script>
