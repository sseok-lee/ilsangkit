<template>
  <div class="flex flex-col gap-3 md:gap-4">
    <!-- 관련 가이드 (SSR 렌더 — 내부링크 색인 노출) -->
    <RelatedGuides :category="category" />

    <!-- 같은 지역 시설 -->
    <SectionBlock
      v-if="regionLink"
      size="compact"
      heading="관련 탐색"
      subtext="이 지역의 다른 시설로 바로 이동합니다."
    >
      <nav class="flex flex-col gap-3">
        <NuxtLink
          :to="regionLink.href"
          class="flex items-center gap-2 text-primary hover:text-primary-dark text-sm font-medium transition-colors"
        >
          <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          {{ regionLink.label }}
        </NuxtLink>
        <NuxtLink
          :to="regionLink.cityHref"
          class="flex items-center gap-2 text-slate-500 hover:text-primary text-sm font-medium transition-colors"
        >
          <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          {{ regionLink.cityLabel }}
        </NuxtLink>
      </nav>
    </SectionBlock>

    <!-- 관련 카테고리 + 부동산 교차 -->
    <SectionBlock
      v-if="relatedCategories.length > 0 || realEstateHref"
      size="compact"
      heading="관련 카테고리"
      subtext="다른 카테고리와 부동산 시세로 바로 이동합니다."
    >
      <nav data-testid="related-categories" class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="cat in relatedCategories"
          :key="cat"
          :to="regionLink && regionLink.href.endsWith(category) ? regionLink.href.replace(category, cat) : `/${cat}`"
          class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-full text-sm font-medium hover:bg-primary hover:text-white hover:border-primary transition-colors"
        >
          {{ CATEGORY_META[cat]?.label || cat }}
        </NuxtLink>
        <!-- 부동산 교차 pill (구 단위가 있을 때만) -->
        <NuxtLink
          v-if="realEstateHref"
          :to="realEstateHref"
          class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-full text-sm font-medium hover:bg-primary hover:text-white hover:border-primary transition-colors"
        >
          <span class="material-symbols-outlined text-[16px]">apartment</span>
          이 지역 부동산 시세
        </NuxtLink>
      </nav>
    </SectionBlock>

    <!-- 이용 팁 -->
    <SectionBlock
      v-if="categoryTips.length > 0"
      size="compact"
      :heading="`${categoryMeta.label} 이용 팁`"
      subtext="이 시설을 이용할 때 참고할 만한 팁입니다."
    >
      <ul class="flex flex-col gap-2.5">
        <li v-for="(tip, i) in categoryTips" :key="i" class="flex items-start gap-2 text-sm text-gray-600 leading-relaxed">
          <span class="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">check</span>
          {{ tip }}
        </li>
      </ul>
    </SectionBlock>

    <!-- FAQ -->
    <SectionBlock
      v-if="categoryFaqItems.length > 0"
      size="compact"
      heading="자주 묻는 질문"
    >
      <div class="flex flex-col gap-4">
        <div v-for="(faq, i) in categoryFaqItems" :key="i">
          <h3 class="text-sm font-bold text-slate-900 mb-1">Q. {{ faq.question }}</h3>
          <p class="text-sm text-gray-600 leading-relaxed">{{ faq.answer }}</p>
        </div>
      </div>
    </SectionBlock>

    <!-- Data Info -->
    <DataSourceSection domain="facility" :category="category" :last-sync-date="lastSyncDate" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import { CATEGORY_META, type FacilityCategory } from '~/types/facility'

interface RegionLink {
  href: string
  label: string
  cityHref: string
  cityLabel: string
}

interface FaqItem {
  question: string
  answer: string
}

const props = defineProps<{
  category: FacilityCategory
  regionLink: RegionLink | null
  relatedCategories: FacilityCategory[]
  categoryMeta: { label: string; icon?: string }
  categoryTips: string[]
  categoryFaqItems: FaqItem[]
  lastSyncDate: string | null
}>()

// 부동산 교차 링크: regionLink에서 city/district 슬러그 추출. 구(district)가 없는
// 시 단위(예: /seoul)면 null → 시 단위 링크가 "이 지역" 라벨과 어긋나는 것을 방지.
const realEstateHref = computed<string | null>(() => {
  if (!props.regionLink) return null
  const parts = props.regionLink.href.split('/').filter(Boolean)
  if (parts.length < 2) return null
  return `/real-estate/apt-sale/${parts[0]}/${parts[1]}`
})
</script>
