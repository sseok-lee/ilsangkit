<template>
  <div>
    <!-- Loading skeleton -->
    <div
      v-if="loading"
      data-testid="chart-skeleton"
      class="w-full h-80 bg-slate-200 rounded-lg animate-pulse"
    />

    <!-- Empty state -->
    <div
      v-else-if="stats.length === 0"
      class="flex items-center justify-center h-80 text-slate-500 text-sm"
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
        class="relative w-full h-80 rounded-lg overflow-hidden"
      />
      <!-- Custom tooltip -->
      <div
        v-if="tooltip.visible"
        class="pointer-events-none absolute z-10 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        <p class="font-medium">{{ tooltip.date }}</p>
        <p class="mt-0.5 text-blue-300">평균 {{ tooltip.avgPrice }}</p>
        <p class="mt-0.5 text-slate-300">{{ tooltip.count }}건 거래</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { TransactionStats } from '~/types/realEstate'

interface Props {
  stats: TransactionStats[]
  loading: boolean
}

const props = defineProps<Props>()

const chartContainerRef = ref<HTMLElement | null>(null)

const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  date: '',
  avgPrice: '',
  count: 0,
})

let chart: ReturnType<typeof import('lightweight-charts')['createChart']> | null = null
let resizeObserver: ResizeObserver | null = null

function formatPrice(price: number): string {
  const rounded = Math.round(price)
  const eok = Math.floor(rounded / 10000)
  const man = rounded % 10000
  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString()}만`
  if (eok > 0) return `${eok}억`
  return `${rounded.toLocaleString()}만`
}

function toTimeStr(s: TransactionStats) {
  return `${s.year}-${String(s.month).padStart(2, '0')}-01` as const
}

function getBarColor(count: number, maxCount: number): string {
  if (maxCount === 0) return 'rgba(147, 197, 253, 0.6)'
  const ratio = count / maxCount
  // 거래량에 따른 그라데이션: 적으면 연한 파랑, 많으면 진한 파랑
  const alpha = 0.3 + ratio * 0.7
  return `rgba(59, 130, 246, ${alpha.toFixed(2)})`
}

async function renderChart() {
  if (!chartContainerRef.value || props.stats.length === 0) return

  // 기존 차트 제거
  if (chart) {
    chart.remove()
    chart = null
  }

  const { createChart, ColorType, AreaSeries, LineSeries, HistogramSeries } = await import('lightweight-charts')

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
    height: 320,
    crosshair: {
      vertLine: { labelVisible: false },
      horzLine: { labelVisible: true },
    },
    localization: {
      priceFormatter: formatPrice,
    },
  })

  const maxCount = Math.max(...props.stats.map((s) => s.count), 1)

  // 히스토그램 (거래량) — 먼저 추가해서 뒤에 그려지도록
  const histogramSeries = chart.addSeries(HistogramSeries, {
    priceScaleId: 'volume',
    lastValueVisible: false,
    priceLineVisible: false,
    priceFormat: {
      type: 'custom',
      formatter: (price: number) => `${Math.round(price)}건`,
    },
  })

  const histogramData = props.stats.map((s) => ({
    time: toTimeStr(s),
    value: s.count,
    color: getBarColor(s.count, maxCount),
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
          time: toTimeStr(s),
          value: s.maxPrice,
        }))
    )
    minSeries.setData(
      props.stats
        .filter((s) => s.minPrice != null)
        .map((s) => ({
          time: toTimeStr(s),
          value: s.minPrice,
        }))
    )
  }

  // Area 시리즈 (월별 평균가) — 그라데이션 채우기
  const areaSeries = chart.addSeries(AreaSeries, {
    topColor: 'rgba(59, 130, 246, 0.15)',
    bottomColor: 'rgba(59, 130, 246, 0.02)',
    lineColor: '#3b82f6',
    lineWidth: 2,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerRadius: 4,
    crosshairMarkerBackgroundColor: '#3b82f6',
    crosshairMarkerBorderColor: '#ffffff',
    crosshairMarkerBorderWidth: 2,
  })

  const lineData = props.stats.map((s) => ({
    time: toTimeStr(s),
    value: s.avgPrice,
  }))
  areaSeries.setData(lineData)

  chart.timeScale().fitContent()

  // 커스텀 툴팁 (crosshair move)
  const statsMap = new Map(props.stats.map((s) => [toTimeStr(s), s]))
  chart.subscribeCrosshairMove((param) => {
    if (!param.time || !param.point || !chartContainerRef.value) {
      tooltip.value.visible = false
      return
    }

    const t = param.time as { year: number; month: number; day: number } | string
    const timeStr = typeof t === 'string' ? t : `${t.year}-${String(t.month).padStart(2, '0')}-01`
    const stat = statsMap.get(timeStr as `${number}-${string}-01`)
    if (!stat) {
      tooltip.value.visible = false
      return
    }

    const containerRect = chartContainerRef.value.getBoundingClientRect()
    tooltip.value = {
      visible: true,
      x: Math.min(param.point.x + 12, containerRect.width - 160),
      y: Math.max(param.point.y - 60, 0),
      date: `${stat.year}년 ${stat.month}월`,
      avgPrice: formatPrice(stat.avgPrice),
      count: stat.count,
    }
  })

  // 반응형 리사이즈
  if (!resizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      if (chart && chartContainerRef.value) {
        chart.applyOptions({ width: chartContainerRef.value.clientWidth })
      }
    })
    resizeObserver.observe(chartContainerRef.value)
  }
}

onMounted(() => {
  renderChart()
})

// stats가 변경되면 차트 다시 그리기 (기간 변경 시)
watch(() => props.stats, () => {
  renderChart()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  if (chart) {
    chart.remove()
    chart = null
  }
})
</script>
