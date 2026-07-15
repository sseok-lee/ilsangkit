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
    <span class="ad-banner__label">광고</span>
    <ClientOnly>
      <ins
        :key="adKey"
        class="adsbygoogle"
        :style="insStyle"
        :data-ad-client="AD_CLIENT"
        :data-ad-slot="effectiveAdSlot"
        :data-ad-format="effectiveAdFormat"
        :data-full-width-responsive="insFullWidthResponsive"
        :data-adtest="adTest"
      />
    </ClientOnly>
  </div>
</template>

<script lang="ts">
// 기기별 AdSense 광고 단위 — AdSense 는 광고 단위 단위로 최적화·리포팅한다.
// 단위가 하나면 모바일(336×150)과 데스크톱(전폭 auto)이 같은 단위로 섞여
// 구글도 학습을 못 하고 우리도 기기별 성과를 리포트에서 분리할 수 없다.
// 실측(LAST_7_DAYS, In-page): 모바일 채움 93.7%·RPM 0.413 vs 데스크톱 76.1%·RPM 0.165.
//
// legacy `ilsangkit-display`(1878068382) 는 과거 리포트 보존을 위해 계정에 남겨두되
// 코드에서는 더 이상 쓰지 않는다.
// <script setup> 은 export 를 허용하지 않아 일반 <script> 블록에 둔다(테스트에서 import).
export const AD_SLOT_MOBILE = '9920012184' // AdSense: ilsangkit-mobile
export const AD_SLOT_DESKTOP = '8606930518' // AdSense: ilsangkit-desktop
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDeferredAdSenseRequest } from './useDeferredAdSenseRequest'
import { useAdsPolicy } from '~/composables/useAdsPolicy'

const AD_CLIENT = 'ca-pub-2088264360250020'
const adTest = import.meta.dev ? 'on' : undefined
// SPA 네비게이션/애드블록 등으로 AdSense 가 data-ad-status 를 끝내 설정하지 않으면
// 빈 박스가 남는다. 이 시간 안에 status 가 안 잡히면 부모를 collapse 한다.
// 늦게 filled 되면 살아있는 MutationObserver 가 handleStatus 에서 복구한다(광고 무손실).
const STATUS_TIMEOUT_MS = 1500
// 짧은 간격 연속 네비게이션(봇/빠른 클릭) 시 광고 재요청을 억제 — 인위적 임프레션 방지.
const MIN_NAV_INTERVAL_MS = 1500
let lastNavAt = 0

const props = withDefaults(defineProps<{
  /** 명시하면 기기별 단위 대신 이 슬롯을 쓴다. */
  adSlot?: string
  adFormat?: 'auto' | 'rectangle' | 'horizontal' | 'vertical'
  fullWidthResponsive?: 'true' | 'false'
  only?: 'mobile' | 'desktop'
  sizing?: 'fixed' | 'min'
  fixedHeight?: number
  variant?: 'default' | 'compact-mobile'
}>(), {
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
const { shouldServeAds } = useAdsPolicy()
const isTimedOut = ref(false)
let statusTimeoutId: ReturnType<typeof setTimeout> | null = null
let statusObserver: MutationObserver | null = null

// viewport gate: only prop 가 없으면 항상 노출, 있으면 매칭될 때만 노출.
const matches = ref(false)
const isDesktopViewport = ref(false)
let mq: MediaQueryList | null = null

const shouldShow = computed(() => shouldServeAds.value && (!props.only || matches.value))
const isCompactMobileActive = computed(() =>
  props.variant === 'compact-mobile' && !isDesktopViewport.value
)

const effectiveAdFormat = computed(() =>
  isCompactMobileActive.value && props.adFormat === 'auto'
    ? 'horizontal'
    : props.adFormat
)

// 기기별 광고 단위. adSlot 을 명시하면 그쪽이 우선한다.
// isDesktopViewport 는 onMounted 의 matchMedia 로 확정되고, <ins> 는 <ClientOnly> 안이라
// 그 다음 틱에 삽입되므로 첫 렌더부터 올바른 슬롯이 나간다(요청 후 슬롯이 바뀌지 않음).
const effectiveAdSlot = computed(() =>
  props.adSlot ?? (isDesktopViewport.value ? AD_SLOT_DESKTOP : AD_SLOT_MOBILE)
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

const { scheduleAdRequest } = useDeferredAdSenseRequest(container, () => shouldServeAds.value)

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

// <ins> 는 <ClientOnly> 안에 있어 onMounted 동기 시점엔 아직 DOM 에 없을 수 있다
// (ClientOnly 가 다음 렌더 틱에 slot 을 삽입). 그 순간 watchStatus 가 ins 를 못 찾고
// bail 하면 collapse 타이머가 영영 설치되지 않아, AdSense 가 status 를 보류한(unset)
// 슬롯이 빈 박스로 남는다. ins 가 나타날 때까지 제한된 틱 동안 재시도한 뒤 watcher 를 건다.
const MAX_INS_WAIT_TICKS = 10
let statusWatchGeneration = 0

// status 가 1.5s 안에 안 잡히면 일단 collapse(빈 박스 방지)하되, observer 는 계속 살려둬
// AdSense 가 1.5s 이후 늦게 filled 하면 handleStatus 에서 collapse 를 복구한다.
function watchStatus() {
  // onMounted / route watch 는 클라이언트에서만 호출되므로 별도 가드 불필요.
  clearStatusTimeout()
  disconnectStatusObserver()
  isTimedOut.value = false
  armStatusWatch(++statusWatchGeneration, 0)
}

function armStatusWatch(generation: number, attempt: number) {
  // 더 최신 watchStatus 호출(route 변경 등)이나 언마운트가 발생하면 이 재시도는 폐기.
  if (generation !== statusWatchGeneration) return

  const ins = container.value?.querySelector<HTMLElement>('ins.adsbygoogle')
  if (!ins) {
    // ClientOnly 가 ins 를 다음 틱에 삽입하므로, 아직 없으면 잠깐 기다렸다 재시도.
    if (attempt >= MAX_INS_WAIT_TICKS) return
    void nextTick(() => armStatusWatch(generation, attempt + 1))
    return
  }

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
  // mq 는 항상 만든다 — 기기별 광고 단위(effectiveAdSlot)가 isDesktopViewport 에 의존하므로,
  // only/compact-mobile 이 아닌 기본 AdBanner 도 기기를 판정해야 한다.
  // (이전에는 이 블록이 조건부여서 기본 AdBanner 는 isDesktopViewport 가 false 로 고정됐다.)
  mq = typeof window.matchMedia === 'function'
    ? window.matchMedia('(min-width: 768px)')
    : null
  applyMatches()
  mq?.addEventListener('change', applyMatches)

  if (props.only || props.variant === 'compact-mobile') {
    // only는 matches 가 false→true 로 바뀌는 순간 아래 watch 에서 refresh.
    // compact-mobile은 같은 슬롯이 데스크톱에서 기본 auto 동작으로 돌아가므로 즉시 refresh.
    if (!props.only) refresh()
  } else {
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
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
  if (now - lastNavAt < MIN_NAV_INTERVAL_MS) return // rapid-nav 가드
  lastNavAt = now
  adKey.value++
  await nextTick()
  refresh()
})

onBeforeUnmount(() => {
  mq?.removeEventListener('change', applyMatches)
  statusWatchGeneration++ // 대기 중인 ins 재시도 폐기
  clearStatusTimeout()
  disconnectStatusObserver()
})
</script>

<style>
/* CLS 방지: 광고 슬롯 형식별로 예약 공간(min-height) 확보.
   AdSense 가 status 판정 전에 슬롯 크기를 측정할 수 있도록 ins 높이는 앱에서
   0으로 강제하지 않는다. unfilled 가 확정된 경우에만 부모까지 collapse 한다. */
.ad-banner {
  position: relative;
  border: 1px dashed var(--border);
  background: var(--surface-2);
}
.ad-banner__label {
  display: block;
  height: 20px;
  line-height: 20px;
  padding: 0 10px;           /* 가로 padding은 라벨에만 — ins 폭 측정에 무관(라벨은 ins 위 별도 블록) */
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--faint);
}
.ad-banner--auto { min-height: 122px; }        /* 100 → 122 */
@media (max-width: 767px) {
  .ad-banner--auto { min-height: 302px; }       /* 280 → 302 */
}
.ad-banner--horizontal { min-height: 112px; }   /* 90 → 112 */
.ad-banner--rectangle { min-height: 272px; }    /* 250 → 272 */
.ad-banner--compact-mobile { min-height: 170px; text-align: center; } /* 150 → 170 */

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
