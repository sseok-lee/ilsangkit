<template>
  <SectionBlock heading="이 지역 다른 카테고리" subtext="같은 지역의 다른 생활 정보도 확인해보세요.">
    <div data-testid="region-related-categories" class="flex flex-wrap gap-2">
      <NuxtLink
        v-for="cat in categories"
        :key="cat.slug"
        :to="`/${city}/${district}/${cat.slug}`"
        class="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-line rounded-full text-sm text-slate-700 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
      >
        <img :src="`/icons/category/${cat.slug}.webp?v2`" :alt="cat.name" class="w-4 h-4" width="16" height="16" loading="lazy" />
        {{ districtName }} {{ cat.name }}
      </NuxtLink>
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import SectionBlock from '~/components/common/SectionBlock.vue'

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
