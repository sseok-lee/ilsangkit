<template>
  <div class="bg-background-light text-slate-900 font-display min-h-screen">
    <div class="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-10">
      <h1 class="text-2xl md:text-3xl font-bold mb-2">자주 묻는 질문</h1>
      <p class="text-slate-500 text-sm mb-8">
        일상킷에서 제공하는 공공시설 정보에 대해 자주 묻는 질문을 모았습니다.
      </p>

      <div v-for="group in groups" :key="group.title" class="mb-8">
        <h2 class="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-[20px]">{{ group.icon }}</span>
          {{ group.title }}
        </h2>

        <div v-for="cat in group.categories" :key="cat" class="mb-6">
          <h3 class="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <span
              class="material-symbols-outlined text-[18px]"
              :class="categoryColorClass(cat)"
            >{{ CATEGORY_META[cat].icon }}</span>
            {{ CATEGORY_META[cat].label }}
          </h3>

          <div class="space-y-2">
            <details
              v-for="(faq, index) in CATEGORY_FAQ[cat]"
              :key="index"
              class="group bg-white rounded-lg border border-slate-100"
            >
              <summary
                class="flex items-center justify-between gap-2 cursor-pointer px-4 py-3 text-sm font-medium text-slate-900 select-none list-none [&::-webkit-details-marker]:hidden"
              >
                <span>Q. {{ faq.question }}</span>
                <span
                  class="material-symbols-outlined text-[18px] text-slate-400 transition-transform group-open:rotate-180 shrink-0"
                >expand_more</span>
              </summary>
              <div class="px-4 pb-4 text-sm text-slate-600 leading-relaxed">
                {{ faq.answer }}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FacilityCategory } from '~/types/facility'
import { CATEGORY_META, CATEGORY_GROUPS } from '~/types/facility'
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'

const { setMeta } = useFacilityMeta()
const { setFAQSchema, setBreadcrumbSchema } = useStructuredData()

// SEO meta
setMeta({
  title: '자주 묻는 질문',
  description: '공공화장실, 무료와이파이, 공영주차장, 병원, 약국 등 일상킷 공공시설 정보에 대해 자주 묻는 질문과 답변을 확인하세요.',
  path: '/faq',
})

// Breadcrumb JSON-LD
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '자주 묻는 질문', url: '/faq' },
])

// FAQPage JSON-LD (모든 카테고리 FAQ 합산)
const allFaqs = Object.values(CATEGORY_FAQ).flat()
setFAQSchema(allFaqs)

// 그룹 데이터
const groups = CATEGORY_GROUPS

// 카테고리별 색상 클래스
function categoryColorClass(cat: FacilityCategory): string {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-500',
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
  return colorMap[CATEGORY_META[cat].color] || 'text-slate-500'
}
</script>
