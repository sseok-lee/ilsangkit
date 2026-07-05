<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <span
        class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
        :class="STATUS_CLASS[guide.status]"
      >{{ STATUS_LABEL[guide.status] }}</span>
      <span class="text-xs text-muted">{{ guide.category }} · {{ guide.articleType }}</span>
    </div>

    <div>
      <label for="admin-guide-title" class="block text-xs font-medium text-muted mb-1">제목</label>
      <input
id="admin-guide-title" v-model="draftTitle" type="text" data-testid="editor-title"
        class="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
>
    </div>
    <div>
      <label for="admin-guide-summary" class="block text-xs font-medium text-muted mb-1">요약</label>
      <textarea
id="admin-guide-summary" v-model="draftSummary" rows="2" data-testid="editor-summary"
        class="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
/>
    </div>
    <div>
      <label for="admin-guide-keywords" class="block text-xs font-medium text-muted mb-1">키워드 (쉼표 구분)</label>
      <input
id="admin-guide-keywords" v-model="draftKeywords" type="text" data-testid="editor-keywords"
        class="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div>
        <label for="admin-guide-content" class="block text-xs font-medium text-muted mb-1">본문 (마크다운)</label>
        <textarea
id="admin-guide-content" v-model="draftContent" rows="18" data-testid="editor-content"
          class="w-full rounded-md border border-line px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
/>
      </div>
      <div>
        <span class="block text-xs font-medium text-muted mb-1">미리보기</span>
        <div
          data-testid="editor-preview"
          class="border border-line rounded-md p-3 min-h-[20rem] max-h-[32rem] overflow-y-auto prose prose-slate max-w-none prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-7 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-line-2 prose-h3:text-lg prose-h3:mt-5 prose-p:leading-relaxed prose-p:text-ink prose-li:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-strong prose-ul:my-3 prose-ol:my-3"
          v-html="preview"
        />
      </div>
    </div>

    <div class="flex flex-wrap gap-2 pt-2 border-t border-line">
      <button type="button" data-testid="save-button" class="px-3 py-2 rounded-md text-sm font-medium bg-primary text-white" @click="$emit('save', patch)">저장</button>
      <button type="button" data-testid="publish-button" class="px-3 py-2 rounded-md text-sm font-medium bg-emerald-600 text-white" @click="$emit('publish')">발행</button>
      <button type="button" data-testid="unpublish-button" class="px-3 py-2 rounded-md text-sm font-medium bg-slate-200 text-slate-700" @click="$emit('unpublish')">발행취소</button>
      <button type="button" data-testid="delete-button" class="px-3 py-2 rounded-md text-sm font-medium bg-red-50 text-red-700 ml-auto" @click="$emit('delete')">삭제</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import type { AdminGuideDetail, AdminGuidePatch } from '~/composables/useAdminGuides'

const props = defineProps<{ guide: AdminGuideDetail }>()
defineEmits<{ save: [patch: AdminGuidePatch]; publish: []; unpublish: []; delete: [] }>()

const STATUS_LABEL: Record<string, string> = { draft: '초안', published: '발행됨' }
const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700',
  published: 'bg-emerald-50 text-emerald-700',
}

const draftTitle = ref('')
const draftSummary = ref('')
const draftKeywords = ref('')
const draftContent = ref('')

watch(() => props.guide, (guide) => {
  draftTitle.value = guide.title
  draftSummary.value = guide.summary
  draftKeywords.value = guide.keywords ?? ''
  draftContent.value = guide.content
}, { immediate: true })

const preview = computed(() => DOMPurify.sanitize(marked(draftContent.value || '') as string))
const patch = computed<AdminGuidePatch>(() => ({
  title: draftTitle.value,
  summary: draftSummary.value,
  keywords: draftKeywords.value.trim() === '' ? null : draftKeywords.value,
  content: draftContent.value,
}))
</script>
