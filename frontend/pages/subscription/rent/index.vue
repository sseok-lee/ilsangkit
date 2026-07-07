<template>
  <div class="bg-background-light">
    <div class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100">
      <div class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">임대 청약</h1>
        <p class="mt-2 text-slate-500 text-sm">청약통장으로 접수하는 공공임대 청약과 공공지원 민간임대 청약 일정을 안내합니다.</p>
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
import { SITE_URL } from '~/utils/seoConstants'
import { RENT_GROUP_META, rentTypesByGroup, type RentGroup } from '~/utils/subscriptionMeta'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'

const groups: RentGroup[] = ['apply']

const { setMeta } = useFacilityMeta()
setMeta({
  title: '임대 청약 일정',
  description: '청약통장으로 접수하는 청약홈 임대청약(공공/민간)과 LH 분양·임대 공고를 한 곳에서 비교하세요.',
  path: '/subscription/rent',
})

const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
  { name: '임대', url: `${SITE_URL}/subscription/rent` },
])

setItemListSchema([
  { name: '공공임대 청약', url: '/subscription/rent/public' },
  { name: '민간임대 청약', url: '/subscription/rent/private' },
])
</script>
