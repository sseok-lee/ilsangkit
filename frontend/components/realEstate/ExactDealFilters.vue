<template>
  <form
    class="bg-white"
    :aria-busy="pending"
    aria-describedby="exact-filter-status"
    @submit.prevent
  >
    <div class="grid gap-3 md:grid-cols-4">
      <label class="grid gap-1 text-sm font-medium text-strong">
        거래 유형
        <select
          name="mode"
          class="min-h-11 rounded-md border border-line bg-white px-3 text-sm"
          v-model="currentMode"
          @change="onModeChange"
        >
          <option value="sale">매매</option>
          <option value="jeonse">전세</option>
          <option value="wolse">월세</option>
        </select>
      </label>

      <label class="grid gap-1 text-sm font-medium text-strong">
        전용면적
        <select
          name="area"
          class="min-h-11 rounded-md border border-line bg-white px-3 text-sm"
          v-model="currentArea"
          @change="emitArea"
        >
          <option v-if="displayedAreas.length === 0" value="">선택 가능한 면적 없음</option>
          <option v-for="area in displayedAreas" :key="area" :value="area">
            전용 {{ area }}㎡
          </option>
        </select>
      </label>

      <label class="grid gap-1 text-sm font-medium text-strong">
        조회 기간
        <select
          name="months"
          class="min-h-11 rounded-md border border-line bg-white px-3 text-sm"
          v-model="currentMonths"
          @change="emitMonths"
        >
          <option value="6">6개월</option>
          <option value="12">1년</option>
          <option value="36">3년</option>
          <option value="0">전체</option>
        </select>
      </label>

      <label v-if="currentMode === 'wolse'" class="grid gap-1 text-sm font-medium text-strong">
        보증금
        <select
          name="deposit"
          class="min-h-11 rounded-md border border-line bg-white px-3 text-sm"
          v-model="currentDeposit"
          @change="emitDeposit"
        >
          <option v-if="displayedDeposits.length === 0" value="">선택 가능한 보증금 없음</option>
          <option v-for="deposit in displayedDeposits" :key="deposit.amount" :value="String(deposit.amount)">
            {{ formatMoney(deposit.amount) }} · {{ deposit.count }}건
          </option>
        </select>
      </label>
    </div>

    <p id="exact-filter-status" class="mt-3 text-sm text-muted" aria-live="polite">
      <span :class="pending ? 'font-medium text-primary-700' : undefined">{{ appliedStatusText }}</span>
    </p>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AppliedFilters, DealMode, DetailOptions, DetailQuery, PeriodMonths } from '~/types/housingRedesign'
import { formatKoreanPrice } from '~/utils/formatters'

type FilterPatch = Partial<Pick<DetailQuery, 'mode' | 'months' | 'area' | 'deposit'>>

const props = defineProps<{
  filters: AppliedFilters
  options: DetailOptions
  pending: boolean
}>()

const emit = defineEmits<{
  patch: [patch: FilterPatch]
}>()

const currentMode = ref<DealMode>(props.filters.mode)
const currentArea = ref(props.filters.area ?? '')
const currentMonths = ref(String(props.filters.months))
const currentDeposit = ref(props.filters.deposit == null ? '' : String(props.filters.deposit))

const displayedAreas = computed(() => {
  if (props.filters.area && !props.options.areas.includes(props.filters.area)) {
    return [props.filters.area, ...props.options.areas]
  }
  return props.options.areas
})

const displayedDeposits = computed(() => {
  if (props.filters.deposit != null && !props.options.deposits.some(deposit => deposit.amount === props.filters.deposit)) {
    return [{ amount: props.filters.deposit, count: 0 }, ...props.options.deposits]
  }
  return props.options.deposits
})

const appliedStatusText = computed(() => {
  const parts = [props.pending ? '적용 중' : '적용 조건', modeLabel(props.filters.mode)]
  if (props.filters.area) parts.push(`전용 ${props.filters.area}㎡`)
  parts.push(periodLabel(props.filters.months))
  if (props.filters.mode === 'wolse' && props.filters.deposit != null) {
    parts.push(`보증금 ${formatMoney(props.filters.deposit)}`)
  }
  return parts.join(' · ')
})

watch(
  () => props.filters,
  filters => {
    currentMode.value = filters.mode
    currentArea.value = filters.area ?? ''
    currentMonths.value = String(filters.months)
    currentDeposit.value = filters.deposit == null ? '' : String(filters.deposit)
  },
  { deep: true }
)

function modeLabel(mode: DealMode): string {
  return mode === 'sale' ? '매매' : mode === 'jeonse' ? '전세' : '월세'
}

function periodLabel(months: PeriodMonths): string {
  if (months === 0) return '전체 기간'
  if (months === 6) return '6개월'
  if (months === 12) return '1년'
  return '3년'
}

function formatMoney(value: number): string {
  return formatKoreanPrice(value)
}

function onModeChange(event: Event): void {
  const mode = (event.target as HTMLSelectElement).value as DealMode
  currentMode.value = mode
  emit('patch', mode === 'wolse' ? { mode } : { mode, deposit: undefined })
}

function emitArea(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  currentArea.value = value
  emit('patch', { area: value || undefined })
}

function emitMonths(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  currentMonths.value = value
  emit('patch', { months: Number(value) as PeriodMonths })
}

function emitDeposit(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  currentDeposit.value = value
  emit('patch', { deposit: value === '' ? undefined : Number(value) })
}
</script>
