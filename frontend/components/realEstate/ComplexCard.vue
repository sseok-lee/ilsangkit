<template>
  <NuxtLink
    v-if="isRenderable"
    :to="linkUrl"
    class="group bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-slate-200 hover:border-primary/30 cursor-pointer block"
  >
    <!-- 상단: 아이콘 + 건물명/주소 -->
    <div class="flex items-start gap-3">
      <div
        :class="[
          'shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
          propertyTypeColor,
        ]"
      >
        <img :src="`/icons/category/${propertyTypeImg}.webp?v2`" :alt="props.propertyType" class="w-7 h-7" width="28" height="28" />
      </div>

      <div class="flex-1 min-w-0">
        <h3 class="text-slate-900 text-[15px] font-bold truncate">
          {{ complex.buildingName }}
        </h3>
        <p class="text-slate-500 text-xs truncate mt-0.5">
          {{ complex.city }} {{ complex.district }} {{ complex.dongName }}
        </p>
      </div>
    </div>

    <!-- 하단: 메타 정보 3열 -->
    <div class="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
      <div class="text-center">
        <p class="text-[10px] text-slate-500 tracking-wide">최근 거래</p>
        <p class="text-sm font-semibold text-slate-700 mt-0.5">
          {{ complex.lastDealYear ? `${complex.lastDealYear}.${String(complex.lastDealMonth).padStart(2, '0')}` : '-' }}
        </p>
      </div>
      <div class="text-center">
        <p class="text-[10px] text-slate-500 tracking-wide">건축년도</p>
        <p class="text-sm font-semibold text-slate-700 mt-0.5">
          {{ complex.buildYear ? `${complex.buildYear}년` : '-' }}
        </p>
      </div>
      <div class="text-center">
        <p class="text-[10px] text-slate-500 tracking-wide">거래</p>
        <p class="text-sm font-semibold text-slate-700 mt-0.5">{{ complex.transactionCount }}건</p>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ComplexInfo, RealEstatePropertyType, TransactionMode } from '~/types/realEstate'
import { isValidBuildingName } from '~/utils/realEstateBuildingName'

interface Props {
  complex: ComplexInfo
  propertyType: RealEstatePropertyType
  tab: TransactionMode
  /**
   * 링크 대상을 유효한 단지로 국한하기 위한 최소 거래 건수 (기본 10).
   * thin content 링크로 크롤 예산이 새는 것을 방지한다.
   */
  minTransactionCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  minTransactionCount: 10,
})

// 지번/thin buildingName이거나 거래 건수가 모자라면 렌더링 자체를 건너뜀.
// → 내부 링크로도 노출되지 않아 크롤 예산 회수.
const isRenderable = computed(() => {
  if (!isValidBuildingName(props.complex.buildingName)) return false
  if (props.complex.transactionCount < props.minTransactionCount) return false
  return true
})

const linkUrl = computed(() => {
  const name = encodeURIComponent(props.complex.buildingName)
  // sale은 페이지 기본값이라 canonical URL과 일치시키기 위해 생략 (크롤 예산 절감 + canonical 신호 정렬)
  // rent는 기본값이 아니므로 유지해야 rent 탭이 활성화됨
  const tabPart = props.tab === 'rent' ? 'tab=rent&' : ''
  return `/real-estate/${props.propertyType}/${name}?${tabPart}bjdCode=${props.complex.bjdCode}`
})

const PROPERTY_ICONS: Record<string, { img: string; bg: string }> = {
  apt: { img: 'apt', bg: 'bg-blue-50' },
  villa: { img: 'villa', bg: 'bg-emerald-50' },
  offitel: { img: 'offitel', bg: 'bg-violet-50' },
}

const propertyTypeImg = computed(() => PROPERTY_ICONS[props.propertyType]?.img || 'apt')
const propertyTypeColor = computed(() => PROPERTY_ICONS[props.propertyType]?.bg || 'bg-slate-100')
</script>
