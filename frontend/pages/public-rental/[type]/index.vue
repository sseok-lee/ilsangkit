<template>
  <div class="bg-background-light">
    <div class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100">
      <div class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">{{ typeMeta.label }}</h1>
        <p class="mt-2 text-slate-500 text-sm">{{ typeMeta.description }}</p>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6 space-y-6">
      <PublicRentalFilterTabs :active="type" />

      <PublicRentalListView :rental-type-code="typeMeta.rentalTypeCode" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { LH_RENTAL_TYPES, type LhRentalTypeKey } from '~/utils/subscriptionMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import PublicRentalFilterTabs from '~/components/publicRental/PublicRentalFilterTabs.vue'

const route = useRoute()
const type = route.params.type as string

const typeMeta = LH_RENTAL_TYPES[type as LhRentalTypeKey]
if (!typeMeta) {
  throw createError({ statusCode: 404, statusMessage: '존재하지 않는 공공임대 카테고리입니다' })
}

const title = `${typeMeta.label} | 공공임대 | 일상킷`
const description = `${typeMeta.label} - ${typeMeta.description}`
const canonicalUrl = `${SITE_URL}/public-rental/${type}`

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
    { name: 'twitter:image', content: DEFAULT_OG_IMAGE },
  ],
  link: [{ rel: 'canonical', href: canonicalUrl }],
})

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '공공임대', url: `${SITE_URL}/public-rental` },
  { name: typeMeta.label, url: canonicalUrl },
])
</script>
