<template>
  <div>
    <div v-if="result.mode === 'grouped'" class="space-y-10">
      <EmptyState
        v-if="result.groups.length === 0"
        title="조건에 맞는 생활시설이 없습니다"
        description="검색어를 줄이거나 다른 구·군을 선택해 보세요."
      />
      <section
        v-for="group in result.groups"
        :key="group.category"
        class="border-t border-line pt-6"
      >
        <div class="mb-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-sm font-semibold text-muted">생활시설 목록</p>
            <h2 class="mt-1 text-xl font-bold text-ink">
              {{ group.label }}
              <span class="ml-2 text-base font-semibold text-muted">{{ group.count.toLocaleString() }} {{ group.unit }}</span>
            </h2>
          </div>
          <NuxtLink
            :to="listHref(group.category)"
            class="inline-flex min-h-11 items-center justify-center rounded-md border border-line-2 px-4 text-sm font-bold text-ink hover:border-primary/40"
          >
            {{ group.label }} 전체 보기
          </NuxtLink>
        </div>
        <div class="divide-y divide-line">
          <FacilityBrowseRow
            v-for="item in group.items"
            :key="`${item.category}:${item.id}`"
            :item="item"
          />
        </div>
      </section>
    </div>

    <div v-else class="space-y-4">
      <div class="border-t border-line pt-6">
        <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-sm font-semibold text-primary">{{ result.unit }} 목록</p>
            <h2 class="mt-1 text-xl font-bold text-ink">
              {{ listLabel }}
              <span class="ml-2 text-base font-semibold text-muted">{{ result.total.toLocaleString() }} {{ result.unit }}</span>
            </h2>
          </div>
          <NuxtLink
            :to="groupedHref"
            class="inline-flex min-h-11 items-center justify-center rounded-md border border-line-2 px-4 text-sm font-bold text-ink hover:border-primary/40"
          >
            전체 미리보기
          </NuxtLink>
        </div>
        <EmptyState
          v-if="result.items.length === 0"
          title="조건에 맞는 생활시설이 없습니다"
          description="검색어를 줄이거나 다른 구·군을 선택해 보세요."
        />
        <div v-else class="divide-y divide-line">
          <FacilityBrowseRow
            v-for="item in result.items"
            :key="`${item.category}:${item.id}`"
            :item="item"
          />
        </div>
      </div>
      <Pagination
        v-if="result.totalPages > 1"
        :current-page="result.page"
        :total-pages="result.totalPages"
        :href-for="pageHref"
        @page-change="onPageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '~/components/common/EmptyState.vue'
import Pagination from '~/components/common/Pagination.vue'
import FacilityBrowseRow from '~/components/facility/FacilityBrowseRow.vue'
import type { BrowseCategory, BrowseFilters, BrowseResult } from '~/types/facilityBrowse'
import { normalizeFacilityBrowseQuery, toFacilityBrowseQuery } from '~/utils/facilityBrowseQuery'

const props = defineProps<{ result: BrowseResult }>()
const route = useRoute()
const router = useRouter()

const CATEGORY_LABELS: Record<string, string> = {
  toilet: '공공화장실',
  trash: '쓰레기배출',
  wifi: '무료와이파이',
  clothes: '의류수거함',
  parking: '공영주차장',
  aed: '자동심장충격기',
  library: '공공도서관',
  hospital: '병원',
  pharmacy: '약국',
  park: '공원',
  school: '학교',
  market: '전통시장',
  childcare: '어린이집',
  'ev-charger': '전기차충전소',
  sports: '체육시설',
  subway: '지하철역',
}

const filters = computed<BrowseFilters>(() => normalizeFacilityBrowseQuery(route.query as Record<string, unknown>))
const listLabel = computed(() => props.result.mode === 'list' ? CATEGORY_LABELS[props.result.category] ?? props.result.category : '')

function hrefFor(next: BrowseFilters): string {
  const query = toFacilityBrowseQuery(next)
  const params = new URLSearchParams(query)
  const qs = params.toString()
  return qs ? `/facilities?${qs}` : '/facilities'
}

function listHref(category: BrowseCategory): string {
  return hrefFor({ ...filters.value, category, page: 1 })
}

const groupedHref = computed(() => hrefFor({ ...filters.value, category: '', page: 1, departments: [] }))

function pageHref(page: number): string {
  return hrefFor({ ...filters.value, page })
}

async function onPageChange(page: number) {
  await router.push(pageHref(page))
}
</script>
