<template>
  <SectionBlock
    variant="flat"
    :heading="`${areaName} 부동산 실거래가 상세 보기`"
    subtext="아파트, 빌라, 오피스텔, 토지 실거래가를 확인해보세요"
  >
    <div class="flex flex-wrap gap-2">
      <UiButton variant="primary" to="/real-estate/apt-sale">아파트</UiButton>
      <UiButton variant="secondary" to="/real-estate/villa-sale">빌라</UiButton>
      <UiButton variant="secondary" to="/real-estate/offitel-sale">오피스텔</UiButton>
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import SectionBlock from '~/components/common/SectionBlock.vue'
import UiButton from '~/components/common/UiButton.vue'

defineProps<{
  areaName: string
}>()
</script>
