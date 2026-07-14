<template>
  <button
    type="button"
    data-testid="admin-article-card"
    class="w-full text-left flex gap-3 p-3 rounded-lg border transition-colors"
    :class="selected ? 'border-primary bg-primary/5' : 'border-line bg-white hover:border-primary/30'"
    @click="$emit('select', article.id)"
  >
    <div class="shrink-0 w-16 h-16 rounded-md bg-slate-100 overflow-hidden">
      <img
        v-if="article.thumbnailUrl"
        :src="article.thumbnailUrl"
        :alt="article.title"
        class="w-full h-full object-cover"
      >
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs font-medium text-muted">{{ article.category }}</span>
        <span
          v-if="article.articleType === 'policy-brief'"
          class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700"
        >정책</span>
        <span
          class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
          :class="STATUS_CLASS[article.status]"
        >
          {{ STATUS_LABEL[article.status] }}
        </span>
      </div>
      <h3 class="text-sm font-semibold text-slate-900 truncate">{{ article.title }}</h3>
      <p class="text-xs text-muted mt-1">{{ formatDotDate(article.createdAt) }}</p>
    </div>
  </button>
</template>

<script setup lang="ts">
import type { AdminArticleSummary } from '~/composables/useAdminArticles'
import { formatDotDate } from '~/utils/syncFreshness'

withDefaults(
  defineProps<{
    article: AdminArticleSummary
    selected?: boolean
  }>(),
  { selected: false }
)

defineEmits<{ select: [id: string] }>()

const STATUS_LABEL: Record<string, string> = {
  draft: '초안',
  published: '발행됨',
  rejected: '반려됨',
}

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700',
  published: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
}
</script>
