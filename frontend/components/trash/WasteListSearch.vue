<template>
  <form class="rounded-[10px] border border-line bg-white p-4" @submit.prevent="submit">
    <div class="grid gap-3 md:grid-cols-[1fr_1fr_1.4fr_auto]">
      <input
        v-model.trim="draft.city"
        name="city"
        class="min-h-[44px] rounded-[7px] border border-line bg-white px-3 text-sm text-ink"
        placeholder="시도"
        aria-label="시도"
      >
      <input
        v-model.trim="draft.district"
        name="district"
        class="min-h-[44px] rounded-[7px] border border-line bg-white px-3 text-sm text-ink"
        placeholder="시군구"
        aria-label="시군구"
      >
      <input
        v-model.trim="draft.keyword"
        name="keyword"
        maxlength="100"
        class="min-h-[44px] rounded-[7px] border border-line bg-white px-3 text-sm text-ink"
        placeholder="대상 지역·배출 장소 검색"
        aria-label="대상 지역·배출 장소 검색"
      >
      <UiButton type="submit" variant="primary">검색</UiButton>
    </div>

    <div v-if="areaFilterEnabled" class="mt-3">
      <label class="mb-1 block text-xs font-semibold text-muted" for="waste-area-filter">검증된 동 필터</label>
      <select
        id="waste-area-filter"
        v-model="draftAreaId"
        name="areaId"
        class="min-h-[44px] w-full rounded-[7px] border border-line bg-white px-3 text-sm text-ink md:max-w-xs"
        :disabled="areasPending || !!areasError"
        @change="selectArea"
      >
        <option value="">전체 원본</option>
        <option v-for="area in areas" :key="area.areaId" :value="String(area.areaId)">
          {{ area.name }} ({{ area.scheduleCount.toLocaleString('ko-KR') }}건)
        </option>
      </select>
      <p v-if="areasPending" class="mt-2 text-xs text-muted">동 목록을 불러오는 중입니다</p>
      <div v-else-if="areasError" class="mt-2 flex flex-wrap items-center gap-2 text-xs text-red-700">
        <span>동 목록을 불러오지 못했습니다</span>
        <button
          type="button"
          data-testid="retry-areas"
          class="min-h-[36px] rounded-[7px] border border-red-200 bg-red-50 px-3 font-semibold"
          @click="emit('retry-areas')"
        >
          다시 시도
        </button>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import UiButton from '~/components/common/UiButton.vue'
import type { AreaSummary } from '~/types/wasteArea'
import type { SelectedWasteArea, WasteListQuery } from '~/types/wasteList'

const props = defineProps<{
  query: WasteListQuery
  areas: AreaSummary[]
  selectedArea?: SelectedWasteArea
  areasPending: boolean
  areasError: unknown
  areaFilterEnabled: boolean
}>()

const emit = defineEmits<{
  (e: 'search', query: { city?: string; district?: string; areaId?: number; keyword?: string; coverage?: 'unresolved' }): void
  (e: 'retry-areas'): void
}>()

const draft = reactive({
  city: props.query.city || '',
  district: props.query.district || '',
  keyword: props.query.keyword || '',
})
const draftAreaId = ref(props.query.areaId ? String(props.query.areaId) : '')

watch(() => props.query, (query) => {
  draft.city = query.city || ''
  draft.district = query.district || ''
  draft.keyword = query.keyword || ''
  draftAreaId.value = query.areaId ? String(query.areaId) : ''
}, { deep: true })

function parseDraftAreaId(): number | undefined {
  const areaId = draftAreaId.value ? Number.parseInt(draftAreaId.value, 10) : undefined
  return Number.isSafeInteger(areaId) ? areaId : undefined
}

function regionChanged(): boolean {
  return draft.city !== (props.query.city || '') || draft.district !== (props.query.district || '')
}

function baseQuery(options: { preserveArea?: boolean; preserveCoverage?: boolean } = {}) {
  const next = {
    city: draft.city || undefined,
    district: draft.district || undefined,
    keyword: draft.keyword || undefined,
  } as { city?: string; district?: string; areaId?: number; keyword?: string; coverage?: 'unresolved' }

  const areaId = options.preserveArea && !regionChanged() ? parseDraftAreaId() : undefined
  if (areaId) {
    next.areaId = areaId
    return next
  }

  if (options.preserveCoverage && props.query.coverage === 'unresolved') {
    next.coverage = 'unresolved'
  }

  return next
}

function submit() {
  emit('search', baseQuery({ preserveArea: true, preserveCoverage: true }))
}

function selectArea() {
  const areaId = parseDraftAreaId()
  emit('search', {
    ...baseQuery(),
    ...(areaId ? { areaId } : {}),
  })
}
</script>
