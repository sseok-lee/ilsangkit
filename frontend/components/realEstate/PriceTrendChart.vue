<template>
  <div>
    <!-- Loading skeleton -->
    <div
      v-if="loading"
      data-testid="chart-skeleton"
      class="w-full h-64 bg-slate-200 rounded-lg animate-pulse"
    />

    <!-- Empty state -->
    <div
      v-else-if="stats.length === 0"
      class="flex items-center justify-center h-64 text-slate-400 text-sm"
    >
      데이터가 없습니다
    </div>

    <!-- Chart -->
    <template v-else>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-xs text-slate-500">
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-4 h-0.5 bg-blue-500 rounded" />
          평균가
        </span>
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-4 h-0.5 border-t border-dashed border-blue-300" />
          최고/최저가
        </span>
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-3 h-3 bg-blue-300 rounded-sm" />
          거래건수
        </span>
      </div>
      <div
        ref="chartContainerRef"
        data-testid="chart-container"
        class="w-full h-64 rounded-lg overflow-hidden"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { TransactionStats } from '~/types/realEstate'

interface Props {
  stats: TransactionStats[]
  loading: boolean
}

const props = defineProps<Props>()

const chartContainerRef = ref<HTMLElement | null>(null)

let chart: ReturnType<typeof import('lightweight-charts')['createChart']> | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  if (!chartContainerRef.value || props.stats.length === 0) return

  const { createChart, ColorType, LineSeries, HistogramSeries } = await import('lightweight-charts')

  if (!chartContainerRef.value) return

  chart = createChart(chartContainerRef.value, {
    layout: {
      background: { type: ColorType.Solid, color: '#ffffff' },
      textColor: '#64748b',
    },
    grid: {
      vertLines: { color: '#f1f5f9' },
      horzLines: { color: '#f1f5f9' },
    },
    width: chartContainerRef.value.clientWidth,
    height: 256,
    localization: {
      priceFormatter: (price: number) => {
        const rounded = Math.round(price)
        const eok = Math.floor(rounded / 10000)
        const man = rounded % 10000
        if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString()}만`
        if (eok > 0) return `${eok}억`
        return `${rounded.toLocaleString()}만`
      },
    },
  })

  // 히스토그램 (거래량) — 먼저 추가해서 뒤에 그려지도록
  const histogramSeries = chart.addSeries(HistogramSeries, {
    color: '#93c5fd',
    priceScaleId: 'volume',
    lastValueVisible: false,
    priceLineVisible: false,
    priceFormat: {
      type: 'custom',
      formatter: (price: number) => `${Math.round(price)}건`,
    },
  })

  const histogramData = props.stats.map((s) => ({
    time: `${s.year}-${String(s.month).padStart(2, '0')}-01` as const,
    value: s.count,
  }))
  histogramSeries.setData(histogramData)

  // 최고/최저가 영역 밴드
  const hasMinMax = props.stats.some((s) => s.maxPrice != null && s.minPrice != null)
  if (hasMinMax) {
    const maxSeries = chart.addSeries(LineSeries, {
      color: 'rgba(59, 130, 246, 0.15)',
      lineWidth: 1,
      lineStyle: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    })
    const minSeries = chart.addSeries(LineSeries, {
      color: 'rgba(59, 130, 246, 0.15)',
      lineWidth: 1,
      lineStyle: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    })
    maxSeries.setData(
      props.stats
        .filter((s) => s.maxPrice != null)
        .map((s) => ({
          time: `${s.year}-${String(s.month).padStart(2, '0')}-01` as const,
          value: s.maxPrice,
        }))
    )
    minSeries.setData(
      props.stats
        .filter((s) => s.minPrice != null)
        .map((s) => ({
          time: `${s.year}-${String(s.month).padStart(2, '0')}-01` as const,
          value: s.minPrice,
        }))
    )
  }

  // 라인 차트 (월별 평균가) — 마지막에 추가해서 맨 앞에 표시
  const lineSeries = chart.addSeries(LineSeries, {
    color: '#3b82f6',
    lineWidth: 2,
    lastValueVisible: false,
    priceLineVisible: false,
  })

  const lineData = props.stats.map((s) => ({
    time: `${s.year}-${String(s.month).padStart(2, '0')}-01` as const,
    value: s.avgPrice,
  }))
  lineSeries.setData(lineData)

  chart.timeScale().fitContent()

  // 반응형 리사이즈
  resizeObserver = new ResizeObserver(() => {
    if (chart && chartContainerRef.value) {
      chart.applyOptions({ width: chartContainerRef.value.clientWidth })
    }
  })
  resizeObserver.observe(chartContainerRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  if (chart) {
    chart.remove()
    chart = null
  }
})
</script>
