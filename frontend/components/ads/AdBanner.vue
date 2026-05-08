<template>
  <div
    ref="container"
    :class="[
      'ad-banner',
      `ad-banner--${adFormat}`,
      'my-3 w-full',
      { 'ad-banner--timed-out': isTimedOut },
    ]"
  >
    <ClientOnly>
      <ins
        :key="adKey"
        class="adsbygoogle"
        style="display: block; width: 100%"
        :data-ad-client="AD_CLIENT"
        :data-ad-slot="adSlot"
        :data-ad-format="adFormat"
        :data-full-width-responsive="fullWidthResponsive"
        :data-adtest="adTest"
      />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDeferredAdSenseRequest } from './useDeferredAdSenseRequest'

const AD_CLIENT = 'ca-pub-2088264360250020'
const adTest = import.meta.dev ? 'on' : undefined
// SPA 네비게이션 시 AdSense 가 페이지 한도 초과로 응답을 보류하면
// data-ad-status 가 영영 설정되지 않아 빈 박스가 그대로 남는다.
// 이 시간 안에 status 가 안 잡히면 부모를 collapse 한다.
const STATUS_TIMEOUT_MS = 4000

withDefaults(defineProps<{
  adSlot?: string
  adFormat?: string
  fullWidthResponsive?: string
}>(), {
  adSlot: '1878068382',
  adFormat: 'auto',
  fullWidthResponsive: 'true',
})

const adKey = ref(0)
const route = useRoute()
const container = ref<HTMLElement | null>(null)
const isTimedOut = ref(false)
let statusTimeoutId: ReturnType<typeof setTimeout> | null = null

const { scheduleAdRequest } = useDeferredAdSenseRequest(container)

function clearStatusTimeout() {
  if (statusTimeoutId !== null) {
    clearTimeout(statusTimeoutId)
    statusTimeoutId = null
  }
}

function watchStatusTimeout() {
  // onMounted / route watch 는 클라이언트에서만 호출되므로 별도 가드 불필요.
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

function refresh() {
  scheduleAdRequest()
  watchStatusTimeout()
}

onMounted(refresh)

watch(() => route.fullPath, () => {
  adKey.value++
  refresh()
})

onBeforeUnmount(clearStatusTimeout)
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
    min-height: 250px;
  }
}
.ad-banner--horizontal {
  min-height: 90px;
}
.ad-banner--rectangle {
  min-height: 250px;
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
