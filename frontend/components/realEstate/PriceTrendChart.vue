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
      class="flex items-center justify-center h-80 text-faint text-sm"
    >
      데이터가 없습니다
    </div>

    <!-- Chart -->
    <template v-else>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-xs text-muted">
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-4 h-0.5 bg-primary rounded" />
          평균가
        </span>
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-4 h-0.5 border-t border-dashed border-primary/40" />
          최고/최저가
        </span>
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-3 h-3 bg-primary/40 rounded-sm" />
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
        <p class="mt-0.5 text-primary-300">평균 {{ tooltip.avgPrice }}</p>
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
  priceLabel?: string
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

// Chart color tokens (lightweight-charts API requires raw color strings)
const CHART_COLORS = {
  line: '#2450DC',        // OD brand cobalt
  lineLight: 'rgba(36, 80, 220, 0.15)',
  lineFaint: 'rgba(36, 80, 220, 0.02)',
  barBase: 'rgba(36, 80, 220, 0.35)',
  barFn: (alpha: number) => `rgba(36, 80, 220, ${alpha.toFixed(2)})`,
  bg: '#ffffff',          // paper
  text: '#56627A',        // --muted
  grid: '#E6E9F0',        // --border
  markerBorder: '#ffffff',
} as const

let chart: ReturnType<typeof import('lightweight-charts')['createChart']> | null = null
let resizeObserver: ResizeObserver | null = null

function formatPrice(price: number): string {
  const rounded = Math.round(price)
  // 환산보증금/보증금/매매가 모두 억/만원 단위로 동일 포맷
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
  if (maxCount === 0) return CHART_COLORS.barBase
  const ratio = count / maxCount
  const alpha = 0.3 + ratio * 0.7
  return CHART_COLORS.barFn(alpha)
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
      background: { type: ColorType.Solid, color: CHART_COLORS.bg },
      textColor: CHART_COLORS.text,
    },
    grid: {
      vertLines: { color: CHART_COLORS.grid },
      horzLines: { color: CHART_COLORS.grid },
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

  // 가격 스케일: 상단 70% 영역 사용
  chart.priceScale('right').applyOptions({
    scaleMargins: { top: 0.05, bottom: 0.35 },
  })

  // 히스토그램 (거래량) — 하단 25% 영역 사용
  const histogramSeries = chart.addSeries(HistogramSeries, {
    priceScaleId: 'volume',
    lastValueVisible: false,
    priceLineVisible: false,
    priceFormat: {
      type: 'custom',
      formatter: (price: number) => `${Math.round(price)}건`,
    },
  })
  chart.priceScale('volume').applyOptions({
    scaleMargins: { top: 0.8, bottom: 0.02 },
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
      color: CHART_COLORS.lineLight,
      lineWidth: 1,
      lineStyle: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    })
    const minSeries = chart.addSeries(LineSeries, {
      color: CHART_COLORS.lineLight,
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
    topColor: CHART_COLORS.lineLight,
    bottomColor: CHART_COLORS.lineFaint,
    lineColor: CHART_COLORS.line,
    lineWidth: 2,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerRadius: 4,
    crosshairMarkerBackgroundColor: CHART_COLORS.line,
    crosshairMarkerBorderColor: CHART_COLORS.markerBorder,
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

// stats가 변경되면 차트 다시 그리기 (기간 변경 시, 디바운스 적용)
let renderTimer: ReturnType<typeof setTimeout> | null = null
watch(() => props.stats, () => {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(renderChart, 150)
})

onUnmounted(() => {
  if (renderTimer) clearTimeout(renderTimer)
  resizeObserver?.disconnect()
  if (chart) {
    chart.remove()
    chart = null
  }
})
</script>
