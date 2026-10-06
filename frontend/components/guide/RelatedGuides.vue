<template>
  <section v-if="guides.length > 0 && variant === 'flat'" class="section-flat">
    <div class="flex items-center justify-between mb-4 md:mb-[22px]">
      <h2 class="ui-h2 text-strong">관련 가이드</h2>
      <NuxtLink
        to="/guide"
        class="text-sm text-primary font-medium hover:underline flex items-center gap-1"
      >
        더보기
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
      </NuxtLink>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <NuxtLink
        v-for="guide in guides"
        :key="guide.id"
        :to="`/guide/${guide.slug}`"
        class="group flex flex-col rounded-lg border border-line overflow-hidden hover:border-primary/30 transition-colors duration-200"
      >
        <div class="aspect-video bg-background-light overflow-hidden">
          <img
            v-if="guide.thumbnailUrl"
            :src="`${publicApiBase}${guide.thumbnailUrl}`"
            :alt="guide.title"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            width="400"
            height="225"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <span class="material-symbols-outlined text-[36px] text-faint" aria-hidden="true">article</span>
          </div>
        </div>
        <div class="p-3">
          <h3 class="text-sm font-bold text-ink line-clamp-2 group-hover:text-primary transition-colors">
            {{ guide.title }}
          </h3>
          <p class="text-xs text-muted mt-1 line-clamp-1">
            {{ guide.summary }}
          </p>
        </div>
      </NuxtLink>
    </div>
  </section>
  <div v-else-if="guides.length > 0 && variant === 'inline'">
    <div class="flex items-center justify-between mb-3">
      <h3 class="ui-h3 text-strong">관련 가이드</h3>
      <NuxtLink to="/guide" class="text-sm text-primary font-medium hover:underline flex items-center gap-1">
        더보기
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
      </NuxtLink>
    </div>
    <!-- flat 분기와 같은 카드 격자 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <NuxtLink
        v-for="guide in guides"
        :key="guide.id"
        :to="`/guide/${guide.slug}`"
        class="group flex flex-col rounded-lg border border-line overflow-hidden hover:border-primary/30 transition-colors duration-200"
      >
        <div class="aspect-video bg-background-light overflow-hidden">
          <img
            v-if="guide.thumbnailUrl"
            :src="`${publicApiBase}${guide.thumbnailUrl}`"
            :alt="guide.title"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            width="400"
            height="225"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <span class="material-symbols-outlined text-[36px] text-faint" aria-hidden="true">article</span>
          </div>
        </div>
        <div class="p-3">
          <h3 class="text-sm font-bold text-ink line-clamp-2 group-hover:text-primary transition-colors">
            {{ guide.title }}
          </h3>
          <p class="text-xs text-muted mt-1 line-clamp-1">
            {{ guide.summary }}
          </p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGuides } from '~/composables/useGuides'
import type { GuideSummary } from '~/composables/useGuides'

const props = withDefaults(defineProps<{
  category?: string
  categories?: string[]
  excludeSlug?: string
  limit?: number
  variant?: 'flat' | 'inline'
}>(), {
  limit: 3,
  variant: 'flat',
})

const config = useRuntimeConfig()
// Image src URLs must use the public base (not loopback) so browsers can load them.
// eslint-disable-next-line no-restricted-syntax
const publicApiBase = config.public.apiBase
const { fetchGuides } = useGuides()

const route = useRoute()
// 인스턴스당 route.path+category 단위 키. 동일 route에 같은 category prop의
// RelatedGuides를 2개 마운트하면 useAsyncData 캐시가 공유되니 페이지당 1개만 둘 것.
const asyncKey = computed(() =>
  `related-guides-${route.path}-${props.categories?.join('-') ?? props.category ?? 'all'}`,
)

const { data: rawItems } = await useAsyncData<GuideSummary[]>(
  asyncKey,
  async () => {
    try {
      const data = await fetchGuides({
        ...(props.categories?.length ? { categories: props.categories } : { category: props.category }),
        limit: props.limit + (props.excludeSlug ? 1 : 0),
      })
      return data.items
    } catch {
      // 보조 콘텐츠 — 실패 시 조용히 빈 목록
      return []
    }
  },
  { default: () => [], watch: [asyncKey] },
)

const guides = computed(() => {
  const items = rawItems.value ?? []
  if (props.excludeSlug) {
    return items.filter(g => g.slug !== props.excludeSlug).slice(0, props.limit)
  }
  return items.slice(0, props.limit)
})
</script>
