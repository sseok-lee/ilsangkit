<template>
  <SectionBlock heading="배출 일정" :subtext="`${total.toLocaleString('ko-KR')}건 · 지역별 배출 요일과 방법`">
    <template #right>
      <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
        {{ total.toLocaleString('ko-KR') }}건
      </span>
    </template>

    <!-- 로딩 -->
    <div v-if="loading" class="flex items-center justify-center py-10">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
        <p class="text-slate-500 text-sm">배출 일정 조회 중...</p>
      </div>
    </div>

    <div v-else>
      <!-- 담당 부서 연락처 -->
      <div v-if="contact" class="bg-primary-50 rounded-xl p-4 border border-primary-100 mb-4">
        <div class="flex items-center gap-2 mb-1">
          <span class="material-symbols-outlined text-primary-500 text-[18px]">support_agent</span>
          <span class="font-semibold text-primary-900 text-sm">{{ contact.name }}</span>
        </div>
        <a
          v-if="contact.phone"
          :href="`tel:${contact.phone}`"
          class="text-primary text-sm hover:underline flex items-center gap-1"
        >
          <span class="material-symbols-outlined text-[16px]">call</span>
          {{ contact.phone }}
        </a>
      </div>

      <!-- 배출 일정 목록 -->
      <div v-if="schedules.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <WasteScheduleCard
          v-for="region in schedules"
          :key="region.id"
          :region="region"
        />
      </div>

      <!-- 결과 없음 -->
      <div v-else class="py-12 text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
          <span class="material-symbols-outlined text-[32px] text-slate-500">delete</span>
        </div>
        <p class="text-slate-700 font-semibold text-lg">등록된 배출 일정이 없습니다</p>
        <p class="text-slate-500 text-sm mt-1">해당 지역의 배출 정보가 아직 등록되지 않았어요</p>
      </div>

      <!-- 페이지네이션 -->
      <Pagination
        v-if="totalPages > 1"
        :current-page="currentPage"
        :total-pages="totalPages"
        @page-change="(page) => emit('page-change', page)"
      />
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import SectionBlock from '~/components/common/SectionBlock.vue'
import type { RegionSchedule } from '~/composables/useWasteSchedule'

defineProps<{
  total: number
  loading: boolean
  contact: { name: string; phone?: string } | null
  schedules: RegionSchedule[]
  currentPage: number
  totalPages: number
}>()

const emit = defineEmits<{
  (e: 'page-change', page: number): void
}>()
</script>
