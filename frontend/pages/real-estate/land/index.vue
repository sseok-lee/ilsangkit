<template>
  <div class="bg-white text-ink min-h-screen">
    <div class="page-container pb-10">
      <PageHead eyebrow="부동산"
        :title="LAND_META.label + ' 실거래가'"
        :description="LAND_META.description"
      />

      <SectionBlock variant="flat" heading="시·도별 토지 실거래가" subtext="조회할 지역을 선택하세요.">
        <form class="mb-6 flex gap-2 rounded-lg bg-background-light p-3.5 md:p-5" @submit.prevent="regionSearch = regionDraft.trim()">
          <label class="sr-only" for="land-region-search">지역명 검색</label>
          <input id="land-region-search" v-model="regionDraft" class="min-w-0 flex-1 min-h-[44px] rounded-md border border-line bg-white px-3 text-ink placeholder:text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="지역명 검색" maxlength="100">
          <UiButton variant="primary" type="submit">검색</UiButton>
        </form>
        <div v-if="regionCandidates.length > 0" class="row-list">
          <HardLink
            v-for="city in regionCandidates"
            :key="city.slug"
            :to="`/real-estate/land/${city.slug}`"
            class="row-list__link"
          >
            <span class="text-display-3 text-ink">{{ city.city }}</span>
            <span class="text-caption text-muted">거래 동 {{ city.indexableDongCount.toLocaleString('ko-KR') }}개</span>
            <span class="text-caption text-muted">거래 {{ city.totalTransactions.toLocaleString('ko-KR') }}건</span>
          </HardLink>
        </div>
        <div v-else-if="hubError" role="alert" class="py-8 text-sm text-muted">지역 정보를 불러오지 못했습니다. <button class="min-h-11 underline" @click="refresh()">다시 시도</button></div>
        <p v-else class="py-8 text-sm text-muted">{{ regionSearch ? '검색한 지역이 없습니다.' : '등록된 토지 거래 지역이 없습니다.' }}</p>
      </SectionBlock>

      <!-- Ad: 시·도 카드 그리드 후 -->
      <AdBanner />

      <SectionBlock variant="flat" heading="자주 묻는 질문">
        <div class="space-y-3">
          <details
            v-for="(faq, index) in LAND_FAQ"
            :key="index"
            class="rounded-[10px] bg-white border border-line overflow-hidden"
          >
            <summary class="flex items-center justify-between px-5 py-4 cursor-pointer text-ink font-medium text-sm hover:bg-background-light transition-colors list-none">
              {{ faq.q }}
              <span aria-hidden="true" class="material-symbols-outlined text-muted text-lg flex-shrink-0 ml-3">expand_more</span>
            </summary>
            <div class="px-5 pb-4 text-muted text-sm leading-relaxed border-t border-line pt-3">
              {{ faq.a }}
            </div>
          </details>
        </div>
      </SectionBlock>


      <AffiliateBanner />

      <section>
        <DataSourceSection variant="flat" domain="real-estate" />
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
import PageHead from '~/components/common/PageHead.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import UiButton from '~/components/common/UiButton.vue'

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
