<template>
  <div class="bg-background-light">
    <div class="bg-gradient-to-b from-background-light to-background-light border-b border-line">
      <div class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
        <h1 class="text-2xl md:text-3xl font-bold text-strong">{{ typeMeta.label }}</h1>
        <p class="mt-2 text-muted text-sm">{{ typeMeta.description }}</p>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6 space-y-6">
      <PublicRentalFilterTabs :active="type" />

      <PublicRentalListView :rental-type-code="typeMeta.rentalTypeCode" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { SITE_URL } from '~/utils/seoConstants'
import { LH_RENTAL_TYPES, type LhRentalTypeKey } from '~/utils/subscriptionMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import PublicRentalFilterTabs from '~/components/publicRental/PublicRentalFilterTabs.vue'

const route = useRoute()
const type = route.params.type as string

const typeMeta = LH_RENTAL_TYPES[type as LhRentalTypeKey]
if (!typeMeta) {
  throw createError({ statusCode: 404, statusMessage: '존재하지 않는 공공임대 카테고리입니다' })
}

const { setMeta } = useFacilityMeta()

setMeta({
  title: typeMeta.label,
  description: `${typeMeta.label} - ${typeMeta.description}`,
  path: `/public-rental/${type}`,
})

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '공공임대', url: `${SITE_URL}/public-rental` },
  { name: typeMeta.label, url: `${SITE_URL}/public-rental/${type}` },
])
</script>
