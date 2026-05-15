<template>
  <section
    ref="rootEl"
    data-testid="blog-section"
    :class="['min-h-[1px]', hasResults || loading ? 'mt-8' : '']"
  >
    <template v-if="hasResults || loading">
      <header class="mb-4 flex items-baseline justify-between">
        <h2 class="text-lg font-bold text-slate-900">관련 블로그</h2>
        <p class="text-xs text-slate-500">네이버 블로그 검색 · 자동 수집</p>
      </header>

      <div v-if="loading" class="flex flex-col gap-3">
        <div v-for="i in 5" :key="i" class="h-24 rounded-xl bg-slate-100 animate-pulse" />
      </div>

      <div v-else class="flex flex-col gap-3">
        <BlogReviewCard
          v-for="p in displayed"
          :key="p.url"
          :post="p"
          data-testid="blog-card"
        />
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useBlogReviews, type BlogReviewKind } from '~/composables/useBlogReviews'
import BlogReviewCard from './BlogReviewCard.vue'

const props = defineProps<{ kind: BlogReviewKind; primaryKey: string; secondaryKey: string }>()

const { posts, loading, fetchPosts } = useBlogReviews()
const rootEl = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const MIN_RESULTS = 3
const hasResults = computed(() => posts.value.length >= MIN_RESULTS)
const displayed = computed(() => posts.value.slice(0, 5))

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') {
    void fetchPosts(props.kind, props.primaryKey, props.secondaryKey)
    return
  }
  observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      void fetchPosts(props.kind, props.primaryKey, props.secondaryKey)
      observer?.disconnect()
      observer = null
    }
  }, { rootMargin: '200px' })
  if (rootEl.value) observer.observe(rootEl.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>
