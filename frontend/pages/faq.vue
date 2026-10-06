<template>
  <div class="bg-white text-ink min-h-screen">
    <div class="faq-page page-container pt-4 pb-12 md:pt-6">
      <div class="max-w-[760px]">
      <PageHead
        title="자주 묻는 질문"
        description="일상킷에서 제공하는 부동산 실거래가와 생활시설 정보에 대해 자주 묻는 질문을 모았습니다."
      />

      <nav aria-label="질문 주제" class="mt-6 mb-6">
        <SegmentedControl :model-value="activeTab" :items="tabItems" aria-label="질문 주제 선택" @update:model-value="(v) => (activeTab = v as TabKey)" />
      </nav>
      <AdBanner class="my-3" />

      <!-- 부동산 실거래가 FAQ -->
      <div v-show="activeTab !== 'facility'" class="mb-10">
        <h2 class="text-display-2 text-strong mb-3">
          부동산 실거래가
        </h2>

        <div class="space-y-2">
          <details
            v-for="(faq, index) in realEstateFaqItems"
            :key="`re-${index}`"
            class="group border-b border-line"
          >
            <summary
              class="flex items-center justify-between gap-2 min-h-14 cursor-pointer px-1 py-4 text-sm font-medium text-strong select-none list-none [&::-webkit-details-marker]:hidden"
            >
              <span>Q. {{ faq.question }}</span>
              <span
                class="material-symbols-outlined text-[18px] text-muted transition-transform group-open:rotate-180 shrink-0"
                aria-hidden="true"
              >expand_more</span>
            </summary>
            <div class="px-1 pb-5 text-sm text-muted leading-relaxed">
              {{ faq.answer }}
            </div>
          </details>
        </div>
      </div>

      <!-- 시설 카테고리 FAQ -->
      <div v-for="group in groups" v-show="activeTab !== 'real-estate'" :key="group.title" class="mb-10">
        <h2 class="text-display-2 text-strong mb-3">
          {{ group.title }}
        </h2>

        <div v-for="cat in group.categories" :key="cat" class="mb-4">
          <div class="mb-3 flex items-center gap-2">
            <span
              class="material-symbols-outlined text-[18px]"
              :class="categoryColorClass(cat)"
              aria-hidden="true"
            >{{ CATEGORY_META[cat].icon }}</span>
            <h3 class="text-base font-semibold text-strong">{{ CATEGORY_META[cat].label }}</h3>
          </div>

          <div class="space-y-2">
            <details
              v-for="(faq, index) in CATEGORY_FAQ[cat]"
              :key="index"
              class="group border-b border-line"
            >
              <summary
                class="flex items-center justify-between gap-2 min-h-14 cursor-pointer px-1 py-4 text-sm font-medium text-strong select-none list-none [&::-webkit-details-marker]:hidden"
              >
                <span>Q. {{ faq.question }}</span>
                <span
                  class="material-symbols-outlined text-[18px] text-muted transition-transform group-open:rotate-180 shrink-0"
                  aria-hidden="true"
                >expand_more</span>
              </summary>
              <div class="px-1 pb-5 text-sm text-muted leading-relaxed">
                {{ faq.answer }}
              </div>
            </details>
          </div>
        </div>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const tabs = [{ key: 'all', label: '전체' }, { key: 'real-estate', label: '부동산' }, { key: 'facility', label: '생활시설' }] as const
type TabKey = typeof tabs[number]['key']
const activeTab = ref<TabKey>('all')
const tabItems = tabs.map((tab) => ({ value: tab.key, label: tab.label }))
import PageHead from '~/components/common/PageHead.vue'
import SegmentedControl from '~/components/common/SegmentedControl.vue'
import type { FacilityCategory } from '~/types/facility'
import { CATEGORY_META, CATEGORY_GROUPS } from '~/types/facility'
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'
import { REAL_ESTATE_FAQ } from '~/utils/realEstateMeta'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'

const { setMeta } = useFacilityMeta()
const { setBreadcrumbSchema, setFAQSchema } = useStructuredData()

// SEO meta
setMeta({
  title: '자주 묻는 질문',
  description: '부동산 실거래가와 생활시설 정보 이용에 관한 자주 묻는 질문을 확인하세요.',
  path: '/faq',
})

// Breadcrumb JSON-LD
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '자주 묻는 질문', url: '/faq' },
])

// 부동산 FAQ (q/a 형식 → question/answer 형식으로 변환)
const realEstateFaqItems = [
  ...REAL_ESTATE_FAQ.aptSale.slice(0, 3),
  ...REAL_ESTATE_FAQ.aptRent.slice(0, 2),
  ...REAL_ESTATE_FAQ.villaSale.slice(0, 2),
  ...REAL_ESTATE_FAQ.offitelSale.slice(0, 2),
].map(faq => ({ question: faq.q, answer: faq.a }))

// FAQ 데이터 (HTML 렌더링용 + FAQPage JSON-LD)
// Why: Google 리치결과는 정부/비영리 한정이지만 ChatGPT/Perplexity/AI Overviews 인용성 신호로 유효.
const allFaqs = [...Object.values(CATEGORY_FAQ).flat(), ...realEstateFaqItems]
setFAQSchema(allFaqs)

// 그룹 데이터
const groups = CATEGORY_GROUPS

// 카테고리별 색상 클래스
function categoryColorClass(cat: FacilityCategory): string {
  const colorMap: Record<string, string> = {
    blue: 'text-primary-500',
    red: 'text-red-500',
    green: 'text-green-500',
    purple: 'text-purple-500',
    orange: 'text-orange-500',
    sky: 'text-sky-500',
    rose: 'text-rose-500',
    teal: 'text-teal-500',
    indigo: 'text-indigo-500',
    amber: 'text-amber-500',
  }
  return colorMap[CATEGORY_META[cat].color] || 'text-muted'
}
</script>

<style scoped>
.faq-page summary:focus-visible { outline: 2px solid rgb(var(--brand-rgb)); outline-offset: 3px; }
</style>
