<template>
  <section v-if="guides.length > 0" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
      <h2 class="text-slate-900 text-display-2 flex items-center gap-2">
        <span class="material-symbols-outlined text-primary text-[20px]">menu_book</span>
        관련 가이드
      </h2>
      <NuxtLink
        to="/guide"
        class="text-sm text-primary font-medium hover:underline flex items-center gap-1"
      >
        더보기
        <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
      </NuxtLink>
    </div>
    <div class="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <NuxtLink
        v-for="guide in guides"
        :key="guide.id"
        :to="`/guide/${guide.slug}`"
        class="group flex flex-col rounded-lg border border-slate-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      >
        <div class="aspect-video bg-slate-100 overflow-hidden">
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
            <span class="material-symbols-outlined text-[36px] text-slate-300">article</span>
          </div>
        </div>
        <div class="p-3">
          <h3 class="text-sm font-bold text-slate-900 line-clamp-2 group-hover:text-primary transition-colors">
            {{ guide.title }}
          </h3>
          <p class="text-xs text-slate-500 mt-1 line-clamp-1">
            {{ guide.summary }}
          </p>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGuides } from '~/composables/useGuides'
import type { GuideSummary } from '~/composables/useGuides'

const props = withDefaults(defineProps<{
  category?: string
  categories?: string[]
  excludeSlug?: string
  limit?: number
}>(), {
  limit: 3,
})

const config = useRuntimeConfig()
// Image src URLs must use the public base (not loopback) so browsers can load them.
// eslint-disable-next-line no-restricted-syntax
const publicApiBase = config.public.apiBase
const { fetchGuides } = useGuides()

const rawItems = ref<GuideSummary[]>([])

onMounted(async () => {
  try {
    const data = await fetchGuides({
      ...(props.categories?.length ? { categories: props.categories } : { category: props.category }),
      limit: props.limit + (props.excludeSlug ? 1 : 0),
    })
    rawItems.value = data.items
  } catch {
    // silently fail — guides are supplementary
  }
})

const guides = computed(() => {
  const items = rawItems.value
  if (props.excludeSlug) {
    return items.filter(g => g.slug !== props.excludeSlug).slice(0, props.limit)
  }
  return items.slice(0, props.limit)
})
</script>
