<template>
  <div class="property-redesign bg-white">
    <div class="mx-auto max-w-[1200px] px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <PageHero
        class="property-hero"
        eyebrow="부동산"
        :title="LAND_META.label + ' 실거래가'"
        :description="LAND_META.description"
      />

      <SectionBlock class="property-section" subtext="조회할 지역을 선택하세요.">
        <template #heading>
          <h2 class="text-display-3 text-slate-900">시·도별 토지 실거래가</h2>
        </template>
        <form class="property-search" @submit.prevent="regionSearch = regionDraft.trim()">
          <label class="sr-only" for="land-region-search">지역명 검색</label>
          <input id="land-region-search" v-model="regionDraft" placeholder="지역명 검색" maxlength="100">
          <button type="submit">검색</button>
        </form>
        <div v-if="regionCandidates.length > 0" class="property-region-list">
          <HardLink
            v-for="city in regionCandidates"
            :key="city.slug"
            :to="`/real-estate/land/${city.slug}`"
            class="property-region-link"
          >
            <span class="text-display-3 text-slate-800">{{ city.city }}</span>
            <span class="text-caption text-slate-500">거래 동 {{ city.indexableDongCount.toLocaleString('ko-KR') }}개</span>
            <span class="text-caption text-slate-500">거래 {{ city.totalTransactions.toLocaleString('ko-KR') }}건</span>
          </HardLink>
        </div>
        <div v-else-if="hubError" role="alert" class="py-8 text-sm text-muted">지역 정보를 불러오지 못했습니다. <button class="min-h-11 underline" @click="refresh()">다시 시도</button></div>
        <p v-else class="py-8 text-sm text-muted">{{ regionSearch ? '검색한 지역이 없습니다.' : '등록된 토지 거래 지역이 없습니다.' }}</p>
      </SectionBlock>

      <!-- Ad: 시·도 카드 그리드 후 -->
      <AdBanner />

      <SectionBlock class="property-section">
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


      <section>
        <DataSourceSection domain="real-estate" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStructuredData } from '~/composables/useStructuredData'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useLand } from '~/composables/useLand'
import { LAND_META, LAND_FAQ, buildLandRegionTitle } from '~/utils/landMeta'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import HardLink from '~/components/common/HardLink.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'

const { data: hub, error: hubError, refresh } = await useAsyncData(
  'land-hub',
  () => useLand().getHubSummary(),
  { default: () => null },
)

// 일시 장애를 200 + index 로 굳히지 않는다 (#467 / #674). 사용자에겐 페이지를 그대로
// 보여주되(fail-open) 크롤러에겐 503 + no-store 로 알린다.
//
// ⚠️ useAsyncData 핸들러 **밖**에서 불러야 한다. 핸들러 본문은 중첩 async 라 Nuxt 인스턴스
// 컨텍스트가 없고, 그 안에서 부르면 useNuxtApp() 이 throw 해 503 이 영영 나가지 않는다.
if (hubError.value && import.meta.server) markDegradedResponse()

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
const regionDraft = ref('')
const regionSearch = ref('')
const regionCandidates = computed(() => (hub.value?.cities ?? []).filter(row => row.city.includes(regionSearch.value)))
</script>

<style src="~/assets/css/remaining-property.css"></style>
