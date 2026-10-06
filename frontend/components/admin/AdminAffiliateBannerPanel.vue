<template>
  <section class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
    <aside class="flex min-w-0 flex-col gap-3">
      <div class="flex flex-wrap items-end gap-2">
        <div class="min-w-32 flex-1">
          <label for="affiliate-provider-filter" class="mb-1 block text-xs font-medium text-muted">업체</label>
          <select
            id="affiliate-provider-filter"
            data-testid="affiliate-provider-filter"
            :value="providerFilter"
            class="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            @change="onProviderFilterChange"
          >
            <option value="">전체</option>
            <option value="coupang">쿠팡</option>
            <option value="ali">알리</option>
            <option value="toss">토스</option>
          </select>
        </div>
        <div class="min-w-32 flex-1">
          <label for="affiliate-status-filter" class="mb-1 block text-xs font-medium text-muted">상태</label>
          <select
            id="affiliate-status-filter"
            data-testid="affiliate-status-filter"
            :value="statusFilter"
            class="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            @change="onStatusFilterChange"
          >
            <option value="">전체</option>
            <option value="true">사용 중</option>
            <option value="false">사용 안 함</option>
          </select>
        </div>
        <button
          type="button"
          data-testid="affiliate-new"
          class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white"
          @click="openNew"
        >
          등록
        </button>
      </div>

      <p v-if="error" data-testid="affiliate-error" role="alert" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ error }}
      </p>
      <button
        v-if="error"
        type="button"
        data-testid="affiliate-retry"
        class="self-start rounded-md bg-background-light px-3 py-2 text-sm font-medium text-ink"
        @click="retry"
      >
        다시 시도
      </button>

      <p v-if="loading" data-testid="affiliate-loading" class="text-sm text-muted">
        불러오는 중...
      </p>

      <div v-else class="flex flex-col gap-2">
        <button
          v-for="item in banners"
          :key="item.id"
          type="button"
          :data-testid="`affiliate-row-${item.id}`"
          class="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 rounded-md border p-3 text-left transition-colors"
          :class="selectedBanner?.id === item.id ? 'border-primary bg-primary/5' : 'border-line bg-white hover:bg-background-light'"
          @click="selectBanner(item.id)"
        >
          <span class="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md bg-background-light text-xs text-muted">
            <img
              v-if="!brokenImages.has(item.id)"
              :src="resolveImageUrl(item.imageUrl)"
              :alt="item.altText"
              class="h-full w-full object-cover"
              referrerpolicy="no-referrer"
              @error="brokenImages.add(item.id)"
            >
            <span v-else>이미지 없음</span>
          </span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-semibold text-ink">{{ item.name }}</span>
            <span class="mt-1 block text-xs text-muted">{{ providerLabels[item.provider] }} / {{ item.imageSourceType === 'upload' ? '업로드' : 'URL' }} / {{ item.isEnabled ? '사용 중' : '사용 안 함' }}</span>
            <span class="mt-1 block truncate text-xs text-muted">수정일 {{ formatDate(item.updatedAt) }}</span>
          </span>
        </button>

        <p v-if="banners.length === 0" class="rounded-md border border-dashed border-line bg-white px-3 py-8 text-center text-sm text-muted">
          등록된 배너가 없습니다
        </p>
      </div>

      <div class="flex items-center justify-between gap-2">
        <button
          type="button"
          data-testid="affiliate-page-prev"
          class="rounded-md bg-background-light px-3 py-2 text-sm font-medium text-ink disabled:opacity-50"
          :disabled="page <= 1"
          @click="goToPage(page - 1)"
        >
          이전
        </button>
        <span class="text-sm text-muted">{{ page }} / {{ totalPages }}</span>
        <button
          type="button"
          data-testid="affiliate-page-next"
          class="rounded-md bg-background-light px-3 py-2 text-sm font-medium text-ink disabled:opacity-50"
          :disabled="page >= totalPages"
          @click="goToPage(page + 1)"
        >
          다음
        </button>
      </div>
    </aside>

    <section class="min-w-0 rounded-lg border border-line bg-white p-4">
      <AdminAffiliateBannerEditor
        v-if="editorOpen"
        :key="editorSession"
        :banner="selectedBanner"
        @saved="(dto) => onSaved(dto, editorSession)"
        @dirty-change="onEditorDirtyChange"
      />
      <p v-else class="py-20 text-center text-sm text-muted">
        왼쪽에서 배너를 선택하거나 새 배너를 등록하세요
      </p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminAffiliateBannerEditor from '~/components/admin/AdminAffiliateBannerEditor.vue'
import { useAdminAffiliateBanners } from '~/composables/useAdminAffiliateBanners'
import { useApiBase } from '~/composables/useApiBase'
import type { AffiliateBannerDto, AffiliateProvider } from '~/types/affiliateBanner'

type StatusFilter = '' | 'true' | 'false'
type ListLoadResult = 'applied' | 'stale' | 'failed'

const emit = defineEmits<{
  'dirty-change': [value: boolean]
}>()

const providerLabels: Record<AffiliateProvider, string> = {
  coupang: '쿠팡',
  ali: '알리',
  toss: '토스',
}

const GENERIC_ERROR = '문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
const REFRESH_ERROR = '저장은 완료됐지만 목록을 새로고침하지 못했습니다.'
const DIRTY_CONFIRM = '저장하지 않은 제휴 배너 변경 내용이 있습니다. 이동하시겠습니까?'
const limit = 10

const api = useAdminAffiliateBanners()
const apiBase = useApiBase()
const banners = ref<AffiliateBannerDto[]>([])
const selectedBanner = ref<AffiliateBannerDto | null>(null)
const editorOpen = ref(false)
const providerFilter = ref<'' | AffiliateProvider>('')
const statusFilter = ref<StatusFilter>('')
const page = ref(1)
const totalPages = ref(1)
const loading = ref(false)
const error = ref('')
const isDirty = ref(false)
const listGeneration = ref(0)
const detailGeneration = ref(0)
const editorSession = ref(0)
const expectedSaveId = ref<string | null>('new')
const brokenImages = ref(new Set<string>())

function confirmDiscard() {
  if (!isDirty.value) return true
  return window.confirm(DIRTY_CONFIRM)
}

async function loadList(): Promise<ListLoadResult> {
  const generation = listGeneration.value + 1
  listGeneration.value = generation
  loading.value = true
  error.value = ''
  try {
    const result = await api.list({
      page: page.value,
      limit,
      ...(providerFilter.value ? { provider: providerFilter.value } : {}),
      ...(statusFilter.value ? { isEnabled: statusFilter.value === 'true' } : {}),
    })
    if (generation !== listGeneration.value) return 'stale'
    banners.value = result.items
    totalPages.value = Math.max(1, result.totalPages)
    brokenImages.value = new Set([...brokenImages.value].filter((id) => result.items.some((item) => item.id === id)))
    return 'applied'
  } catch {
    if (generation !== listGeneration.value) return 'stale'
    error.value = GENERIC_ERROR
    return 'failed'
  } finally {
    if (generation === listGeneration.value) loading.value = false
  }
}

function retry() {
  loadList()
}

function onProviderFilterChange(event: Event) {
  const next = (event.target as HTMLSelectElement).value as '' | AffiliateProvider
  if (next === providerFilter.value) return
  if (!confirmDiscard()) {
    ;(event.target as HTMLSelectElement).value = providerFilter.value
    return
  }
  providerFilter.value = next
  page.value = 1
  isDirty.value = false
  emit('dirty-change', false)
  loadList()
}

function onStatusFilterChange(event: Event) {
  const next = (event.target as HTMLSelectElement).value as StatusFilter
  if (next === statusFilter.value) return
  if (!confirmDiscard()) {
    ;(event.target as HTMLSelectElement).value = statusFilter.value
    return
  }
  statusFilter.value = next
  page.value = 1
  isDirty.value = false
  emit('dirty-change', false)
  loadList()
}

function goToPage(nextPage: number) {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) return
  if (!confirmDiscard()) return
  page.value = nextPage
  isDirty.value = false
  emit('dirty-change', false)
  loadList()
}

function openNew() {
  if (!confirmDiscard()) return
  detailGeneration.value += 1
  editorSession.value += 1
  expectedSaveId.value = null
  selectedBanner.value = null
  editorOpen.value = true
  isDirty.value = false
  emit('dirty-change', false)
}

async function selectBanner(id: string) {
  if (!confirmDiscard()) return
  const generation = detailGeneration.value + 1
  detailGeneration.value = generation
  error.value = ''
  isDirty.value = false
  emit('dirty-change', false)
  try {
    const dto = await api.get(id)
    if (generation !== detailGeneration.value) return
    editorSession.value += 1
    expectedSaveId.value = dto.id
    selectedBanner.value = dto
    editorOpen.value = true
  } catch {
    if (generation === detailGeneration.value) error.value = GENERIC_ERROR
  }
}

async function onSaved(dto: AffiliateBannerDto, session: number) {
  if (session !== editorSession.value) return
  if (expectedSaveId.value && dto.id !== expectedSaveId.value) return
  if (expectedSaveId.value === null && banners.value.some((item) => item.id === dto.id)) return
  expectedSaveId.value = dto.id
  selectedBanner.value = dto
  editorOpen.value = true
  isDirty.value = false
  emit('dirty-change', false)
  banners.value = upsertBanner(banners.value, dto)
  const refreshed = await loadList()
  if (refreshed === 'failed') error.value = REFRESH_ERROR
}

function onEditorDirtyChange(value: boolean) {
  isDirty.value = value
  emit('dirty-change', value)
}

function upsertBanner(items: AffiliateBannerDto[], dto: AffiliateBannerDto) {
  const index = items.findIndex((item) => item.id === dto.id)
  if (index === -1) return [dto, ...items]
  const next = [...items]
  next[index] = dto
  return next
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ko-KR')
}

function resolveImageUrl(value: string) {
  if (/^https?:\/\//.test(value)) return value
  if (!value.startsWith('/')) return value
  return `${apiBase}${value}`
}

onMounted(() => {
  loadList()
})
</script>
