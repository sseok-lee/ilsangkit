<template>
  <button
    type="button"
    :aria-label="`${region.targetRegion?.replaceAll('+', ', ')} 쓰레기 배출 일정 상세 정보 보기`"
    class="group w-full bg-white rounded-xl p-4 text-left shadow-subtle hover:shadow-lg transition-all duration-300 border cursor-pointer border-transparent hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    @click="emit('select', region)"
  >
    <div class="flex items-start gap-4">
      <!-- Icon -->
      <div class="shrink-0 w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
        <CategoryIcon category-id="trash" size="md" />
      </div>

      <!-- Details -->
      <div class="flex-1 min-w-0 pt-0.5">
        <!-- City badge -->
        <p v-if="region.city" class="text-slate-500 text-[11px] font-medium tracking-wide truncate">
          {{ shortCity }}{{ region.district ? ` · ${region.district}` : '' }}
        </p>

        <!-- Title -->
        <h3 class="text-slate-900 text-base font-bold truncate">
          {{ region.targetRegion?.replaceAll('+', ', ') }}
        </h3>

        <!-- Subtitle: emission place + type + management zone -->
        <p v-if="subtitle" class="text-slate-500 text-xs font-normal mt-1 truncate">
          {{ subtitle }}
        </p>

        <!-- 유형별 배출 요일·시간·방법.
             배지만 렌더하던 때는 크롤러가 받는 구·군 본문이 전국 어디나 같았다. -->
        <ul class="mt-2.5 space-y-1.5">
          <li v-for="row in wasteRows" :key="row.type" class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span
              :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', badgeClass(row.type)]"
            >
              {{ row.type }}
            </span>
            <span v-if="row.days" class="text-slate-700 text-xs font-medium">{{ row.days }}</span>
            <span v-if="row.time" class="text-slate-500 text-xs">{{ row.time }}</span>
            <span v-if="row.method" class="basis-full text-slate-500 text-xs line-clamp-2">{{ row.method }}</span>
          </li>
        </ul>

        <div class="mt-2 flex items-center gap-1.5 flex-wrap">
          <span
            v-if="region.uncollectedDay"
            class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"
          >
            <span class="material-symbols-outlined text-[14px]">warning</span>
            미수거
          </span>
          <!-- 원본 자료 기준일. DB 동기화 시각(syncedAt)과 다르므로 라벨로 구분한다. -->
          <span v-if="region.dataCreatedDate" class="text-slate-400 text-[11px]">
            자료 기준일 {{ region.dataCreatedDate }}
          </span>
        </div>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RegionSchedule, WasteType } from '~/composables/useWasteSchedule'
import { formatDays, formatTimeRange, normalizeProvidedText } from '~/utils/wasteSchedule'

const props = defineProps<{
  region: RegionSchedule
}>()

const emit = defineEmits<{
  (e: 'select', region: RegionSchedule): void
}>()

const shortCity = computed(() =>
  props.region.city?.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '') || ''
)

const subtitle = computed(() =>
  [props.region.emissionPlace, props.region.emissionPlaceType, props.region.managementZone]
    .map(value => normalizeProvidedText(value))
    .filter(Boolean)
    .join(' · ')
)

const wasteRows = computed(() =>
  props.region.wasteTypes.map(wt => ({
    type: wt.type,
    // 대형폐기물은 원본에 배출 요일이 없다(신청·장소 기준) — 없는 요일을 안내로 만들지 않는다.
    days: wt.dayOfWeek.length > 0
      ? formatDays(wt.dayOfWeek)
      : (wt.type === '대형폐기물' ? '' : '요일 정보 없음'),
    time: formatTimeRange(wt.beginTime, wt.endTime),
    method: normalizeProvidedText(wt.method),
  }))
)

const badgeClass = (type: WasteType): string => {
  const map: Record<WasteType, string> = {
    '일반쓰레기': 'bg-amber-100 text-amber-700',
    '음식물쓰레기': 'bg-green-100 text-green-700',
    '재활용': 'bg-teal-100 text-teal-700',
    '대형폐기물': 'bg-purple-100 text-purple-700',
  }
  return map[type] || ''
}
</script>
