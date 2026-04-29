<template>
  <section v-if="rows.length > 0" class="bg-white border border-line rounded-2xl shadow-card p-5">
    <header class="flex items-end justify-between mb-3">
      <div>
        <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">trending_up</span>
          {{ district }} 동·평형 변동률
        </h2>
        <p class="text-xs text-slate-500 mt-0.5">아파트 · 최근 월 기준 (5건 미만 표본 제외)</p>
      </div>
    </header>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-[11px] text-slate-500 font-bold uppercase tracking-wider border-b border-line">
            <th class="text-left py-2 pr-3">동</th>
            <th class="text-left py-2 pr-3">평형</th>
            <th class="text-right py-2 pr-3">평균가</th>
            <th class="text-right py-2 pr-3">전월비</th>
            <th class="text-right py-2 pr-3 hidden sm:table-cell">전3개월</th>
            <th class="text-right py-2">전년비</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="rowKey(row)" class="border-b border-line/60 last:border-b-0">
            <td class="py-2 pr-3 text-slate-700 font-medium whitespace-nowrap">{{ row.dong }}</td>
            <td class="py-2 pr-3 text-slate-500">{{ row.areaBucket }}</td>
            <td class="py-2 pr-3 text-right font-bold text-slate-900 tabular-nums">{{ formatPrice(row.avgPrice) }}</td>
            <td class="py-2 pr-3 text-right"><TrendBadge :ratio="row.monthOverMonth" /></td>
            <td class="py-2 pr-3 text-right hidden sm:table-cell"><TrendBadge :ratio="row.qtrOverQtr" /></td>
            <td class="py-2 text-right"><TrendBadge :ratio="row.yearOverYear" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TrendBadge from '~/components/realEstate/TrendBadge.vue'

interface TrendRow {
  propertyType: string
  city: string
  district: string
  dong: string
  areaBucket: string
  txType: string
  yearMonth: string
  avgPrice: number
  txCount: number
  monthOverMonth: number | null
  qtrOverQtr: number | null
  yearOverYear: number | null
}

interface Props {
  city: string
  district: string
  /** 'sale' | 'rent' (default: 'sale') */
  txType?: string
  /** 표시할 최대 행 수 */
  limit?: number
}

const props = withDefaults(defineProps<Props>(), {
  txType: 'sale',
  limit: 12,
})

const config = useRuntimeConfig()

const { data } = useAsyncData(
  () => `real-estate-trend-${props.city}-${props.district}-${props.txType}`,
  () =>
    $fetch<{ success: boolean; data: { items: TrendRow[] } }>(
      `${config.public.apiBase}/api/real-estate/trend`,
      {
        query: {
          city: props.city,
          district: props.district,
          txType: props.txType,
          propertyType: 'apt',
        },
      }
    ).catch(() => null),
  { watch: [() => props.city, () => props.district, () => props.txType] }
)

const rows = computed(() => {
  const items = data.value?.data?.items ?? []
  if (items.length === 0) return []

  // 가장 최신 yearMonth만 보여주기 (limit개)
  const latest = items[0]?.yearMonth
  if (!latest) return []
  return items.filter((r) => r.yearMonth === latest).slice(0, props.limit)
})

function rowKey(row: TrendRow): string {
  return `${row.dong}-${row.areaBucket}-${row.txType}-${row.yearMonth}`
}

function formatPrice(amountInManwon: number): string {
  if (!amountInManwon) return '-'
  if (amountInManwon >= 10000) {
    const eok = Math.floor(amountInManwon / 10000)
    const remainder = amountInManwon % 10000
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString('ko-KR')}` : `${eok}억`
  }
  return amountInManwon.toLocaleString('ko-KR')
}
</script>
