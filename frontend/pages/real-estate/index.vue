<template>
  <RealEstateMapExplorer
    :initial-type="INITIAL_TYPE"
    :initial-items="regions ?? []"
    initial-granularity="city"
  />
</template>

<script setup lang="ts">
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import RealEstateMapExplorer from '~/components/realEstate/map/RealEstateMapExplorer.vue'
import type { MapRegionItem, MapResponse } from '~/types/realEstateMap'
import { REAL_ESTATE_DATA_SOURCE } from '~/utils/dataSource'

// 지도 전용 레이아웃: 헤더만 있고 TrustLine·AppFooter 가 없어 페이지 스크롤이 0이다.
// 푸터는 지도 사이드바 목록 하단으로 옮겼다(MapSidebar showFooter).
definePageMeta({ layout: 'map' })

const INITIAL_TYPE = 'apt-sale'
const apiBase = useApiBase()

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

const { setMeta } = useFacilityMeta()
setMeta({
  title: '전국 최근 부동산 실거래가',
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
// 토지는 넣지 않는다. 지도 탐색기가 6종만 다루므로 구조화 데이터도 6종이어야 페이지가
// 알리는 목록과 실제 내용이 일치한다. 토지 접근 경로는 GNB 드롭다운이 담당한다.
setItemListSchema([
  { name: '아파트 매매', url: '/real-estate/apt-sale' },
  { name: '아파트 전월세', url: '/real-estate/apt-rent' },
  { name: '오피스텔 매매', url: '/real-estate/offitel-sale' },
  { name: '오피스텔 전월세', url: '/real-estate/offitel-rent' },
  { name: '빌라 매매', url: '/real-estate/villa-sale' },
  { name: '빌라 전월세', url: '/real-estate/villa-rent' },
])
setDatasetSchema({
  name: '전국 부동산 실거래가 데이터',
  description: '국토교통부 실거래가 공개시스템 기반 전국 아파트·빌라·오피스텔의 매매·전월세 거래 데이터입니다. 지역별 평균 평당가와 건물별 최근 실거래가를 지도로 제공합니다.',
  url: '/real-estate',
  sources: [REAL_ESTATE_DATA_SOURCE],
  keywords: ['부동산', '실거래가', '아파트', '빌라', '오피스텔', '평당가', '지도', '국토교통부'],
})
</script>
