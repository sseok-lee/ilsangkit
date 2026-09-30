<template>
  <main class="min-h-screen bg-white">
    <section class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div class="pb-6">
        <p class="text-sm font-bold text-[#2450DC]">생활시설 탐색</p>
        <h1 class="mt-3 text-[28px] font-black leading-tight text-[#15213B] md:text-[36px]">
          지역을 먼저 고르고 생활시설을 확인하세요
        </h1>
        <p class="mt-3 max-w-2xl text-base leading-7 text-[#56627A]">
          지역과 검색어를 선택해 필요한 생활시설을 확인하세요.
        </p>

        <form class="mt-8 grid gap-3 rounded-2xl bg-[#F7F8FA] p-4 lg:grid-cols-[1fr_1fr_1.4fr_auto]" @submit.prevent="submitFilters">
          <label class="block">
            <span class="mb-1.5 block text-xs font-bold text-[#56627A]">시·도</span>
            <select
              v-model="draft.city"
              class="min-h-11 w-full rounded-md border border-[#D5DCE8] bg-white px-3 text-[#15213B] focus:border-[#2450DC] focus:outline-none focus:ring-2 focus:ring-[#2450DC]/20"
              aria-label="시·도 선택"
              @change="onDraftCityChange"
            >
              <option value="">시·도 선택</option>
              <option v-for="city in citiesWithDistricts" :key="city.slug" :value="city.slug">{{ city.name }}</option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs font-bold text-[#56627A]">구·군</span>
            <select
              v-model="draft.district"
              :disabled="!draft.city"
              class="min-h-11 w-full rounded-md border border-[#D5DCE8] bg-white px-3 text-[#15213B] focus:border-[#2450DC] focus:outline-none focus:ring-2 focus:ring-[#2450DC]/20 disabled:opacity-50"
              aria-label="구·군 선택"
            >
              <option value="">구·군 선택</option>
              <option v-for="district in draftDistricts" :key="district.slug" :value="district.slug">{{ district.name }}</option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs font-bold text-[#56627A]">검색어</span>
            <input
              v-model="draft.q"
              class="min-h-11 w-full rounded-md border border-[#D5DCE8] bg-white px-3 text-[#15213B] placeholder:text-[#56627A]/60 focus:border-[#2450DC] focus:outline-none focus:ring-2 focus:ring-[#2450DC]/20"
              placeholder="시설명, 주소, 장소"
              aria-label="생활시설 검색어"
            >
          </label>
          <button
            type="submit"
            class="mt-auto inline-flex min-h-11 items-center justify-center rounded-md bg-[#2450DC] px-5 text-sm font-black text-white hover:bg-[#1E43BA]"
          >
            검색
          </button>
        </form>

        <p v-if="inputError" class="mt-3 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{{ inputError }}</p>
        <p v-else-if="regionsErrorMessage" class="mt-3 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{{ regionsErrorMessage }}</p>
      </div>

      <section class="mt-6">
        <button v-if="regionsErrorMessage || renderError" type="button" class="mb-4 min-h-11 rounded-md border border-[#D5DCE8] bg-white px-5 text-sm font-semibold text-[#2450DC]" @click="retryLoad">다시 시도</button>
        <div v-if="pending" class="border-y border-[#E6E9F0] bg-white py-8 text-[#56627A]">
          생활시설을 불러오는 중입니다.
        </div>
        <div v-else-if="renderError" class="border-y border-red-100 bg-white py-8">
          <p class="text-lg font-bold text-red-700">생활시설 정보를 불러오지 못했습니다</p>
          <p class="mt-2 text-sm text-[#56627A]">잠시 후 다시 시도해 주세요.</p>
        </div>
        <div v-else-if="pageMessage" class="border-y border-[#E6E9F0] bg-white py-8">
          <p class="text-lg font-bold text-[#15213B]">{{ pageMessage }}</p>
          <p class="mt-2 text-sm text-[#56627A]">시·도와 구·군을 선택하면 시설 미리보기를 보여드립니다.</p>
        </div>
        <FacilityBrowseResults
          v-else-if="currentPayload?.result"
          :result="currentPayload.result"
        />
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FacilityBrowseResults from '~/components/facility/FacilityBrowseResults.vue'
import { suppressAds } from '~/composables/useAdsPolicy'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { useFacilityBrowse } from '~/composables/useFacilityBrowse'
import { useRegions } from '~/composables/useRegions'
import type { BrowseFilters, BrowseResult } from '~/types/facilityBrowse'
import { normalizeFacilityBrowseQuery, toFacilityBrowseQuery } from '~/utils/facilityBrowseQuery'

type PagePayload = { state: 'select' | 'invalid' | 'ready'; result: BrowseResult | null; message?: string }

const route = useRoute()
const router = useRouter()
const regions = useRegions()
const { fetchBrowse } = useFacilityBrowse()
const citiesWithDistricts = regions.citiesWithDistricts
suppressAds(true)

const draft = reactive<BrowseFilters>({ city: '', district: '', category: '', q: '', page: 1, departments: [] })
const inputError = ref('')
const currentPayload = ref<PagePayload | null>(null)
const renderError = ref<unknown>(null)
const pending = ref(false)
let activeRequest = 0
let activeController: AbortController | null = null

function queryFirst(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' || typeof first === 'number' ? String(first).trim() : ''
}

function safeNormalize(query: Record<string, unknown>): { filters: BrowseFilters; error: string } {
  try {
    return { filters: normalizeFacilityBrowseQuery(query), error: '' }
  } catch (error) {
    const message = error instanceof RangeError ? error.message : '검색 조건을 확인해 주세요.'
    return {
      filters: {
        city: queryFirst(query.city),
        district: queryFirst(query.district),
        category: '',
        q: queryFirst(query.q),
        page: 1,
        departments: [],
      },
      error: message,
    }
  }
}

const normalized = computed(() => safeNormalize(route.query as Record<string, unknown>))
const filters = computed(() => normalized.value.filters)
const regionLoadError = ref<string | null>(null)
const regionsErrorMessage = computed(() => regionLoadError.value || regions.error.value || '')
const selectedRegion = computed(() =>
  filters.value.city && filters.value.district
    ? regions.findRegionBySlug(filters.value.city, filters.value.district)
    : undefined,
)
const ready = computed(() =>
  !normalized.value.error
  && regions.isLoaded.value
  && !regionsErrorMessage.value
  && Boolean(filters.value.city)
  && Boolean(filters.value.district)
  && Boolean(selectedRegion.value),
)

const draftDistricts = computed(() => draft.city ? regions.getDistrictsByCity(draft.city) : [])

function syncDraft(next = filters.value) {
  draft.city = next.city
  draft.district = next.district
  draft.category = next.category
  draft.q = next.q
  draft.page = next.page
  draft.departments = [...next.departments]
}

function buildMessage(): string {
  if (normalized.value.error) return normalized.value.error
  if (regionsErrorMessage.value) return '지역 정보를 불러오지 못했습니다'
  if (!regions.isLoaded.value) return '지역 정보를 준비하는 중입니다'
  if (!filters.value.city || !filters.value.district) return '시·도와 구·군을 선택해 주세요'
  if (!selectedRegion.value) return '선택한 지역 조합을 찾을 수 없습니다'
  return ''
}

async function buildPayload(signal?: AbortSignal): Promise<PagePayload> {
  const message = buildMessage()
  if (!ready.value || message) return { state: message.includes('선택') || message.includes('준비') ? 'select' : 'invalid', result: null, message }
  return { state: 'ready', result: await fetchBrowse(filters.value, signal) }
}

const { data: regionData, error: regionAsyncError, refresh: refreshRegions } = await useAsyncData('facility-browse-regions', async () => {
  const items = await regions.loadRegions()
  // Serialize failure too: composable-local error refs are not part of the Nuxt SSR payload.
  return { items, error: regions.error.value || (!items.length ? '지역 정보를 불러오지 못했습니다' : null) }
})
function applyRegionData() {
  regionLoadError.value = regionAsyncError.value ? '지역 정보를 불러오지 못했습니다' : regionData.value?.error ?? null
  if (regionData.value?.items.length) regions.syncFromHydration(computed(() => regionData.value?.items ?? []))
}
applyRegionData()
if (import.meta.server && regionsErrorMessage.value) markDegradedResponse()

syncDraft()

function safeBrowseQueryKey(): Record<string, string> {
  try {
    return toFacilityBrowseQuery(filters.value)
  } catch {
    return {
      city: filters.value.city,
      district: filters.value.district,
      q: filters.value.q,
      invalid: normalized.value.error || 'invalid',
    }
  }
}

const browseKey = computed(() => `facility-browse:${JSON.stringify(safeBrowseQueryKey())}`)
const { data: initialPayload, error: browseAsyncError, pending: initialPending } = await useAsyncData(
  browseKey.value,
  () => buildPayload(),
  { default: () => ({ state: 'select', result: null, message: '시·도와 구·군을 선택해 주세요' }) },
)

currentPayload.value = initialPayload.value
renderError.value = browseAsyncError.value
pending.value = initialPending.value
if (import.meta.server && browseAsyncError.value) markDegradedResponse()

const pageMessage = computed(() => currentPayload.value?.result ? '' : currentPayload.value?.message || '')

async function loadResults() {
  syncDraft()
  renderError.value = null
  activeRequest += 1
  const requestId = activeRequest
  activeController?.abort()
  activeController = new AbortController()
  pending.value = true
  try {
    const payload = await buildPayload(activeController.signal)
    if (requestId === activeRequest) currentPayload.value = payload
  } catch (error) {
    if (requestId === activeRequest) renderError.value = error
  } finally {
    if (requestId === activeRequest) pending.value = false
  }
}
watch(() => route.query, loadResults, { deep: true })

async function retryLoad() {
  if (regionsErrorMessage.value) {
    await refreshRegions()
    applyRegionData()
  }
  await loadResults()
}

function onDraftCityChange() {
  draft.district = ''
  draft.page = 1
  draft.departments = []
}

async function submitFilters() {
  inputError.value = ''
  try {
    const query = toFacilityBrowseQuery({ ...draft, page: 1 })
    await router.push({ path: '/facilities', query })
  } catch (error) {
    inputError.value = error instanceof RangeError ? error.message : '검색 조건을 확인해 주세요.'
  }
}

useHead({
  title: '생활시설 지역 탐색 | 일상킷',
  meta: [
    { name: 'robots', content: 'noindex, follow' },
    { name: 'description', content: '선택한 지역 안에서 공공화장실, 주차장, 병원, 약국, 지하철 등 생활시설을 탐색합니다.' },
  ],
})
</script>
