<template>
  <div
    v-if="isVisible"
    ref="container"
    :class="[
      'anchor-ad fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t border-line shadow-[0_-2px_8px_-1px_rgba(0,0,0,0.06)]',
      { 'anchor-ad--timed-out': isTimedOut },
    ]"
    :style="{ paddingBottom: 'env(safe-area-inset-bottom)' }"
  >
    <div class="relative w-full">
      <button
        type="button"
        class="absolute -top-6 right-2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-slate-800/85 text-white shadow-md hover:bg-slate-900 transition-colors"
        aria-label="광고 닫기"
        @click="dismiss"
      >
        <span class="material-symbols-outlined text-[14px]">close</span>
      </button>
      <ClientOnly>
        <ins
          :key="adKey"
          class="adsbygoogle block"
          style="display: block; width: 100%; height: 100px"
          :data-ad-client="AD_CLIENT"
          :data-ad-slot="adSlot"
          data-ad-format="horizontal"
          :data-adtest="adTest"
        />
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDeferredAdSenseRequest } from './useDeferredAdSenseRequest'

const AD_CLIENT = 'ca-pub-2088264360250020'
const adTest = import.meta.dev ? 'on' : undefined
const STATUS_TIMEOUT_MS = 4000

withDefaults(defineProps<{
  adSlot?: string
}>(), {
  adSlot: '1878068382',
})

const route = useRoute()
const adKey = ref(0)
const dismissed = ref(false)
const container = ref<HTMLElement | null>(null)
const isTimedOut = ref(false)
let statusTimeoutId: ReturnType<typeof setTimeout> | null = null

function clearStatusTimeout() {
  if (statusTimeoutId !== null) {
    clearTimeout(statusTimeoutId)
    statusTimeoutId = null
  }
}

function watchStatusTimeout() {
  clearStatusTimeout()
  isTimedOut.value = false
  statusTimeoutId = setTimeout(() => {
    statusTimeoutId = null
    const ins = container.value?.querySelector<HTMLElement>('ins.adsbygoogle')
    if (!ins) return
    if (!ins.dataset.adStatus) {
      isTimedOut.value = true
    }
  }, STATUS_TIMEOUT_MS)
}

// 하단 sticky 액션바가 이미 있는 페이지에서는 앵커 광고를 노출하지 않음
const HIDDEN_ROUTE_PATTERNS = [
  /^\/real-estate\/[^/]+\/[^/]+$/,  // 부동산 상세
  /^\/(?:toilet|wifi|parking|hospital|pharmacy|library|aed|clothes|park|school|market|childcare|ev-charger|sports)\/[^/]+$/, // 시설 상세
]

const isVisible = computed(() => {
  if (dismissed.value) return false
  return !HIDDEN_ROUTE_PATTERNS.some((re) => re.test(route.path))
})

const { clearPendingAdRequest, scheduleAdRequest } = useDeferredAdSenseRequest(
  container,
  () => isVisible.value,
)

function dismiss() {
  dismissed.value = true
  if (import.meta.client) {
    try {
      sessionStorage.setItem('anchor-ad-dismissed', '1')
    } catch {
      // sessionStorage 사용 불가 환경은 무시
    }
  }
}

onMounted(() => {
  if (import.meta.client) {
    try {
      if (sessionStorage.getItem('anchor-ad-dismissed') === '1') {
        dismissed.value = true
        clearPendingAdRequest()
        return
      }
    } catch {
      // 무시
    }
  }
  scheduleAdRequest()
  watchStatusTimeout()
})

watch(() => route.fullPath, () => {
  if (!isVisible.value) {
    clearPendingAdRequest()
    clearStatusTimeout()
    isTimedOut.value = false
    return
  }
  adKey.value++
  scheduleAdRequest()
  watchStatusTimeout()
})

onBeforeUnmount(clearStatusTimeout)
</script>

<style scoped>
/* CLS 방지: 부모 컨테이너에 ad height + close 버튼 offset 만큼 사전 예약.
   기존: 14px → 396px 확장 (CLS 0.22). 100px 로 사전 reserve 하면 같은 ad 가
   채워져도 layout shift 가 거의 0. */
.anchor-ad {
  min-height: 100px;
}

.anchor-ad ins.adsbygoogle:not([data-ad-status]) {
  height: 100px !important;
  min-height: 100px !important;
}

.anchor-ad ins.adsbygoogle[data-ad-status='unfilled'],
.anchor-ad ins.adsbygoogle[data-ad-status='unfill-optimized'] {
  display: none !important;
}

.anchor-ad:has(ins.adsbygoogle[data-ad-status='unfilled']),
.anchor-ad:has(ins.adsbygoogle[data-ad-status='unfill-optimized']) {
  display: none !important;
  min-height: 0 !important;
}

/* status 자체가 설정되지 않은 채로 timeout 된 슬롯도 빈 박스로 남지 않도록 collapse */
.anchor-ad--timed-out {
  display: none !important;
  min-height: 0 !important;
}
</style>
