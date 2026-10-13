<template>
  <section class="mt-6">
    <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-ink">배출 일정</h2>
        <p class="mt-1 text-sm text-muted">{{ headingText }}</p>
      </div>
      <span v-if="result" class="text-sm text-muted tabular-nums">
        <strong class="font-semibold text-ink">{{ result.total.toLocaleString('ko-KR') }}</strong>건
      </span>
    </div>

    <div v-if="pending" class="flex items-center justify-center py-10" role="status" aria-live="polite" aria-busy="true">
      <div class="text-center">
        <div class="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        <p class="text-sm text-muted">배출 일정 목록을 불러오는 중입니다</p>
      </div>
    </div>

    <div v-else-if="error" role="alert" class="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p class="text-sm font-semibold text-red-800">배출 일정 목록을 불러오지 못했습니다</p>
      <button
        type="button"
        class="mt-3 min-h-[44px] rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        @click="emit('retry')"
      >
        다시 시도
      </button>
    </div>

    <template v-else-if="result">
      <div v-if="isOutOfRange" class="rounded-[10px] border border-line bg-white p-6 text-center">
        <p class="font-semibold text-ink">요청한 페이지에 표시할 배출 일정이 없습니다</p>
        <a :href="firstPageHref" class="mt-3 inline-flex min-h-[44px] items-center rounded-[7px] border border-line px-4 text-sm font-semibold text-primary">
          첫 페이지로 이동
        </a>
      </div>

      <div v-else-if="result.schedules.length > 0" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="schedule in result.schedules" :key="schedule.id" class="min-w-0">
          <WasteScheduleCard :region="schedule" />
          <p v-if="safeExcerpt(schedule)" class="mt-2 rounded-[7px] bg-background-light px-3 py-2 text-xs leading-5 text-muted">
            {{ safeExcerpt(schedule) }}
          </p>
        </div>
      </div>

      <div v-else class="rounded-[10px] border border-line bg-white p-8 text-center">
        <p class="text-lg font-semibold text-ink">{{ emptyTitle }}</p>
        <p class="mt-1 text-sm text-muted">{{ emptyDescription }}</p>
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          <a v-if="query.keyword" :href="clearKeywordHref" class="min-h-[40px] rounded-[7px] border border-line px-3 py-2 text-sm font-semibold text-primary">검색어 지우기</a>
          <a v-if="query.areaId" :href="clearAreaHref" class="min-h-[40px] rounded-[7px] border border-line px-3 py-2 text-sm font-semibold text-primary">동 필터 지우기</a>
        </div>
      </div>

      <Pagination
        v-if="result.totalPages > 1 && !isOutOfRange"
        :current-page="result.page"
        :total-pages="result.totalPages"
        :href-for="hrefFor"
        @page-change="(page) => emit('page-change', page)"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Pagination from '~/components/common/Pagination.vue'
import WasteScheduleCard from '~/components/facility/WasteScheduleCard.vue'
import type { RegionSchedule, RegionScheduleResponse } from '~/composables/useWasteSchedule'
import type { WasteListQuery } from '~/types/wasteList'
import { splitWasteTargetForDisplay } from '~/utils/wasteSchedule'

const props = defineProps<{
  result: RegionScheduleResponse | null
  query: WasteListQuery
  pending: boolean
  error: unknown
  hrefFor: (page: number) => string
  clearKeywordHref: string
  clearAreaHref: string
  firstPageHref: string
}>()

const emit = defineEmits<{
  (e: 'retry'): void
  (e: 'page-change', page: number): void
}>()

const isOutOfRange = computed(() =>
  !!props.result && props.query.page > props.result.totalPages && props.result.total > 0
)

const headingText = computed(() => {
  if (props.query.areaId) return '검증된 동 필터에 연결된 원본 일정입니다'
  if (props.query.coverage === 'unresolved') return '동 연결 확인이 필요한 원본 일정입니다'
  return '원본 한 건을 카드 하나로 보여줍니다'
})

const emptyTitle = computed(() => {
  if (props.query.areaId) return '선택한 동에 연결된 배출 일정이 없습니다'
  if (props.query.coverage === 'unresolved') return '동 연결 확인이 필요한 원본이 없습니다'
  if (props.query.keyword) return '검색어와 일치하는 배출 일정이 없습니다'
  return '이 지역에 등록된 배출 일정이 없습니다'
})

const emptyDescription = computed(() => {
  if (props.query.keyword) return '검색어를 지우거나 다른 대상 지역·배출 장소로 검색해보세요'
  return '다른 지역 조건으로 다시 확인해보세요'
})

function safeExcerpt(schedule: RegionSchedule): string {
  const keyword = props.query.keyword?.trim()
  if (!keyword) return ''
  const source = [schedule.targetRegion, schedule.emissionPlace, schedule.managementZone]
    .filter(Boolean)
    .join(' · ')
  const index = source.toLocaleLowerCase('ko-KR').indexOf(keyword.toLocaleLowerCase('ko-KR'))
  if (index === -1) return ''
  const titleTokens = splitWasteTargetForDisplay(schedule.targetRegion || '').slice(0, 3).join(' ')
  if (titleTokens.includes(keyword)) return ''
  const start = Math.max(0, index - 16)
  const prefix = start > 0 ? '…' : ''
  return `${prefix}${source.slice(start, index + keyword.length + 24)}`
}
</script>
