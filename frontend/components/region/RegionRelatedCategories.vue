<template>
  <SectionBlock variant="flat" heading="관련 탐색" subtext="같은 지역의 다른 생활 정보도 확인해보세요.">
    <div data-testid="region-related-categories" class="flex flex-wrap gap-2">
      <UiChip
        v-for="cat in categories"
        :key="cat.slug"
        :to="`/${city}/${district}/${cat.slug}`"
      >
        <img :src="`/icons/category/${cat.slug}.webp?v2`" alt="" aria-hidden="true" class="w-4 h-4" width="16" height="16" loading="lazy" />
        {{ districtName }} {{ cat.name }}
      </UiChip>
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import SectionBlock from '~/components/common/SectionBlock.vue'
import UiChip from '~/components/common/UiChip.vue'

interface CategoryLink {
  slug: string
  name: string
}

defineProps<{
  city: string
  district: string
  districtName: string
  categories: CategoryLink[]
}>()
</script>
