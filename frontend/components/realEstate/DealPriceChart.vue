<template>
  <section class="bg-white">
    <div
      v-if="loading"
      data-testid="deal-chart-loading"
      class="flex h-72 items-center justify-center rounded-lg bg-background-light text-sm text-muted"
    >
      거래 차트를 불러오는 중입니다
    </div>

    <div
      v-else-if="error"
      class="flex h-72 flex-col items-center justify-center gap-3 rounded-lg bg-background-light text-sm text-muted"
      role="alert"
    >
      <p>거래 차트를 불러오지 못했습니다</p>
      <button type="button" class="rounded-md bg-primary px-4 py-2 font-medium text-white" @click="$emit('retry')">
        다시 시도
      </button>
    </div>

    <div
      v-else-if="points.length === 0"
      class="flex h-72 items-center justify-center rounded-lg bg-background-light text-sm text-muted"
    >
      거래 데이터가 없습니다
    </div>

    <div v-else class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div>
        <div class="mb-3 flex flex-wrap items-center gap-4 text-sm text-muted">
          <span class="inline-flex items-center gap-2 font-medium text-strong">
            <span class="h-0.5 w-5 bg-primary" />
            월별 중앙값
          </span>
          <span class="inline-flex items-center gap-2">
            <span class="h-2 w-2 rounded-full border border-primary/40 bg-white" />
            개별 거래
          </span>
          <span>{{ window.from }}–{{ window.to }}</span>
          <span>{{ modeUnitLabel }}</span>
          <span class="font-medium text-strong">단위: {{ amountUnitLabel }}</span>
        </div>
        <div class="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-3">
          <div
            data-testid="price-axis"
            class="relative h-72 text-right text-xs text-muted tabular-nums"
            aria-label="가격 축"
          >
            <span
              v-for="tick in amountTicks"
              :key="tick.value"
              class="absolute right-0 -translate-y-1/2"
              :style="{ top: `${tick.y}px` }"
            >
              {{ tick.label }}
            </span>
          </div>
          <div ref="canvasWrapRef" class="relative h-72 min-w-0 bg-white">
            <canvas
              ref="canvasRef"
              class="h-full w-full"
              aria-hidden="true"
              @click="selectNearest"
            />
          </div>
          <div />
          <div
            data-testid="date-axis"
            class="relative mt-2 h-4 text-xs text-muted tabular-nums"
            aria-label="날짜 축"
          >
            <span class="absolute -translate-x-1/2" :style="{ left: `${plotPadding.left}px` }">{{ dateTicks[0].label }}</span>
            <span class="absolute translate-x-1/2" :style="{ right: `${plotPadding.right}px` }">{{ dateTicks[1].label }}</span>
          </div>
        </div>
        <p class="mt-3 text-xs text-muted">조회기간 내 월별 중앙값 · 거래가 없는 달은 선을 연결하지 않습니다.</p>
      </div>

      <aside class="border-line lg:border-l lg:pl-5">
        <label class="mb-4 grid gap-1 text-sm font-medium text-strong">
          월별 가격
          <select v-model="selectedMonth" name="deal-month" class="min-h-11 rounded-md border border-line bg-white px-3 text-sm" @change="selectMonth">
            <option value="">월 선택</option>
            <option v-for="month in monthlyTrend" :key="month.month" :value="month.month">
              {{ formatDate(month.month) }}{{ month.amount === null ? ' · 거래 없음' : '' }}
            </option>
          </select>
        </label>
        <p v-if="activeMonth" data-testid="monthly-price-summary" class="mb-4 text-sm text-muted">
          {{ formatDate(activeMonth.month) }} 중앙값
          <strong v-if="activeMonth.amount !== null" class="mt-1 block text-xl font-semibold tabular-nums text-strong">{{ formatAmount(activeMonth.amount) }}</strong>
          <span v-else class="mt-1 block">이 달에는 거래가 없습니다</span>
        </p>
        <label class="grid gap-1 text-sm font-medium text-strong">
          거래 날짜
          <select
            v-model="selectedDate"
            name="deal-date"
            class="min-h-11 rounded-md border border-line bg-white px-3 text-sm"
            @change="clearPointSelection"
          >
            <option value="" disabled>날짜 선택</option>
            <option v-for="date in availableDates" :key="date" :value="date">
              {{ formatDate(date) }}
            </option>
          </select>
        </label>

        <div class="mt-4" aria-live="polite">
          <p class="text-sm font-semibold text-strong">
            {{ selectedHeading }}
          </p>
          <ul class="mt-3 space-y-2">
            <li
              v-for="point in visibleSelectedPoints"
              :key="point.id"
              data-testid="deal-point-row"
              class="rounded-md border border-line p-3 text-sm"
            >
              <div class="flex items-baseline justify-between gap-3">
                <strong class="tabular-nums text-strong">{{ formatAmount(point.amount) }}</strong>
                <span class="text-muted">전용 {{ point.area }}㎡</span>
              </div>
              <p class="mt-1 text-muted">
                <span v-if="activeMonth">{{ formatDate(point.date) }} · </span>
                {{ floorLabel(point.floor) }}
                <span v-if="mode === 'wolse' && point.deposit != null">
                  · 보증금 {{ formatAmount(point.deposit) }}
                </span>
              </p>
            </li>
          </ul>
          <button
            v-if="visibleSelectedPoints.length < selectedPoints.length"
            type="button"
            data-testid="show-more-deals"
            class="mt-3 min-h-11 rounded-md border border-line px-4 text-sm font-medium text-primary-700"
            @click="visibleLimit += 20"
          >
            더 보기
          </button>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { DateWindow, DealMode, DealPoint } from '~/types/housingRedesign'
import { formatKoreanPrice } from '~/utils/formatters'
import { DEAL_PLOT_PADDING, projectDealPoints, projectMonthlyDealTrend } from '~/utils/realEstateDealPlot'
import type { MonthlyDealTrend, ProjectedDealPoint } from '~/utils/realEstateDealPlot'

const props = withDefaults(defineProps<{
  points: DealPoint[]
  window: DateWindow
  mode: DealMode
  loading: boolean
  error?: unknown
}>(), {
  error: null,
})

defineEmits<{
  retry: []
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasWrapRef = ref<HTMLElement | null>(null)
const selectedDate = ref('')
const selectedMonth = ref('')
const selectedGroup = ref<ProjectedDealPoint | null>(null)
const visibleLimit = ref(20)
const projected = ref<ProjectedDealPoint[]>([])
const projectedMonths = ref<MonthlyDealTrend[]>([])
const monthlyTrend = computed(() => projectMonthlyDealTrend(props.points, props.window, 320, 288))
const activeMonth = computed(() => monthlyTrend.value.find(month => month.month === selectedMonth.value))
const chartHeight = 288
const plotPadding = DEAL_PLOT_PADDING
let resizeObserver: ResizeObserver | null = null
let frameId: number | null = null
let observedElement: HTMLElement | null = null

const availableDates = computed(() => {
  const unique = [...new Set(props.points.map(point => point.date))]
  return unique.sort((a, b) => b.localeCompare(a))
})

const modeUnitLabel = computed(() => {
  if (props.mode === 'sale') return '거래금액'
  if (props.mode === 'jeonse') return '보증금'
  return '월세'
})

const amountUnitLabel = computed(() => props.mode === 'wolse' ? '만원' : '만원')

const amountDomain = computed(() => {
  if (props.points.length === 0) return { min: 0, max: 0 }
  const amounts = props.points.map(point => point.amount)
  const min = Math.min(...amounts)
  const max = Math.max(...amounts)
  const padding = min === max ? Math.max(1, Math.abs(min) * 0.05) : (max - min) * 0.1
  return { min: min - padding, max: max + padding }
})

const amountTicks = computed(() => {
  const { min, max } = amountDomain.value
  const plotHeight = chartHeight - plotPadding.top - plotPadding.bottom
  const amountSpan = Math.max(1, max - min)
  return [max, (min + max) / 2, min].map(value => ({
    value,
    label: formatAxisAmount(value),
    y: plotPadding.top + (1 - ((value - min) / amountSpan)) * plotHeight,
  }))
})

const dateTicks = computed(() => [
  { value: props.window.from, label: formatDate(props.window.from).slice(2, 7) },
  { value: props.window.to, label: formatDate(props.window.to).slice(2, 7) },
])

const selectedPoints = computed(() => {
  if (activeMonth.value) return [...activeMonth.value.points].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  if (selectedGroup.value) return selectedGroup.value.points
  return props.points.filter(point => point.date === selectedDate.value)
})

const visibleSelectedPoints = computed(() => selectedPoints.value.slice(0, visibleLimit.value))

const selectedHeading = computed(() => {
  if (activeMonth.value) return `${formatDate(activeMonth.value.month)} 거래 · ${selectedPoints.value.length}건`
  const date = selectedDate.value ? formatDate(selectedDate.value) : '선택한 날짜'
  return `${date} · ${selectedPoints.value.length}건`
})

function formatDate(date: string): string {
  return date.replaceAll('-', '.')
}

function formatAmount(value: number): string {
  return formatKoreanPrice(value)
}

function formatAxisAmount(value: number): string {
  const rounded = Math.round(value)
  if (props.mode === 'wolse') return `${rounded.toLocaleString()}만원`
  if (rounded >= 10000) {
    const eok = rounded / 10000
    return `${Number.isInteger(eok) ? eok.toFixed(0) : eok.toFixed(1)}억`
  }
  return `${rounded.toLocaleString()}만원`
}

function floorLabel(floor: number | null): string {
  return floor == null ? '층 정보 없음' : `${floor}층`
}

function clearPointSelection(): void {
  selectedMonth.value = ''
  selectedGroup.value = null
  visibleLimit.value = 20
}

function selectMonth(): void {
  selectedDate.value = selectedMonth.value ? '' : (availableDates.value[0] ?? '')
  selectedGroup.value = null
  visibleLimit.value = 20
}

function selectNearest(event: MouseEvent | PointerEvent): void {
  if (!canvasRef.value || projected.value.length === 0) return
  const rect = canvasRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const nearest = projected.value.reduce((best, point) => {
    const distance = Math.hypot(point.x - x, point.y - y)
    return distance < best.distance ? { point, distance } : best
  }, { point: projected.value[0], distance: Number.POSITIVE_INFINITY })
  // Exact trade taps retain priority; line taps select the closest month on that segment.
  let closestMonth: MonthlyDealTrend | null = null
  let distanceToTrend = Number.POSITIVE_INFINITY
  projectedMonths.value.forEach((month, index) => {
    if (month.y === null) return
    const distance = Math.hypot(month.x - x, month.y - y)
    if (distance < distanceToTrend) { distanceToTrend = distance; closestMonth = month }
    const previous = projectedMonths.value[index - 1]
    if (!previous || previous.y === null || x < previous.x || x > month.x) return
    const dx = month.x - previous.x
    const dy = month.y - previous.y
    const fraction = Math.max(0, Math.min(1, ((x - previous.x) * dx + (y - previous.y) * dy) / (dx * dx + dy * dy || 1)))
    const segmentDistance = Math.hypot(x - previous.x - fraction * dx, y - previous.y - fraction * dy)
    if (segmentDistance < distanceToTrend) {
      distanceToTrend = segmentDistance
      closestMonth = x - previous.x < month.x - x ? previous : month
    }
  })
  if (closestMonth && distanceToTrend <= 16 && nearest.distance > 8) {
    selectedMonth.value = (closestMonth as MonthlyDealTrend).month
    selectMonth()
    return
  }
  selectedMonth.value = ''
  selectedGroup.value = nearest.point
  selectedDate.value = nearest.point.date
  visibleLimit.value = 20
}

function hasBrowserApis(): boolean {
  return typeof window !== 'undefined'
}

function drawChart(): void {
  if (!hasBrowserApis() || !canvasRef.value || !canvasWrapRef.value || props.loading || props.error || props.points.length === 0) {
    return
  }
  const canvas = canvasRef.value
  const rect = canvasWrapRef.value.getBoundingClientRect()
  const width = Math.max(1, rect.width)
  const height = Math.max(1, rect.height)
  const ratio = window.devicePixelRatio || 1
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)
  projected.value = projectDealPoints(props.points, props.window, width, height)

  ctx.strokeStyle = '#E6E9F0'
  ctx.fillStyle = '#56627A'
  ctx.font = '12px Pretendard, sans-serif'
  ctx.lineWidth = 1
  for (const tick of amountTicks.value) {
    ctx.beginPath()
    ctx.moveTo(plotPadding.left, tick.y)
    ctx.lineTo(width - plotPadding.right, tick.y)
    ctx.stroke()
  }

  for (const point of projected.value) {
    const active = selectedGroup.value?.date === point.date && selectedGroup.value.amount === point.amount
    ctx.beginPath()
    ctx.arc(point.x, point.y, active ? 5 : 3, 0, Math.PI * 2)
    ctx.fillStyle = active ? '#2450DC' : '#FFFFFF'
    ctx.strokeStyle = active ? '#2450DC' : 'rgba(36, 80, 220, 0.35)'
    ctx.lineWidth = active ? 2 : 1
    ctx.fill()
    ctx.stroke()
  }

  projectedMonths.value = projectMonthlyDealTrend(props.points, props.window, width, height)
  ctx.strokeStyle = '#2450DC'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  let connected = false
  for (const month of projectedMonths.value) {
    if (month.y === null) { connected = false; continue }
    if (connected) ctx.lineTo(month.x, month.y)
    else ctx.moveTo(month.x, month.y)
    connected = true
  }
  ctx.stroke()
  for (const month of projectedMonths.value) {
    if (month.y === null) continue
    ctx.beginPath()
    ctx.arc(month.x, month.y, selectedMonth.value === month.month ? 5 : 3.5, 0, Math.PI * 2)
    ctx.fillStyle = '#2450DC'
    ctx.fill()
  }

}

function requestDraw(): void {
  if (!hasBrowserApis()) return
  if (frameId != null) cancelAnimationFrame(frameId)
  frameId = requestAnimationFrame(() => {
    frameId = null
    drawChart()
  })
}

function disconnectObserver(): void {
  resizeObserver?.disconnect()
  resizeObserver = null
  observedElement = null
}

function syncResizeObserver(): void {
  if (!hasBrowserApis()) return
  const element = canvasWrapRef.value
  if (!element || props.loading || props.error || props.points.length === 0) {
    disconnectObserver()
    return
  }
  if (observedElement === element && resizeObserver) {
    requestDraw()
    return
  }
  disconnectObserver()
  resizeObserver = new ResizeObserver(requestDraw)
  resizeObserver.observe(element)
  observedElement = element
  requestDraw()
}

watch(
  () => props.points,
  () => {
    selectedDate.value = availableDates.value[0] ?? ''
    selectedMonth.value = ''
    selectedGroup.value = null
    visibleLimit.value = 20
    nextTick(requestDraw)
  },
  { immediate: true }
)

watch([() => props.window, () => props.mode, selectedGroup, selectedMonth], () => nextTick(requestDraw), { deep: true })

watch(
  [canvasWrapRef, () => props.loading, () => props.error, () => props.points.length],
  () => nextTick(syncResizeObserver),
  { flush: 'post' }
)

onMounted(() => {
  syncResizeObserver()
})

onUnmounted(() => {
  if (frameId != null) cancelAnimationFrame(frameId)
  disconnectObserver()
})
</script>
