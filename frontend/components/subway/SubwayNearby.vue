<template>
  <div class="flex flex-col">
    <!-- Same-category nearby -->
    <SectionBlock
      v-if="nearbyLoading || nearbyFacilities.length > 0"
      :variant="sectionVariant"
      :heading="`주변 ${categoryMeta.label}`"
      subtext="같은 카테고리 주변 시설입니다."
    >
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <template v-if="nearbyLoading">
          <div v-for="i in 2" :key="i" class="animate-pulse rounded-xl bg-background-light h-[72px]"></div>
        </template>
        <template v-else>
          <FacilityCard
            v-for="item in nearbyFacilities"
            :key="item.id"
            :facility="item"
            highlight-distance
          />
        </template>
      </div>
    </SectionBlock>

    <!-- Cross-category nearby -->
    <template v-if="crossLoading">
      <SectionBlock :variant="sectionVariant">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div v-for="i in 2" :key="i" class="animate-pulse rounded-xl bg-background-light h-[72px]"></div>
        </div>
      </SectionBlock>
    </template>
    <template v-else>
      <SectionBlock
        v-for="group in crossFacilitiesGrouped"
        :key="group.category"
        :variant="sectionVariant"
        :heading="`주변 ${group.meta.label}`"
        subtext="관련 카테고리의 주변 시설입니다."
      >
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <FacilityCard
            v-for="item in group.items"
            :key="item.id"
            :facility="item"
            highlight-distance
          />
        </div>
      </SectionBlock>
    </template>
  </div>
</template>

<script setup lang="ts">
// 지하철역 상세 "주변 시설" 카드 목록(다른 역 + 주차장·충전소·화장실·시장).
// 시설 상세는 2026-10 구분선 목록(facility/detail/DetailNearby)으로 바뀌었고, 이 페이지는
// 클라이언트 조회·노선 배지 구조라 기존 카드 UI 를 그대로 둔다.
import SectionBlock from '~/components/common/SectionBlock.vue'
import FacilityCard from '~/components/facility/FacilityCard.vue'
import type { Facility, FacilityCategory } from '~/types/facility'

interface CategoryMetaLike {
  label: string
  icon?: string
}

interface CrossGroup {
  category: FacilityCategory
  meta: CategoryMetaLike
  items: Facility[]
}

withDefaults(defineProps<{
  nearbyFacilities: Facility[]
  nearbyLoading: boolean
  crossFacilitiesGrouped: CrossGroup[]
  crossLoading: boolean
  categoryMeta: CategoryMetaLike
  sectionVariant?: 'flat'
}>(), { sectionVariant: 'flat' })
</script>
