<template>
  <SectionBlock heading="동별 배출 안내" :subtext="headingSubtext">
    <template #right>
      <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
        {{ list.total.toLocaleString('ko-KR') }}지역
      </span>
    </template>

    <form class="mb-4 grid gap-2 md:grid-cols-[1fr_1fr_1.5fr_auto]" @submit.prevent="submit">
      <input
        v-model.trim="draft.city"
        name="city"
        class="min-h-[44px] rounded-lg border border-[#E6E9F0] bg-white px-3 text-sm text-[#15213B]"
        placeholder="시도"
        aria-label="시도"
      >
      <input
        v-model.trim="draft.district"
        name="district"
        class="min-h-[44px] rounded-lg border border-[#E6E9F0] bg-white px-3 text-sm text-[#15213B]"
        placeholder="시군구"
        aria-label="시군구"
      >
      <input
        v-model.trim="draft.keyword"
        name="keyword"
        maxlength="100"
        class="min-h-[44px] rounded-lg border border-[#E6E9F0] bg-white px-3 text-sm text-[#15213B]"
        placeholder="동 이름 검색"
        aria-label="동 이름 검색"
      >
      <button type="submit" class="btn-primary min-h-[44px] whitespace-nowrap px-4 text-sm">
        검색
      </button>
    </form>

    <div v-if="pending" class="flex items-center justify-center py-10" role="status" aria-live="polite" aria-busy="true">
      <div class="text-center">
        <div class="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        <p class="text-sm text-[#56627A]">동별 배출 안내 조회 중...</p>
      </div>
    </div>

    <div v-else-if="error" role="alert" class="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p class="text-sm font-semibold text-red-800">동별 배출 안내를 불러오지 못했습니다</p>
      <button
        type="button"
        class="mt-3 min-h-[44px] rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        @click="emit('retry')"
      >
        다시 시도
      </button>
    </div>

    <template v-else>
      <div v-if="list.items.length > 0" class="border-t border-[#E6E9F0]">
        <WasteAreaRow v-for="area in list.items" :key="area.areaId" :area="area" />
      </div>

      <EmptyState
        v-else
        icon="delete"
        title="확인된 동별 배출 안내가 없습니다"
        description="다른 지역이나 동 이름으로 검색해보세요"
      />

      <div v-if="list.unresolved.count > 0" class="mt-4 rounded-lg border border-[#E6E9F0] bg-[#F7F8FA] p-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="font-semibold text-[#15213B]">동 연결 확인이 필요한 원문</p>
            <p class="mt-1 text-sm text-[#56627A]">{{ list.unresolved.count.toLocaleString('ko-KR') }}건</p>
          </div>
          <NuxtLink
            v-if="unresolvedHref"
            :to="unresolvedHref"
            class="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#E6E9F0] bg-white px-4 text-sm font-semibold text-[#2450DC] hover:bg-[#F7F8FA]"
          >
            원문 보기
          </NuxtLink>
        </div>
      </div>

      <Pagination
        :current-page="list.page"
        :total-pages="list.totalPages"
        :href-for="hrefFor"
        @page-change="(page) => emit('page-change', page)"
      />
    </template>
  </SectionBlock>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import Pagination from '~/components/common/Pagination.vue'
import WasteAreaRow from '~/components/trash/WasteAreaRow.vue'
import type { AreaList, AreaQuery } from '~/types/wasteArea'

const props = defineProps<{
  list: AreaList
  query: AreaQuery
  pending: boolean
  error: unknown
  hrefFor: (page: number) => string
}>()

const emit = defineEmits<{
  (e: 'search', query: Pick<AreaQuery, 'city' | 'district' | 'keyword'>): void
  (e: 'page-change', page: number): void
  (e: 'retry'): void
}>()

const draft = reactive({
  city: props.query.city || '',
  district: props.query.district || '',
  keyword: props.query.keyword || '',
})

watch(() => props.query, (query) => {
  draft.city = query.city || ''
  draft.district = query.district || ''
  draft.keyword = query.keyword || ''
}, { deep: true })

const headingSubtext = computed(() => `확인된 지역 ${props.list.total.toLocaleString('ko-KR')}개`)
const unresolvedHref = computed(() => {
  if (props.list.unresolved.href) return props.list.unresolved.href
  const href = props.hrefFor(1)
  return `${href}${href.includes('?') ? '&' : '?'}coverage=unresolved`
})

function submit() {
  emit('search', {
    city: draft.city || undefined,
    district: draft.district || undefined,
    keyword: draft.keyword || undefined,
  })
}
</script>
