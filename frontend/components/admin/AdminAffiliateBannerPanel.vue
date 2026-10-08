<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        data-testid="affiliate-section-banners"
        class="rounded-md px-3 py-2 text-sm font-medium"
        :class="activeSection === 'banners' ? 'bg-primary text-white' : 'bg-white text-ink border border-line'"
        :disabled="editorBusy || settingsBusy"
        @click="showBanners"
      >
        배너 관리
      </button>
      <button
        type="button"
        data-testid="affiliate-section-disclosures"
        class="rounded-md px-3 py-2 text-sm font-medium"
        :class="activeSection === 'disclosures' ? 'bg-primary text-white' : 'bg-white text-ink border border-line'"
        :disabled="editorBusy || settingsBusy"
        @click="showDisclosures()"
      >
        업체별 문구
      </button>
    </div>

    <section v-show="activeSection === 'banners'" class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
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
          <label for="affiliate-status-filter" class="mb-1 block text-xs font-medium text-muted">사용 설정</label>
          <select
            id="affiliate-status-filter"
            data-testid="affiliate-status-filter"
            :value="statusFilter"
            class="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            @change="onStatusFilterChange"
          >
            <option value="">전체</option>
            <option value="true">켜짐</option>
            <option value="false">꺼짐</option>
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
            <span class="mt-1 block text-xs text-muted">{{ providerLabels[item.provider] }} / {{ item.imageSourceType === 'upload' ? '업로드' : 'URL' }} / {{ item.isEnabled ? '사용 중' : '사용 안 함' }} / {{ disclosureRowLabel(item) }}</span>
            <span class="mt-1 block text-xs text-muted">
              {{ item.endDate === null ? '종료일 없음' : `종료일 ${item.endDate}` }}
              <span
                v-if="item.isExpired"
                :data-testid="`affiliate-expired-${item.id}`"
                class="ml-1 font-medium text-red-600"
              >
                기간 종료
              </span>
            </span>
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
        :provider-disclosures="providerDisclosures"
        :disclosure-load-state="disclosureLoadState"
        @saved="(dto) => onSaved(dto, editorSession)"
        @dirty-change="onEditorDirtyChange"
        @busy-change="onEditorBusyChange"
        @configure-disclosure="showDisclosures"
      />
      <p v-else class="py-20 text-center text-sm text-muted">
        왼쪽에서 배너를 선택하거나 새 배너를 등록하세요
      </p>
    </section>
    </section>

    <section v-show="activeSection === 'disclosures'" class="min-w-0 rounded-lg border border-line bg-white p-4">
      <AdminAffiliateDisclosureSettings
        :key="settingsSession"
        :settings="providerDisclosures"
        :load-state="disclosureLoadState"
        :initial-provider="settingsInitialProvider"
        @saved="onDisclosureSaved"
        @dirty-change="onSettingsDirtyChange"
        @busy-change="onSettingsBusyChange"
        @retry="loadDisclosures"
      />
    </section>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import AdminAffiliateDisclosureSettings from '~/components/admin/AdminAffiliateDisclosureSettings.vue'
import AdminAffiliateBannerEditor from '~/components/admin/AdminAffiliateBannerEditor.vue'
import { useAdminAffiliateBanners } from '~/composables/useAdminAffiliateBanners'
import { useAdminAffiliateDisclosures } from '~/composables/useAdminAffiliateDisclosures'
import { useApiBase } from '~/composables/useApiBase'
import type { AffiliateBannerDto, AffiliateProvider } from '~/types/affiliateBanner'
import type {
  AffiliateDisclosureLoadState,
  AffiliateProviderDisclosureDto,
} from '~/types/affiliateDisclosure'

type StatusFilter = '' | 'true' | 'false'
type ListLoadResult = 'applied' | 'stale' | 'failed'
type DisclosureLoadResult = 'applied' | 'stale' | 'failed'

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
const DISCLOSURE_LIST_REFRESH_ERROR = '문구는 저장됐지만 목록을 새로 불러오지 못했습니다'
const DISCLOSURE_DETAIL_REFRESH_ERROR = '문구는 저장됐지만 선택한 배너를 새로 불러오지 못했습니다'
const DIRTY_CONFIRM = '저장하지 않은 제휴 배너 변경 내용이 있습니다. 이동하시겠습니까?'
const SETTINGS_DIRTY_CONFIRM = '저장하지 않은 업체별 문구 변경 내용이 있습니다. 이동하시겠습니까?'
const limit = 10

const api = useAdminAffiliateBanners()
const disclosureApi = useAdminAffiliateDisclosures()
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
const activeSection = ref<'banners' | 'disclosures'>('banners')
const providerDisclosures = ref<AffiliateProviderDisclosureDto[]>([])
const disclosureLoadState = ref<AffiliateDisclosureLoadState>('loading')
const disclosureGeneration = ref(0)
const settingsDirty = ref(false)
const settingsBusy = ref(false)
const editorBusy = ref(false)
const settingsSession = ref(0)
const settingsInitialProvider = ref<AffiliateProvider>('coupang')
const disclosureSavedSinceRefresh = ref(false)

function confirmDiscard() {
  if (!isDirty.value) return true
  return window.confirm(DIRTY_CONFIRM)
}

function emitDirty() {
  emit('dirty-change', isDirty.value || settingsDirty.value)
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

async function loadDisclosures(): Promise<DisclosureLoadResult> {
  const generation = disclosureGeneration.value + 1
  disclosureGeneration.value = generation
  disclosureLoadState.value = 'loading'
  try {
    const rows = await disclosureApi.list()
    if (generation !== disclosureGeneration.value) return 'stale'
    providerDisclosures.value = rows
    disclosureLoadState.value = 'ready'
    return 'applied'
  } catch {
    if (generation !== disclosureGeneration.value) return 'stale'
    disclosureLoadState.value = 'error'
    return 'failed'
  }
}

function retry() {
  if (disclosureSavedSinceRefresh.value) {
    refreshAfterDisclosureChange()
    return
  }
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
  emitDirty()
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
  emitDirty()
  loadList()
}

function goToPage(nextPage: number) {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) return
  if (!confirmDiscard()) return
  page.value = nextPage
  isDirty.value = false
  emitDirty()
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
  emitDirty()
}

async function selectBanner(id: string) {
  if (!confirmDiscard()) return
  const generation = detailGeneration.value + 1
  detailGeneration.value = generation
  error.value = ''
  isDirty.value = false
  emitDirty()
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
  emitDirty()
  banners.value = upsertBanner(banners.value, dto)
  const refreshed = await loadList()
  if (refreshed === 'failed') error.value = REFRESH_ERROR
}

function onEditorDirtyChange(value: boolean) {
  isDirty.value = value
  emitDirty()
}

function onSettingsDirtyChange(value: boolean) {
  settingsDirty.value = value
  emitDirty()
}

function onEditorBusyChange(value: boolean) {
  editorBusy.value = value
}

function onSettingsBusyChange(value: boolean) {
  settingsBusy.value = value
}

async function showDisclosures(provider?: AffiliateProvider) {
  if (editorBusy.value || settingsBusy.value) return
  if (activeSection.value === 'banners' && !confirmDiscard()) return
  if (provider) settingsInitialProvider.value = provider
  else if (selectedBanner.value) settingsInitialProvider.value = selectedBanner.value.provider
  detailGeneration.value += 1
  listGeneration.value += 1
  loading.value = false
  isDirty.value = false
  editorSession.value += 1
  activeSection.value = 'disclosures'
  emitDirty()
}

async function showBanners() {
  if (editorBusy.value || settingsBusy.value) return
  if (activeSection.value === 'disclosures' && settingsDirty.value && !window.confirm(SETTINGS_DIRTY_CONFIRM)) return
  if (activeSection.value === 'disclosures') {
    settingsDirty.value = false
    settingsSession.value += 1
  }
  activeSection.value = 'banners'
  emitDirty()
  if (disclosureSavedSinceRefresh.value) {
    await refreshAfterDisclosureChange()
  }
}

function onDisclosureSaved(dto: AffiliateProviderDisclosureDto) {
  providerDisclosures.value = upsertDisclosure(providerDisclosures.value, dto)
  settingsDirty.value = false
  disclosureSavedSinceRefresh.value = true
  emitDirty()
}

async function refreshAfterDisclosureChange(): Promise<void> {
  error.value = ''
  const disclosureResult = await loadDisclosures()
  const listResult = await loadList()
  if (listResult === 'failed') {
    error.value = DISCLOSURE_LIST_REFRESH_ERROR
    if (disclosureResult === 'failed') disclosureLoadState.value = 'error'
    return
  }
  disclosureSavedSinceRefresh.value = false
  if (selectedBanner.value?.id) {
    const selectedId = selectedBanner.value.id
    const generation = detailGeneration.value + 1
    detailGeneration.value = generation
    try {
      const dto = await api.get(selectedId)
      if (generation !== detailGeneration.value) return
      selectedBanner.value = dto
      editorSession.value += 1
      expectedSaveId.value = dto.id
    } catch {
      if (generation === detailGeneration.value) {
        error.value = DISCLOSURE_DETAIL_REFRESH_ERROR
        disclosureSavedSinceRefresh.value = true
      }
    }
  }
  if (disclosureResult === 'failed') disclosureLoadState.value = 'error'
}

function upsertDisclosure(
  items: AffiliateProviderDisclosureDto[],
  dto: AffiliateProviderDisclosureDto
): AffiliateProviderDisclosureDto[] {
  const index = items.findIndex((item) => item.provider === dto.provider)
  if (index === -1) return [...items, dto]
  const next = [...items]
  next[index] = dto
  return next
}

function disclosureRowLabel(item: AffiliateBannerDto): string {
  if (item.disclosureSource === 'provider') return '업체 기본'
  if (item.disclosureSource === 'banner') return '배너 개별'
  return item.isEnabled ? '문구 설정 필요' : '문구 미등록'
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
  loadDisclosures()
})

onUnmounted(() => {
  listGeneration.value += 1
  detailGeneration.value += 1
  disclosureGeneration.value += 1
})
</script>
