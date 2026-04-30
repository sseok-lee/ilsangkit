<template>
  <div class="bg-background-light">
    <div class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100">
      <div class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">임대 청약</h1>
        <p class="mt-2 text-slate-500 text-sm">청약통장으로 접수하는 임대 청약을 청약홈 임대 청약과 LH 청약공고로 나눠 안내합니다. (LH 매입·전세임대는 <NuxtLink to="/public-rental" class="text-amber-600 hover:underline">LH 임대</NuxtLink>에서 확인하세요.)</p>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6 space-y-8">
      <section
        v-for="group in groups"
        :key="group"
        class="space-y-3"
        :data-test-group="group"
      >
        <header>
          <h2 class="text-xl font-bold text-slate-900">{{ RENT_GROUP_META[group].heading }}</h2>
          <p class="mt-1 text-sm text-slate-500">{{ RENT_GROUP_META[group].description }}</p>
        </header>

        <div class="flex flex-wrap gap-2 overflow-x-auto md:overflow-visible">
          <NuxtLink
            v-for="[slug, meta] in rentTypesByGroup(group)"
            :key="slug"
            :to="`/subscription/rent/${slug}`"
            class="px-4 py-2 rounded-lg font-medium text-sm bg-white text-slate-700 border border-slate-200 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors whitespace-nowrap"
          >
            {{ meta.label }}
          </NuxtLink>
        </div>
      </section>

      <SubscriptionListView category="rent" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { RENT_GROUP_META, rentTypesByGroup, type RentGroup } from '~/utils/subscriptionMeta'
import { useStructuredData } from '~/composables/useStructuredData'

const groups: RentGroup[] = ['apply']

const title = '임대 청약 일정 - 공공임대·LH 임대 청약 정보 | 일상킷'
const description = '청약통장으로 접수하는 청약홈 임대청약(공공/민간)과 LH 분양·임대 공고를 한 곳에서 비교하세요.'
const canonicalUrl = `${SITE_URL}/subscription/rent`

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

const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
  { name: '임대', url: canonicalUrl },
])

setItemListSchema([
  { name: '공공임대 청약', url: '/subscription/rent/public' },
  { name: '민간임대 청약', url: '/subscription/rent/private' },
])
</script>
