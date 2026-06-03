<template>
  <div class="bg-background-light">
    <div class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100">
      <div class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">{{ typeMeta.label }}</h1>
        <p class="mt-2 text-slate-500 text-sm">{{ typeMeta.description }}</p>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6 space-y-6">
      <!-- Sub-category Tabs (분양 페이지와 동일한 스타일) -->
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          to="/subscription/rent"
          class="px-4 py-2 rounded-lg font-medium text-sm bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          전체
        </NuxtLink>
        <NuxtLink
          v-for="(meta, slug) in RENT_TYPES"
          :key="slug"
          :to="`/subscription/rent/${slug}`"
          :class="['px-4 py-2 rounded-lg font-medium text-sm transition-colors', slug === type ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50']"
        >
          {{ meta.label }}
        </NuxtLink>
      </div>

      <SubscriptionListView
        v-if="dataSource === 'applyhome'"
        :source-type="typeMeta.sourceType"
        :rent-type="typeMeta.rentType"
      />
      <PublicRentalListView
        v-else-if="dataSource === 'lh-myhome'"
        :rental-type-code="typeMeta.rentalTypeCode"
      />

      <!-- 데이터 출처 -->
      <DataSourceSection domain="subscription" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { SITE_URL } from '~/utils/seoConstants'
import { RENT_TYPES } from '~/utils/subscriptionMeta'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'

const route = useRoute()
const type = route.params.type as string

const typeMeta = RENT_TYPES[type]
if (!typeMeta) {
  throw createError({ statusCode: 404, statusMessage: '존재하지 않는 임대 카테고리입니다' })
}

const dataSource = typeMeta.dataSource ?? 'applyhome'

const { setMeta } = useFacilityMeta()
setMeta({
  title: `${typeMeta.label} 임대 청약`,
  description: `${typeMeta.label} - ${typeMeta.description}`,
  path: `/subscription/rent/${type}`,
})

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
  { name: '임대', url: `${SITE_URL}/subscription/rent` },
  { name: typeMeta.label, url: `${SITE_URL}/subscription/rent/${type}` },
])
</script>
