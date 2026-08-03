<template>
  <div class="bg-background-light">
    <RealEstateMapExplorer
      :initial-type="INITIAL_TYPE"
      :initial-items="regions ?? []"
      initial-granularity="city"
    />

    <!-- 하단 콘텐츠는 여기 한 번만 렌더한다. 바텀시트에 복제하면 모바일 DOM 에
         h2 2개·AdBanner 2개가 생긴다. 모바일은 시트를 접거나 스크롤해 도달한다. -->
    <div class="mx-auto max-w-[1200px] px-4 md:px-6 py-8 md:py-10 flex flex-col gap-3">
      <BelowFoldContent :hub-summaries="hubSummaries ?? undefined" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, defineComponent } from 'vue'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { REAL_ESTATE_DATA_SOURCE } from '~/utils/dataSource'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import AdBanner from '~/components/ads/AdBanner.vue'
import HardLink from '~/components/common/HardLink.vue'
import RealEstateCategoryCards from '~/components/realEstate/RealEstateCategoryCards.vue'
import RealEstateMapExplorer from '~/components/realEstate/map/RealEstateMapExplorer.vue'
import type { RealEstateHubType } from '~/types/realEstate'
import type { MapRegionItem, MapResponse } from '~/types/realEstateMap'

const INITIAL_TYPE = 'apt-sale'
const apiBase = useApiBase()

interface HubSummaryResponse {
  success: boolean
  data: Record<RealEstateHubType, { last30dCount: number | null }>
  generatedAt: string
}

// 지도 아래로 이어지는 콘텐츠. 데스크톱 스크롤과 모바일 바텀시트 확장 양쪽에서 재사용한다.
const BelowFoldContent = defineComponent({
  props: { hubSummaries: { type: Object, default: undefined } },
  setup(p) {
    return () => [
      h(SectionBlock, { subtext: '조회할 주택 유형을 선택하세요.' }, {
        heading: () => h('h2', { class: 'text-display-3 text-slate-900' }, '부동산 유형별 실거래가'),
        // RealEstateCategoryCards 는 아파트·빌라·오피스텔 6종(매매/전월세)만 렌더한다. 토지는
        // 별도 모델(면적·지목 단위)이라 그 컴포넌트 범위 밖 — 여기 카드를 별도로 복원해 유형 카드를
        // 7개로 유지한다(스펙 6.1 — 387,549개 건물 요약으로 가는 크롤 경로).
        default: () => [
          h(RealEstateCategoryCards, { summaries: p.hubSummaries }),
          h('div', { class: 'grid grid-cols-2 gap-3 md:gap-4 mt-3' }, [
            // HardLink 를 쓴다 — 바로 위 RealEstateCategoryCards 의 6개 카드가 전부 HardLink 이고,
            // 이 사이트의 전체 리로드 내비게이션은 광고 1뷰-1임프레션 정합을 위해 의도된 것이다.
            // 이 카드만 NuxtLink 면 형제와 내비게이션 동작이 갈린다.
            h(HardLink, {
              to: '/real-estate/land',
              class: 'group flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all',
            }, () => [
              h('div', { class: 'flex items-center gap-2' }, [
                h('span', { class: 'flex size-9 md:size-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors' }, [
                  h('img', { src: '/icons/category/land-plot.webp?v2', alt: '토지', class: 'w-6 h-6 md:w-7 md:h-7', width: 28, height: 28 }),
                ]),
                h('span', { class: 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-primary-100 text-primary-700' }, '매매'),
              ]),
              h('p', { class: 'text-sm md:text-base font-semibold text-slate-800 group-hover:text-primary transition-colors leading-tight' }, '토지'),
              h('p', { class: 'text-xs md:text-sm text-slate-700' }, '대지·전·답·임야 평당 시세'),
            ]),
          ]),
        ],
      }),
      h(AdBanner),
      h(SectionBlock, {}, {
        heading: () => h('h2', { class: 'text-display-3 text-slate-900' }, '부동산 실거래가란?'),
        default: () => h('p', { class: 'text-base text-slate-600 leading-relaxed' },
          '실거래가는 실제 거래가 완료된 가격으로, 국토교통부에 신고된 공식 데이터입니다. 일상킷은 이를 매일 수집해 아파트·연립다세대(빌라)·오피스텔의 매매·전월세 실거래 내역을 제공합니다.'),
      }),
      h('section', {}, [h(DataSourceSection, { domain: 'real-estate' })]),
    ]
  },
})

// 지도는 SSR 불가라 이 집계가 이 페이지의 유일한 SSR 데이터다.
// 실패해도 [] 를 주면 MapSidebar 가 SIDO_CHIPS 16개 링크를 상수에서 렌더한다(fail-open).
const { data: regions } = await useAsyncData<MapRegionItem[]>(
  'real-estate-map-city',
  async () => {
    try {
      const res = await $fetch<MapResponse>(`${apiBase}/api/real-estate/${INITIAL_TYPE}/map`, {
        params: { level: 13, swLat: 33, swLng: 124, neLat: 39, neLng: 132 },
      })
      return res.data.items as MapRegionItem[]
    } catch {
      return []
    }
  },
  { default: () => [] },
)

const { data: hubSummaries } = await useAsyncData(
  'real-estate-hub-summary',
  async () => {
    try {
      const res = await $fetch<HubSummaryResponse>(`${apiBase}/api/real-estate/hub-summary`)
      return res.data
    } catch {
      return null
    }
  },
  { default: () => null },
)

const { setMeta } = useFacilityMeta()
setMeta({
  title: '부동산 실거래가 지도',
  description: '전국 아파트·빌라·오피스텔의 매매·전월세 실거래가를 지도에서 확인하세요. 지역별 평균 평당가와 건물별 최근 실거래가를 국토교통부 데이터로 제공합니다.',
  path: '/real-estate',
})

// 정적 FAQ 와 FAQPage 스키마는 제거했다 — 보일러플레이트가 GSC 색인 감소 진단의
// 지목 대상이었고 상세 페이지에서는 이미 제거(#625)됐다. 지역 평균 평당가 실데이터가 대체한다.
const { setBreadcrumbSchema, setItemListSchema, setDatasetSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
])
setItemListSchema([
  { name: '아파트 매매', url: '/real-estate/apt-sale' },
  { name: '아파트 전월세', url: '/real-estate/apt-rent' },
  { name: '오피스텔 매매', url: '/real-estate/offitel-sale' },
  { name: '오피스텔 전월세', url: '/real-estate/offitel-rent' },
  { name: '빌라 매매', url: '/real-estate/villa-sale' },
  { name: '빌라 전월세', url: '/real-estate/villa-rent' },
  { name: '토지 실거래가', url: '/real-estate/land' },
])
setDatasetSchema({
  name: '전국 부동산 실거래가 데이터',
  description: '국토교통부 실거래가 공개시스템 기반 전국 아파트·빌라·오피스텔의 매매·전월세 거래 데이터입니다. 지역별 평균 평당가와 건물별 최근 실거래가를 지도로 제공합니다.',
  url: '/real-estate',
  sources: [REAL_ESTATE_DATA_SOURCE],
  keywords: ['부동산', '실거래가', '아파트', '빌라', '오피스텔', '평당가', '지도', '국토교통부'],
})
</script>
