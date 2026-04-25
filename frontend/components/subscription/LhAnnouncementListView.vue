<template>
  <div class="flex flex-col gap-3">
    <SectionBlock
      heading="LH 분양/임대 공고"
      subtext="LH 가 직접 공급하는 공고입니다. 청약홈과는 별도 접수처입니다."
    >
      <template #right>
        <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
          {{ total.toLocaleString() }}건
        </span>
      </template>

      <div class="mb-3 flex flex-wrap gap-2">
        <button
          v-for="t in TYPE_FILTERS"
          :key="t.code ?? 'all'"
          :class="filterChipClass(currentType === t.code)"
          @click="selectType(t.code)"
        >
          {{ t.label }}
        </button>
      </div>

      <div class="mb-3 flex flex-wrap gap-2">
        <button
          v-for="s in STATUS_FILTERS"
          :key="s.value ?? 'all'"
          :class="filterChipClass(currentStatus === s.value)"
          @click="selectStatus(s.value)"
        >
          {{ s.label }}
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <input
          v-model="regionInput"
          type="text"
          placeholder="지역명 (예: 경기도, 부산광역시)"
          class="w-full bg-slate-50 border border-line rounded-lg py-2.5 px-3 text-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
          @keydown.enter="applyRegion"
        />
        <button
          class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          @click="applyRegion"
        >
          지역 적용
        </button>
      </div>

      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-4 border border-line animate-pulse">
          <div class="space-y-3">
            <div class="h-4 bg-slate-200 rounded w-2/3"></div>
            <div class="h-3 bg-slate-100 rounded w-full"></div>
          </div>
        </div>
      </div>

      <div v-else-if="error" class="rounded-xl bg-red-50 p-8 text-center">
        <p class="text-red-700 font-semibold">데이터를 불러오는 중 오류가 발생했습니다</p>
        <button
          class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          @click="reload"
        >
          다시 시도
        </button>
      </div>

      <div v-else-if="items.length === 0" class="rounded-xl bg-slate-50 p-12 text-center">
        <p class="text-slate-600 font-medium">조건에 맞는 공고가 없습니다</p>
        <p class="text-slate-500 text-sm mt-1">필터를 다른 값으로 바꿔보세요</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <LhAnnouncementCard
          v-for="ann in items"
          :key="ann.id"
          :announcement="ann"
        />
      </div>

      <Pagination
        v-if="totalPages > 1"
        :current-page="currentPage"
        :total-pages="totalPages"
        @page-change="goToPage"
      />
    </SectionBlock>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useLhAnnouncement } from '~/composables/useLhAnnouncement'

interface TypeFilter { code?: string; label: string }
interface StatusFilter { value?: string; label: string }

const TYPE_FILTERS: TypeFilter[] = [
  { label: '전체' },
  { code: '06', label: '임대주택' },
  { code: '03', label: '분양주택' },
]
const STATUS_FILTERS: StatusFilter[] = [
  { label: '전체' },
  { value: '공고중', label: '공고중' },
  { value: '마감', label: '마감' },
]

const { items, total, totalPages, currentPage, loading, error, fetchList } = useLhAnnouncement()

const currentType = ref<string | undefined>(undefined)
const currentStatus = ref<string | undefined>(undefined)
const regionInput = ref('')
const regionFilter = ref<string | undefined>(undefined)
const page = ref(1)

const reload = (): Promise<void> => fetchList({
  uppAisTpCd: currentType.value,
  panSs: currentStatus.value,
  cnpNm: regionFilter.value,
  page: page.value,
  limit: 20,
})

function filterChipClass(active: boolean): string {
  return [
    'px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
    active
      ? 'bg-primary text-white border-primary'
      : 'bg-white text-slate-700 border-line hover:border-primary hover:text-primary',
  ].join(' ')
}

function selectType(code: string | undefined) {
  currentType.value = code
  page.value = 1
  void reload()
}

function selectStatus(value: string | undefined) {
  currentStatus.value = value
  page.value = 1
  void reload()
}

function applyRegion() {
  regionFilter.value = regionInput.value.trim() || undefined
  page.value = 1
  void reload()
}

function goToPage(p: number) {
  page.value = p
  void reload()
}

onMounted(() => {
  void reload()
})
</script>
