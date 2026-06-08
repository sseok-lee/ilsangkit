<!-- frontend/components/auction/AuctionMap.vue — 부동산 상세 "위치와 로드뷰"와 동일 컴포넌트/스타일 재사용 -->
<script setup lang="ts">
import { ref } from 'vue'
import FacilityMap from '~/components/map/FacilityMap.vue'
import FacilityRoadview from '~/components/facility/FacilityRoadview.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import type { FacilitySearchItem } from '~/types'

const props = defineProps<{ lat: number; lng: number; address?: string }>()

const label = props.address ?? '위치'

// FacilityMap :facilities 형태 (부동산 buildingMarker와 동일 shape)
const marker: FacilitySearchItem = {
  id: 'auction',
  name: label,
  category: 'parking',
  address: null,
  roadAddress: null,
  lat: props.lat,
  lng: props.lng,
  city: '',
  district: '',
}

const showNavDropdown = ref(false)

// 부동산 상세와 동일한 길찾기 URL 패턴
const kakaoMapUrl = `https://map.kakao.com/link/to/${encodeURIComponent(label)},${props.lat},${props.lng}`
const naverMapUrl = `https://map.naver.com/v5/directions/-/${props.lng},${props.lat},${encodeURIComponent(label)}/-/walk`

function openNavigation(url: string) {
  window.open(url, '_blank')
  showNavDropdown.value = false
}
</script>

<template>
  <SectionBlock data-testid="auction-map" heading="위치와 로드뷰" subtext="지도와 로드뷰로 주변을 바로 확인할 수 있습니다.">
    <template #right>
      <div class="hidden md:flex items-center gap-1">
        <div class="relative">
          <button
            class="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark transition-colors px-2 py-1 rounded-lg hover:bg-primary-50"
            @click="showNavDropdown = !showNavDropdown"
          >
            <span class="material-symbols-outlined text-[18px]">directions</span>
            길찾기
            <span class="material-symbols-outlined text-[14px]">expand_more</span>
          </button>
          <div v-if="showNavDropdown" class="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20">
            <button class="w-full px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(kakaoMapUrl)">
              <img src="/images/icons/kakaomap.svg" alt="카카오맵" class="w-5 h-5 rounded" /> 카카오맵으로 길찾기
            </button>
            <div class="h-px bg-slate-100"></div>
            <button class="w-full px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(naverMapUrl)">
              <img src="/images/icons/navermap.svg" alt="네이버맵" class="w-5 h-5 rounded" /> 네이버맵으로 길찾기
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- 지도 + 로드뷰 반반(데스크톱), 모바일 세로 적층. 공매는 모바일 지도 히어로가 없으므로 지도에 hidden md:block 미적용 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="rounded-xl border border-line overflow-hidden h-[200px] md:h-[300px]">
        <ClientOnly>
          <FacilityMap :center="{ lat, lng }" :facilities="[marker]" :level="3" />
        </ClientOnly>
      </div>
      <div class="roadview-wrapper rounded-xl border border-line overflow-hidden h-[200px] md:h-[300px]">
        <FacilityRoadview :lat="lat" :lng="lng" />
      </div>
    </div>
    <p v-if="address" class="mt-2 text-caption text-slate-500">{{ address }}</p>
  </SectionBlock>
</template>

<style scoped>
/* 부동산 상세와 동일 — FacilityRoadview를 300px 래퍼 높이에 맞춤 */
.roadview-wrapper :deep(> div) { height: 100% !important; }
.roadview-wrapper :deep(> div > div) { height: 100% !important; }
</style>
