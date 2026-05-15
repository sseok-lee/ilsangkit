<template>
  <a
    :href="post.url"
    target="_blank"
    rel="nofollow noopener noreferrer"
    class="block rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
  >
    <p class="text-base font-semibold text-slate-900 line-clamp-1">{{ post.title }}</p>
    <p class="mt-2 text-sm text-slate-600 line-clamp-2 leading-relaxed">{{ snippet }}</p>
    <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
      <span>{{ post.bloggerName }} · {{ formattedDate }}</span>
      <span class="material-symbols-outlined text-[16px]">open_in_new</span>
    </div>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NaverBlogPost } from '~/types/naverBlog'

const props = defineProps<{ post: NaverBlogPost }>()

const snippet = computed(() => {
  const d = props.post.description ?? ''
  return d.length > 80 ? `${d.slice(0, 80)}…` : d
})

const formattedDate = computed(() => {
  const s = props.post.postDate
  if (!/^\d{8}$/.test(s)) return s
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`
})
</script>
