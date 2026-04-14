<template>
  <div class="bg-background-light">
    <div class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100">
      <div class="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">{{ typeMeta.label }} 청약</h1>
        <p class="mt-2 text-slate-500 text-sm">{{ typeMeta.description }}</p>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <!-- Sub-category Tabs -->
      <div class="mb-6 flex flex-wrap gap-2">
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
          :class="['px-4 py-2 rounded-lg font-medium text-sm transition-colors', slug === type ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50']"
        >
          {{ meta.label }}
        </NuxtLink>
      </div>

      <SubscriptionListView
        :source-type="typeMeta.sourceType"
        :rent-type="typeMeta.rentType"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { RENT_TYPES } from '~/utils/subscriptionMeta'
import { useStructuredData } from '~/composables/useStructuredData'

const route = useRoute()
const type = route.params.type as string

const typeMeta = RENT_TYPES[type]
if (!typeMeta) {
  throw createError({ statusCode: 404, statusMessage: '존재하지 않는 청약 카테고리입니다' })
}

const title = `${typeMeta.label} 청약 일정 — 접수예정·진행중 | 일상킷`
const description = typeMeta.description
const canonicalUrl = `${SITE_URL}/subscription/rent/${type}`

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
  ],
  link: [{ rel: 'canonical', href: canonicalUrl }],
})

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
  { name: '임대', url: `${SITE_URL}/subscription/rent` },
  { name: typeMeta.label, url: canonicalUrl },
])
</script>
