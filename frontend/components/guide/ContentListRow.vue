<script setup lang="ts">
import { computed } from 'vue'
import type { GuideSummary } from '~/composables/useGuides'
import type { ArticleSummary } from '~/composables/useArticles'
import { getContentCategoryLabel } from '~/utils/contentCategoryLabel'
import { formatDotDate } from '~/utils/syncFreshness'
import { VIEW_COUNT_DISPLAY_MIN } from '~/utils/seoConstants'

const props = defineProps<{ kind: 'guide' | 'article'; item: GuideSummary | ArticleSummary }>()
const date = computed(() => props.item.publishedAt || props.item.createdAt)
const config = useRuntimeConfig()
// Image URLs are consumed by the browser.
// eslint-disable-next-line no-restricted-syntax
const publicApiBase = config.public.apiBase
</script>

<template>
  <NuxtLink :to="`/${kind}/${item.slug}`" :prefetch="false" class="group flex min-w-0 gap-5 border-b border-line py-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
    <div class="min-w-0 flex-1">
      <span class="text-xs font-semibold text-primary">{{ getContentCategoryLabel(item.category) }}</span>
      <h2 class="mt-2 break-words text-lg font-bold leading-snug text-strong group-hover:text-primary">{{ item.title }}</h2>
      <p class="mt-2 line-clamp-2 text-sm leading-6 text-muted">{{ item.summary }}</p>
      <div class="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <time :datetime="date">{{ formatDotDate(date) }}</time>
        <span v-if="item.viewCount >= VIEW_COUNT_DISPLAY_MIN">조회 {{ item.viewCount.toLocaleString('ko-KR') }}</span>
      </div>
    </div>
    <img v-if="item.thumbnailUrl" :src="`${publicApiBase}${item.thumbnailUrl}`" alt="" width="128" height="96" loading="lazy" class="hidden h-24 w-32 shrink-0 rounded-md object-cover sm:block" />
  </NuxtLink>
</template>
