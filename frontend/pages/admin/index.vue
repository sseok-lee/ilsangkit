<template>
  <div class="min-h-screen bg-slate-50 flex flex-col">
    <header class="bg-white border-b border-line px-4 py-3 flex items-center justify-between">
      <h1 class="text-lg font-bold text-slate-900">오늘의 이슈 어드민</h1>
      <button
        type="button"
        data-testid="generate-button"
        :disabled="generating"
        class="px-3 py-2 rounded-md text-sm font-medium bg-primary text-white disabled:opacity-50"
        @click="onGenerate"
      >
        {{ generating ? '생성 중...' : '지금 생성' }}
      </button>
    </header>

    <div class="flex-1 max-w-7xl mx-auto w-full p-4 flex flex-col md:flex-row gap-4">
      <!-- 좌측: 초안 큐 -->
      <aside class="md:w-96 shrink-0 flex flex-col gap-3">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="f in FILTERS"
            :key="f.value"
            type="button"
            :data-testid="`filter-${f.value}`"
            class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
            :class="statusFilter === f.value ? 'bg-primary text-white' : 'bg-white border border-line text-slate-600'"
            @click="onFilterChange(f.value)"
          >
            {{ f.label }}
          </button>
        </div>

        <p v-if="error" data-testid="error" role="alert" class="text-sm text-red-600">
          {{ error }}
        </p>

        <p v-if="loading" data-testid="loading" class="text-sm text-muted">
          불러오는 중...
        </p>

        <div v-else class="flex flex-col gap-2">
          <AdminArticleCard
            v-for="a in articles"
            :key="a.id"
            :article="a"
            :selected="selected?.id === a.id"
            @select="onSelect"
          />
          <p v-if="articles.length === 0" class="text-sm text-muted text-center py-8">
            글이 없습니다
          </p>
        </div>
      </aside>

      <!-- 우측: 상세 편집 -->
      <section class="flex-1 bg-white rounded-lg border border-line p-4">
        <AdminArticleEditor
          v-if="selected"
          :article="selected"
          @save="onSave"
          @publish="onPublish"
          @unpublish="onUnpublish"
          @reject="onReject"
          @delete="onDelete"
          @regenerate="onRegenerate"
        />
        <p v-else class="text-sm text-muted text-center py-20">
          왼쪽에서 글을 선택하세요
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: false })

import { ref, onMounted } from 'vue'
import AdminArticleCard from '~/components/admin/AdminArticleCard.vue'
import AdminArticleEditor from '~/components/admin/AdminArticleEditor.vue'
import type {
  AdminArticleSummary,
  AdminArticleDetail,
  AdminArticleStatus,
  AdminArticlePatch,
} from '~/composables/useAdminArticles'

useSeoMeta({
  robots: 'noindex, nofollow',
  title: '오늘의 이슈 어드민',
})

type StatusFilter = AdminArticleStatus | 'all'

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'draft', label: '초안' },
  { value: 'published', label: '발행됨' },
  { value: 'rejected', label: '반려됨' },
]

const GENERIC_ERROR = '문제가 발생했습니다. 잠시 후 다시 시도해주세요.'

const articles = ref<AdminArticleSummary[]>([])
const selected = ref<AdminArticleDetail | null>(null)
const statusFilter = ref<StatusFilter>('all')
const loading = ref(false)
const generating = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params: { status?: AdminArticleStatus; limit: number } = { limit: 50 }
    if (statusFilter.value !== 'all') params.status = statusFilter.value
    const res = await useAdminArticles().list(params)
    articles.value = res.items
  } catch {
    error.value = GENERIC_ERROR
  } finally {
    loading.value = false
  }
}

function onFilterChange(value: StatusFilter) {
  statusFilter.value = value
  load()
}

async function onSelect(id: string) {
  error.value = ''
  try {
    selected.value = await useAdminArticles().get(id)
  } catch {
    error.value = GENERIC_ERROR
  }
}

async function onSave(patch: AdminArticlePatch) {
  if (!selected.value) return
  try {
    selected.value = await useAdminArticles().update(selected.value.id, patch)
    await load()
  } catch {
    error.value = GENERIC_ERROR
  }
}

async function onPublish() {
  if (!selected.value) return
  if (!confirm('이 글을 발행하시겠습니까?')) return
  try {
    selected.value = await useAdminArticles().publish(selected.value.id)
    await load()
  } catch {
    error.value = GENERIC_ERROR
  }
}

async function onUnpublish() {
  if (!selected.value) return
  try {
    selected.value = await useAdminArticles().unpublish(selected.value.id)
    await load()
  } catch {
    error.value = GENERIC_ERROR
  }
}

async function onReject() {
  if (!selected.value) return
  if (!confirm('이 글을 반려하시겠습니까?')) return
  try {
    selected.value = await useAdminArticles().reject(selected.value.id)
    await load()
  } catch {
    error.value = GENERIC_ERROR
  }
}

async function onDelete() {
  if (!selected.value) return
  if (!confirm('이 글을 삭제하시겠습니까? 되돌릴 수 없습니다.')) return
  try {
    await useAdminArticles().remove(selected.value.id)
    selected.value = null
    await load()
  } catch {
    error.value = GENERIC_ERROR
  }
}

async function onRegenerate() {
  if (!selected.value) return
  try {
    await useAdminArticles().regenerate(selected.value.id)
    await load()
  } catch {
    error.value = GENERIC_ERROR
  }
}

async function onGenerate() {
  generating.value = true
  error.value = ''
  try {
    await useAdminArticles().generate()
    await load()
  } catch {
    error.value = GENERIC_ERROR
  } finally {
    generating.value = false
  }
}

onMounted(load)
</script>
