<template>
  <div class="space-y-3">
    <!-- 충전기 요약 뱃지 -->
    <div v-if="displayChargers?.length" class="flex items-center gap-2 flex-wrap">
      <span class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-slate-100 text-slate-800">
        총 {{ displayChargers.length }}대
      </span>
      <span v-if="rapidCount > 0" class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-primary-100 text-primary-800">
        급속 {{ rapidCount }}대
      </span>
      <span v-if="slowCount > 0" class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-green-100 text-green-800">
        완속 {{ slowCount }}대
      </span>
    </div>

    <!-- 충전소 기본 정보 -->
    <DetailRow
      v-if="details.useTime"
      label="이용시간"
      :value="formatOperatingHours(details.useTime)"
    />
    <DetailRow
      v-if="details.busiNm"
      label="운영기관"
      :value="details.busiNm"
    />
    <DetailRow
      v-if="details.busiCall"
      label="운영기관 연락처"
      :value="details.busiCall"
      type="phone"
    />
    <DetailRow
      v-if="details.year"
      label="설치년도"
      :value="`${details.year}년`"
    />

    <!-- 주차/이용제한 정보 -->
    <div
      v-if="details.parkingFree != null || details.limitYn != null"
      class="pt-3 border-t border-slate-200"
    >
      <p class="text-xs font-medium text-slate-500 mb-2">이용 정보</p>
      <div class="flex flex-col gap-2">
        <div v-if="details.parkingFree != null" class="flex items-center gap-1.5 text-sm text-slate-700">
          <span :class="details.parkingFree === 'Y' ? 'text-green-600' : 'text-slate-500'">{{ details.parkingFree === 'Y' ? '✓' : '✗' }}</span>
          <span>{{ details.parkingFree === 'Y' ? '무료주차' : '유료주차' }}</span>
        </div>
        <div v-if="details.limitYn != null" class="flex items-center gap-1.5 text-sm text-slate-700">
          <span :class="details.limitYn === 'Y' ? 'text-red-500' : 'text-green-600'">{{ details.limitYn === 'Y' ? '✓' : '✗' }}</span>
          <span>이용제한 {{ details.limitYn === 'Y' ? '있음' : '없음' }}</span>
        </div>
        <p v-if="details.limitYn === 'Y' && details.limitDetail" class="text-sm text-slate-500 ml-5">{{ details.limitDetail }}</p>
      </div>
    </div>

    <!-- 위치 정보 -->
    <div v-if="details.addrDetail || details.location" class="pt-3 border-t border-slate-200">
      <p class="text-xs font-medium text-slate-500 mb-2">위치 정보</p>
      <div class="flex flex-col gap-1">
        <p v-if="details.addrDetail" class="text-sm text-slate-900">{{ details.addrDetail }}</p>
        <p v-if="details.location" class="text-sm text-slate-500">{{ details.location }}</p>
      </div>
    </div>

    <!-- 안내사항 -->
    <div v-if="details.note" class="pt-3 border-t border-slate-200">
      <p class="text-xs font-medium text-slate-500 mb-2">안내사항</p>
      <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ details.note }}</p>
    </div>

    <!-- 충전기 목록 -->
    <div v-if="displayChargers?.length" class="pt-3 border-t border-slate-200">
      <div class="flex items-center justify-between mb-3">
        <p class="text-xs font-medium text-slate-500">충전기 현황</p>
        <span v-if="freshnessLabel" class="text-xs font-medium" :class="freshnessClass">
          {{ freshnessLabel }}
        </span>
      </div>
      <div class="space-y-2">
        <div
          v-for="(charger, index) in displayChargers"
          :key="charger.chgerId || index"
          class="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
        >
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-mono text-slate-500">#{{ charger.chgerId || index + 1 }}</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              :class="getTypeBadgeClass(charger)"
            >
              {{ getTypeLabel(charger) }}
            </span>
            <span v-if="charger.output" class="text-xs text-slate-600">{{ charger.output }}kW</span>
            <span v-if="charger.method" class="text-xs text-slate-500">{{ charger.method }}</span>
          </div>
          <span
            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            :class="getStatBadgeClass(charger)"
          >
            {{ getStatLabel(charger) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { EvChargerDetails, EvChargerItem } from '~/types/facility'
import { formatOperatingHours } from '~/utils/formatOperatingHours'

const POLL_INTERVAL = 30_000
const TICK_INTERVAL = 15_000

const props = defineProps<{
  details: EvChargerDetails
}>()

const liveStatuses = ref<Map<string, { stat: string; statUpdDt: string }>>(new Map())
const lastUpdated = ref<Date | null>(null)
const hasFailed = ref(false)
const now = ref(new Date())
let pollTimer: ReturnType<typeof setInterval> | null = null
let tickTimer: ReturnType<typeof setInterval> | null = null

const freshnessLabel = computed(() => {
  if (!props.details.statId) return ''
  if (!lastUpdated.value) {
    return hasFailed.value ? '갱신 실패 · 재시도 중' : '갱신 중…'
  }
  const diffMin = Math.floor((now.value.getTime() - lastUpdated.value.getTime()) / 60_000)
  const baseLabel = diffMin < 1 ? '방금 갱신' : `${diffMin}분 전 갱신`
  return hasFailed.value ? `${baseLabel} · 재시도 중` : baseLabel
})

const freshnessClass = computed(() => {
  if (!lastUpdated.value && hasFailed.value) return 'text-rose-600'
  if (hasFailed.value) return 'text-amber-600'
  return 'text-emerald-600'
})

const displayChargers = computed(() => {
  if (!props.details.chargers) return []
  if (liveStatuses.value.size === 0) return props.details.chargers
  return props.details.chargers.map(charger => {
    const live = liveStatuses.value.get(charger.chgerId || '')
    if (!live) return charger
    return { ...charger, stat: live.stat, statUpdDt: live.statUpdDt }
  })
})

const rapidCount = computed(() =>
  displayChargers.value.filter(c => parseFloat(c.output || '0') >= 50).length || 0
)
const slowCount = computed(() =>
  displayChargers.value.filter(c => parseFloat(c.output || '0') < 50).length || 0
)

async function pollStatus() {
  if (!props.details.statId) return
  try {
    const apiBase = useApiBase()
    const res = await $fetch<{ success: boolean; data: Array<{ chgerId: string; stat: string; statUpdDt: string }> }>(
      `${apiBase}/api/facilities/ev-charger/${props.details.statId}/status`,
      { timeout: 10_000 }
    )
    if (res.success && res.data) {
      const newMap = new Map<string, { stat: string; statUpdDt: string }>()
      for (const item of res.data) {
        newMap.set(item.chgerId, { stat: item.stat, statUpdDt: item.statUpdDt })
      }
      liveStatuses.value = newMap
      lastUpdated.value = new Date()
      now.value = lastUpdated.value
      hasFailed.value = false
    } else {
      hasFailed.value = true
    }
  } catch {
    hasFailed.value = true
  }
}

function startPolling() {
  if (pollTimer || !props.details.statId) return
  pollStatus()
  pollTimer = setInterval(pollStatus, POLL_INTERVAL)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function handleVisibility() {
  if (typeof document === 'undefined') return
  if (document.visibilityState === 'visible') {
    startPolling()
  } else {
    stopPolling()
  }
}

onMounted(() => {
  if (typeof window === 'undefined') return
  if (!props.details.statId) return
  startPolling()
  tickTimer = setInterval(() => { now.value = new Date() }, TICK_INTERVAL)
  document.addEventListener('visibilitychange', handleVisibility)
})

onUnmounted(() => {
  stopPolling()
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibility)
  }
})

function getTypeLabel(charger: EvChargerItem): string {
  return parseFloat(charger.output || '0') >= 50 ? '급속' : '완속'
}

function getTypeBadgeClass(charger: EvChargerItem): string {
  return parseFloat(charger.output || '0') >= 50 ? 'bg-primary-100 text-primary-800' : 'bg-green-100 text-green-800'
}

function getStatLabel(charger: EvChargerItem): string {
  const stat = charger.stat || ''
  if (stat === '2') return '충전대기'
  if (stat === '3') return '충전중'
  if (stat === '4') return '운영중지'
  if (stat === '1') return '통신이상'
  if (stat === '9') return '상태미확인'
  return '상태미확인'
}

function getStatBadgeClass(charger: EvChargerItem): string {
  const stat = charger.stat || ''
  if (stat === '2') return 'bg-green-100 text-green-800'
  if (stat === '3') return 'bg-yellow-100 text-yellow-800'
  if (stat === '4') return 'bg-red-100 text-red-800'
  return 'bg-slate-100 text-slate-800'
}
</script>
