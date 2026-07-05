<template>
  <button
    type="button"
    data-testid="admin-guide-card"
    class="w-full text-left flex gap-3 p-3 rounded-lg border transition-colors"
    :class="selected ? 'border-primary bg-primary/5' : 'border-line bg-white hover:border-primary/30'"
    @click="$emit('select', guide.id)"
  >
    <div class="shrink-0 w-16 h-16 rounded-md bg-slate-100 overflow-hidden">
      <img v-if="guide.thumbnailUrl" :src="guide.thumbnailUrl" :alt="guide.title" class="w-full h-full object-cover">
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs font-medium text-muted">{{ guide.category }}</span>
        <span
          class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
          :class="STATUS_CLASS[guide.status]"
        >{{ STATUS_LABEL[guide.status] }}</span>
      </div>
      <h3 class="text-sm font-semibold text-slate-900 truncate">{{ guide.title }}</h3>
      <p class="text-xs text-muted mt-1">{{ guide.category }} · {{ guide.articleType }}</p>
    </div>
  </button>
</template>

<script setup lang="ts">
import type { AdminGuideSummary } from '~/composables/useAdminGuides'

withDefaults(defineProps<{ guide: AdminGuideSummary; selected?: boolean }>(), { selected: false })
defineEmits<{ select: [id: string] }>()

const STATUS_LABEL: Record<string, string> = { draft: '초안', published: '발행됨' }
const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700',
  published: 'bg-emerald-50 text-emerald-700',
}
</script>
