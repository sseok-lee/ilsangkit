<template>
  <SectionBlock variant="flat" heading="관리비" :subtext="`K-apt 관리비 공개 · ${formatFeeMonth(fee.month)} 부과분`">
    <div class="grid gap-6 md:grid-cols-2 md:gap-8">
      <div>
        <p class="text-[12px] md:text-[13px] text-muted">세대 평균 월 관리비</p>
        <p class="mt-1 text-[26px] md:text-[30px] font-bold text-strong tabular-nums leading-tight">
          {{ formatWon(fee.total) }}
        </p>

        <div class="mt-3 flex h-2.5 rounded overflow-hidden bg-surface-2" aria-hidden="true">
          <span
            v-for="part in parts"
            :key="part.label"
            class="block h-full"
            :class="part.color"
            :style="{ width: `${part.ratio * 100}%` }"
          />
        </div>
        <ul class="mt-2 space-y-1 text-[12px] md:text-[13px]" data-testid="fee-parts">
          <li v-for="part in parts" :key="part.label" class="flex items-center gap-2">
            <span class="inline-block w-2 h-2 rounded-full shrink-0" :class="part.color" aria-hidden="true" />
            <span class="text-muted">{{ part.label }}</span>
            <span class="ml-auto font-semibold text-strong tabular-nums">{{ formatWon(part.amount) }}</span>
          </li>
        </ul>

        <dl v-if="seasons.length > 0" class="mt-4 grid gap-2" :class="seasons.length === 3 ? 'grid-cols-3' : 'grid-cols-2'">
          <div
            v-for="season in seasons"
            :key="season.label"
            class="rounded-lg border border-line px-2.5 py-2"
            data-testid="fee-season"
          >
            <dt class="text-[11px] md:text-[12px] text-muted">
              {{ season.label }} <span class="text-faint">{{ formatFeePeriod(season.period) }}</span>
            </dt>
            <dd class="mt-0.5 text-[13px] md:text-sm font-bold text-strong tabular-nums">{{ formatWon(season.period.amount) }}</dd>
          </div>
        </dl>
      </div>

      <div>
        <h3 class="mb-2 text-[13px] md:text-sm font-bold text-strong">월별 세대 평균</h3>
        <div class="flex items-end gap-1 h-24" aria-hidden="true">
          <span
            v-for="bar in bars"
            :key="bar.month"
            class="flex-1 rounded-t"
            :class="[bar.month === fee.month ? 'bg-primary' : 'bg-primary/35', bar.partial ? 'opacity-40' : '']"
            :style="{ height: `${Math.max(bar.ratio * 100, 4)}%` }"
            data-testid="fee-month-bar"
          />
        </div>
        <div class="mt-1 flex gap-1 text-[10px] text-faint tabular-nums" aria-hidden="true">
          <span v-for="bar in bars" :key="bar.month" class="flex-1 text-center">{{ bar.label }}</span>
        </div>
        <p v-if="extremes" class="mt-2 text-[12px] md:text-[13px] text-muted">
          가장 높은 달 {{ feeMonthLabel(extremes.high.month) }} {{ formatWon(extremes.high.amount) }}
          · 가장 낮은 달 {{ feeMonthLabel(extremes.low.month) }} {{ formatWon(extremes.low.amount) }}
        </p>
        <p v-if="partialMonths" class="mt-1 text-[11px] text-faint">흐린 막대({{ partialMonths }})는 일부 단지만 올라온 달</p>

        <div v-if="fee.commonPerM2" class="mt-4" data-testid="fee-per-m2">
          <h3 class="mb-2 text-[13px] md:text-sm font-bold text-strong">㎡당 공용관리비</h3>
          <ul class="space-y-1.5 text-[12px] md:text-[13px]">
            <li
              v-for="row in perM2Rows"
              :key="row.label"
              class="grid grid-cols-[minmax(0,9.5rem)_1fr_64px] items-center gap-2"
            >
              <span class="text-muted">{{ row.label }}</span>
              <span class="h-2 rounded bg-surface-2 overflow-hidden" aria-hidden="true">
                <span class="block h-full rounded" :class="row.color" :style="{ width: `${row.ratio * 100}%` }" />
              </span>
              <span class="text-right font-semibold text-strong tabular-nums">{{ formatWon(row.amount) }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <details v-if="fee.items.length > 0" class="mt-5 border-t border-line pt-3 group">
      <summary class="cursor-pointer text-[13px] md:text-sm font-semibold text-strong">항목별 내역 보기</summary>
      <div class="mt-3 grid gap-4 md:grid-cols-3">
        <div v-for="group in itemGroups" :key="group.label">
          <h4 class="mb-1 text-[12px] md:text-[13px] font-bold text-muted">{{ group.label }}</h4>
          <dl class="text-[12px] md:text-[13px]">
            <div
              v-for="item in group.items"
              :key="item.label"
              class="flex justify-between gap-3 py-1 border-b border-line last:border-b-0"
            >
              <dt class="text-muted">{{ item.label }}</dt>
              <dd class="font-semibold text-strong tabular-nums">{{ formatWon(item.amount) }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </details>

    <div v-if="fee.office.phone || fee.office.address" class="mt-4 text-[12px] md:text-[13px]" data-testid="fee-office">
      <span class="text-muted">관리사무소</span>
      <a v-if="fee.office.phone" :href="`tel:${telHref}`" class="ml-2 font-semibold text-primary">{{ fee.office.phone }}</a>
      <span v-if="fee.office.address" class="ml-2 text-muted break-keep">{{ fee.office.address }}</span>
    </div>

    <p class="mt-4 text-[12px] text-faint">
      출처: 국토교통부 K-apt 공동주택관리정보시스템 · 단지 전체 부과액 ÷ 세대수(세대 평균, 평형별 실제 부과액과 다름)
    </p>
  </SectionBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import type { FeePeriodAverage, MaintenanceFeeItem, MaintenanceFeeSummary } from '~/types/housingRedesign'
import { feeExtremes, feeMonthLabel, formatFeeMonth, formatFeePeriod, formatWon } from '~/utils/maintenanceFee'

const props = defineProps<{
  fee: MaintenanceFeeSummary
}>()

const parts = computed(() => {
  const sum = props.fee.common + props.fee.individual + props.fee.longTermRepair
  return [
    { label: '공용관리비', amount: props.fee.common, color: 'bg-primary' },
    { label: '개별사용료', amount: props.fee.individual, color: 'bg-primary/45' },
    { label: '장기수선충당금', amount: props.fee.longTermRepair, color: 'bg-line-strong' },
  ].map((part) => ({ ...part, ratio: sum > 0 ? part.amount / sum : 0 }))
})

const seasons = computed(() =>
  ([['여름', props.fee.summer], ['겨울', props.fee.winter], ['연평균', props.fee.yearly]] as Array<[string, FeePeriodAverage | null]>)
    .filter((entry): entry is [string, FeePeriodAverage] => entry[1] !== null)
    .map(([label, period]) => ({ label, period })),
)

const bars = computed(() => {
  const max = Math.max(0, ...props.fee.monthly.map((m) => m.amount))
  return props.fee.monthly.map((m) => ({
    ...m,
    label: feeMonthLabel(m.month).replace('월', ''),
    ratio: max > 0 ? m.amount / max : 0,
  }))
})
const extremes = computed(() => feeExtremes(props.fee.monthly))
const partialMonths = computed(() =>
  props.fee.monthly.filter((m) => m.partial).map((m) => feeMonthLabel(m.month)).join('·'),
)

const perM2Rows = computed(() => {
  const cmp = props.fee.commonPerM2
  if (!cmp) return []
  const max = Math.max(cmp.complex, cmp.sggMedian, 1)
  return [
    { label: '이 단지', amount: cmp.complex, ratio: cmp.complex / max, color: 'bg-primary' },
    { label: `같은 시군구 중간(${cmp.sggComplexCount.toLocaleString('ko-KR')}단지)`, amount: cmp.sggMedian, ratio: cmp.sggMedian / max, color: 'bg-line-strong' },
  ]
})

const GROUP_LABELS: Record<MaintenanceFeeItem['group'], string> = {
  common: '공용관리비',
  individual: '개별사용료',
  longTermRepair: '장기수선충당금',
}
const itemGroups = computed(() =>
  (Object.keys(GROUP_LABELS) as Array<MaintenanceFeeItem['group']>)
    .map((group) => ({ label: GROUP_LABELS[group], items: props.fee.items.filter((item) => item.group === group) }))
    .filter((group) => group.items.length > 0),
)

/** 전화 링크는 숫자·하이픈만 */
const telHref = computed(() => (props.fee.office.phone ?? '').replace(/[^\d-]/g, ''))
</script>
