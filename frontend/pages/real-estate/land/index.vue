<template>
  <div class="bg-background-light">
    <main class="mx-auto max-w-[1200px] px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <PageHero
        eyebrow="부동산"
        :title="LAND_META.label + ' 실거래가'"
        :description="LAND_META.description"
      />

      <SectionBlock subtext="조회할 지역을 선택하세요.">
        <template #heading>
          <h2 class="text-display-3 text-slate-900">시·도별 토지 실거래가</h2>
        </template>
        <div v-if="hub && hub.cities.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <HardLink
            v-for="city in hub.cities"
            :key="city.slug"
            :to="`/real-estate/land/${city.slug}`"
            class="group bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2 shadow-sm hover:shadow-md hover:border-primary/30 transition-[box-shadow,border-color] duration-200 ease-out block"
          >
            <span class="text-display-3 text-slate-800">{{ city.city }}</span>
            <span class="text-caption text-slate-500">색인 동 {{ city.indexableDongCount.toLocaleString('ko-KR') }}개</span>
            <span class="text-caption text-slate-500">거래 {{ city.totalTransactions.toLocaleString('ko-KR') }}건</span>
          </HardLink>
        </div>
        <div v-else class="text-sm text-slate-500">지역 데이터를 불러오는 중입니다.</div>
      </SectionBlock>

      <!-- Ad: 시·도 카드 그리드 후 -->
      <AdBanner />

      <SectionBlock>
        <template #heading>
          <h2 class="text-display-3 text-slate-900">자주 묻는 질문</h2>
        </template>
        <div class="space-y-3">
          <details
            v-for="(faq, index) in LAND_FAQ"
            :key="index"
            class="rounded-xl bg-white border border-slate-200 overflow-hidden"
          >
            <summary class="flex items-center justify-between px-5 py-4 cursor-pointer text-slate-800 font-medium text-sm hover:bg-slate-50 transition-colors list-none">
              {{ faq.q }}
              <span class="material-symbols-outlined text-slate-500 text-lg flex-shrink-0 ml-3">expand_more</span>
            </summary>
            <div class="px-5 pb-4 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-3">
              {{ faq.a }}
            </div>
          </details>
        </div>
      </SectionBlock>

      <!-- Ad: 쿠팡 (페이지 맨 아래) -->
      <CoupangBanner />

      <section>
        <DataSourceSection domain="real-estate" />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useLand } from '~/composables/useLand'
import { LAND_META, LAND_FAQ, buildLandRegionTitle } from '~/utils/landMeta'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import HardLink from '~/components/common/HardLink.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'

const { data: hub } = await useAsyncData(
  'land-hub',
  async () => {
    try {
      return await useLand().getHubSummary()
    } catch {
      return null
    }
  },
  { default: () => null },
)

const { setMeta } = useFacilityMeta()
setMeta({
  title: buildLandRegionTitle({}),
  description: LAND_META.description,
  path: '/real-estate/land',
})

const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
  { name: '토지 실거래가', url: '/real-estate/land' },
])

// hub is resolved by the time script setup completes (useAsyncData is awaited above),
// but we guard for null in case of SSR fetch failure.
const cityItems = hub.value?.cities.map((c) => ({ name: `${c.city} 토지`, url: `/real-estate/land/${c.slug}` })) ?? []
setItemListSchema(cityItems)
</script>
