<template>
  <div class="flex flex-col gap-3 md:gap-4">
    <!-- Same-category nearby -->
    <SectionBlock
      v-if="nearbyLoading || nearbyFacilities.length > 0"
      :heading="`주변 ${categoryMeta.label}`"
      subtext="같은 카테고리 인근 시설입니다."
    >
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <template v-if="nearbyLoading">
          <div v-for="i in 2" :key="i" class="animate-pulse rounded-xl bg-gray-100 h-[72px]"></div>
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
      <SectionBlock>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div v-for="i in 2" :key="i" class="animate-pulse rounded-xl bg-gray-100 h-[72px]"></div>
        </div>
      </SectionBlock>
    </template>
    <template v-else>
      <SectionBlock
        v-for="group in crossFacilitiesGrouped"
        :key="group.category"
        :heading="`주변 ${group.meta.label}`"
        subtext="관련 카테고리의 인근 시설입니다."
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

defineProps<{
  nearbyFacilities: Facility[]
  nearbyLoading: boolean
  crossFacilitiesGrouped: CrossGroup[]
  crossLoading: boolean
  categoryMeta: CategoryMetaLike
}>()
</script>
