<template>
  <div
    v-if="shouldShow"
    ref="container"
    :class="[
      'ad-banner',
      `ad-banner--${effectiveAdFormat}`,
      isCompactMobileActive ? 'ad-banner--compact-mobile' : 'ad-banner--default',
      'my-3 w-full',
      { 'ad-banner--timed-out': isTimedOut },
    ]"
  >
    <ClientOnly>
      <ins
        :key="adKey"
        class="adsbygoogle"
        :style="insStyle"
        :data-ad-client="AD_CLIENT"
        :data-ad-slot="adSlot"
        :data-ad-format="effectiveAdFormat"
        :data-full-width-responsive="insFullWidthResponsive"
        :data-adtest="adTest"
      />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDeferredAdSenseRequest } from './useDeferredAdSenseRequest'

const AD_CLIENT = 'ca-pub-2088264360250020'
const adTest = import.meta.dev ? 'on' : undefined
// SPA 네비게이션 시 AdSense 가 페이지 한도 초과로 응답을 보류하면
// data-ad-status 가 영영 설정되지 않아 빈 박스가 그대로 남는다.
// 이 시간 안에 status 가 안 잡히면 부모를 collapse 한다.
const STATUS_TIMEOUT_MS = 4000

const props = withDefaults(defineProps<{
  adSlot?: string
  adFormat?: 'auto' | 'rectangle' | 'horizontal' | 'vertical'
  fullWidthResponsive?: 'true' | 'false'
  only?: 'mobile' | 'desktop'
  sizing?: 'fixed' | 'min'
  fixedHeight?: number
  variant?: 'default' | 'compact-mobile'
}>(), {
  adSlot: '1878068382',
  adFormat: 'auto',
  fullWidthResponsive: 'true',
  sizing: 'min',
  variant: 'default',
})

// dev-only warn — sizing="fixed"에 명시 포맷/높이 필수
if (import.meta.dev && props.sizing === 'fixed') {
  if (props.adFormat === 'auto') {
    console.warn('[AdBanner] sizing="fixed"에는 명시 adFormat 필수 (auto 금지)')
  }
  if (!props.fixedHeight) {
    console.warn('[AdBanner] sizing="fixed"에는 fixedHeight 필수')
  }
}

const adKey = ref(0)
const route = useRoute()
const container = ref<HTMLElement | null>(null)
const isTimedOut = ref(false)
let statusTimeoutId: ReturnType<typeof setTimeout> | null = null
let statusObserver: MutationObserver | null = null

// viewport gate: only prop 가 없으면 항상 노출, 있으면 매칭될 때만 노출.
const matches = ref(false)
const isDesktopViewport = ref(false)
let mq: MediaQueryList | null = null

const shouldShow = computed(() => !props.only || matches.value)
const isCompactMobileActive = computed(() =>
  props.variant === 'compact-mobile' && !isDesktopViewport.value
)

const effectiveAdFormat = computed(() =>
  isCompactMobileActive.value && props.adFormat === 'auto'
    ? 'horizontal'
    : props.adFormat
)

const insStyle = computed(() =>
  isCompactMobileActive.value
    ? 'display:inline-block; width:100%; max-width:336px; height:150px'
    : props.sizing === 'fixed' && props.fixedHeight
    ? `display:inline-block; width:100%; height:${props.fixedHeight}px`
    : 'display: block; width: 100%'
)
const insFullWidthResponsive = computed(() =>
  isCompactMobileActive.value || props.sizing === 'fixed'
    ? 'false'
    : props.fullWidthResponsive
)

function applyMatches() {
  if (mq) {
    isDesktopViewport.value = mq.matches
  }
  if (!props.only || !mq) {
    matches.value = true
    return
  }
  matches.value = props.only === 'desktop' ? mq.matches : !mq.matches
}

const { scheduleAdRequest } = useDeferredAdSenseRequest(container)

function clearStatusTimeout() {
  if (statusTimeoutId !== null) {
    clearTimeout(statusTimeoutId)
    statusTimeoutId = null
  }
}

function disconnectStatusObserver() {
  if (statusObserver) {
    statusObserver.disconnect()
    statusObserver = null
  }
}

// AdSense 가 설정한 data-ad-status 는 terminal 상태다.
// - filled        → (timeout 으로 미리 collapse 됐더라도) 다시 노출. 늦은 응답 회복.
// - unfilled / unfill-optimized → CSS 가 collapse. 그대로 둔다.
function handleStatus(status: string) {
  if (status === 'filled') {
    isTimedOut.value = false
  }
  clearStatusTimeout()
  disconnectStatusObserver()
}

// status 가 4s 안에 안 잡히면 일단 collapse(빈 박스 방지)하되, observer 는 계속 살려둬
// AdSense 가 4s 이후 늦게 filled 하면 handleStatus 에서 collapse 를 복구한다.
function watchStatus() {
  // onMounted / route watch 는 클라이언트에서만 호출되므로 별도 가드 불필요.
  clearStatusTimeout()
  disconnectStatusObserver()
  isTimedOut.value = false

  const ins = container.value?.querySelector<HTMLElement>('ins.adsbygoogle')
  if (!ins) return

  // 이미 status 가 잡혀 있으면 즉시 처리.
  if (ins.dataset.adStatus) {
    handleStatus(ins.dataset.adStatus)
    return
  }

  if (typeof MutationObserver !== 'undefined') {
    statusObserver = new MutationObserver(() => {
      const status = ins.dataset.adStatus
      if (status) handleStatus(status)
    })
    statusObserver.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] })
  }

  statusTimeoutId = setTimeout(() => {
    statusTimeoutId = null
    if (!ins.dataset.adStatus) {
      isTimedOut.value = true
    }
  }, STATUS_TIMEOUT_MS)
}

function refresh() {
  scheduleAdRequest()
  watchStatus()
}

onMounted(() => {
  if (props.only || props.variant === 'compact-mobile') {
    mq = typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 768px)')
      : null
    applyMatches()
    mq?.addEventListener('change', applyMatches)
    // only는 matches 가 false→true 로 바뀌는 순간 아래 watch 에서 refresh.
    // compact-mobile은 같은 슬롯이 데스크톱에서 기본 auto 동작으로 돌아가므로 즉시 refresh.
    if (!props.only) refresh()
  } else {
    matches.value = true
    refresh()
  }
})

// viewport 가 매칭으로 바뀌면 ref 가 새로 바인딩되므로 nextTick 후 refresh.
watch(matches, async (next) => {
  if (!props.only || !next) return
  await nextTick()
  refresh()
})

watch(() => route.path, async () => {
  if (!shouldShow.value) return
  adKey.value++
  await nextTick()
  refresh()
})

onBeforeUnmount(() => {
  mq?.removeEventListener('change', applyMatches)
  clearStatusTimeout()
  disconnectStatusObserver()
})
</script>

<style>
/* CLS 방지: 광고 슬롯 형식별로 예약 공간(min-height) 확보.
   AdSense 가 status 판정 전에 슬롯 크기를 측정할 수 있도록 ins 높이는 앱에서
   0으로 강제하지 않는다. unfilled 가 확정된 경우에만 부모까지 collapse 한다. */
.ad-banner--auto {
  min-height: 100px;
}
@media (max-width: 767px) {
  .ad-banner--auto {
    min-height: 280px;
  }
}
.ad-banner--horizontal {
  min-height: 90px;
}
.ad-banner--rectangle {
  min-height: 250px;
}
.ad-banner--compact-mobile {
  min-height: 150px;
  text-align: center;
}

/* AdSense 가 채우지 않기로 결정한 슬롯(unfilled / unfill-optimized) 은 ins 와 부모
   컨테이너 모두 제거해 예약 공간을 회수한다. unfill-optimized 는 SPA 네비게이션 시
   AdSense 가 페이지당 최대 광고수를 넘어섰다고 판단해 일부 슬롯을 의도적으로 비울 때
   설정되며, unfilled 와 마찬가지로 사용자에게 빈 박스로 보이지 않도록 collapse 한다. */
.ad-banner ins.adsbygoogle[data-ad-status='unfilled'],
.ad-banner ins.adsbygoogle[data-ad-status='unfill-optimized'] {
  display: none !important;
}

.ad-banner:has(ins.adsbygoogle[data-ad-status='unfilled']),
.ad-banner:has(ins.adsbygoogle[data-ad-status='unfill-optimized']) {
  display: none !important;
  min-height: 0 !important;
}

/* AdSense 가 응답 자체를 보류해 data-ad-status 가 끝내 설정되지 않은 슬롯도
   빈 박스로 남지 않도록 timeout 후 부모 collapse. SPA 네비게이션 시 페이지
   한도 초과로 두 번째 슬롯이 status 미설정 상태로 멈추는 케이스를 처리. */
.ad-banner--timed-out {
  display: none !important;
  min-height: 0 !important;
}
</style>
