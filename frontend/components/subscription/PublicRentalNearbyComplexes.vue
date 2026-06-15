<template>
  <SectionBlock :heading="`${regionLabel} 주변 공공임대 단지`" subtext="같은 자치구의 다른 공공임대 단지를 함께 비교해 보세요.">
    <div v-if="complexes.length === 0" class="rounded-xl bg-background-light p-6 text-center text-muted text-sm">
      같은 자치구에 등록된 다른 공공임대 단지가 아직 없습니다.
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <PublicRentalCard
        v-for="item in complexes"
        :key="item.id"
        :rental="item"
      />
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PublicRentalComplex } from '~/types/publicRental'
import SectionBlock from '~/components/common/SectionBlock.vue'
import PublicRentalCard from '~/components/subscription/PublicRentalCard.vue'

const props = defineProps<{
  complexes: PublicRentalComplex[]
  city: string
  district: string
}>()

const regionLabel = computed(() => {
  const cityShort = props.city.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
  return [cityShort, props.district].filter(Boolean).join(' ')
})
</script>
