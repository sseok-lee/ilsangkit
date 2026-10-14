<template>
  <div
    v-if="shouldShow"
    ref="container"
    :class="[
      'ad-banner',
      `ad-banner--${attributes.format}`,
      attributes.compact ? 'ad-banner--compact-mobile' : 'ad-banner--default',
      'my-3 w-full',
      { 'ad-banner--collapsed': collapseReason },
    ]"
    :style="{ '--ad-fixed-height': `${attributes.fixedHeight}px` }"
  >
    <ClientOnly>
      <ins
        :key="adKey"
        ref="insRef"
        class="adsbygoogle"
        :style="attributes.style"
        :data-ad-client="AD_CLIENT"
        :data-ad-slot="attributes.slot"
        :data-ad-format="attributes.format"
        :data-full-width-responsive="attributes.fullWidth"
        :data-adtest="adTest"
      />
    </ClientOnly>
  </div>
</template>

<script lang="ts">
export const AD_SLOT_MOBILE = '9920012184'
export const AD_SLOT_DESKTOP = '8606930518'
let nextInstanceId = 0
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useDeferredAdSenseRequest } from './useDeferredAdSenseRequest'
import { useAdsPolicy } from '~/composables/useAdsPolicy'
import {
  useAdSenseRuntime,
  type AdCollapseReason,
  type AdDebugInput,
  type AdPageType,
} from '~/composables/useAdSenseRuntime'

const AD_CLIENT = 'ca-pub-2088264360250020'
const adTest = import.meta.dev ? 'on' : undefined
const MIN_NAV_INTERVAL_MS = 1500
const props = withDefaults(
  defineProps<{
    adSlot?: string
    adFormat?: 'auto' | 'rectangle' | 'horizontal' | 'vertical'
    fullWidthResponsive?: 'true' | 'false'
    only?: 'mobile' | 'desktop'
    sizing?: 'fixed' | 'min'
    fixedHeight?: number
    variant?: 'default' | 'compact-mobile'
  }>(),
  { adFormat: 'auto', fullWidthResponsive: 'true', sizing: 'min', variant: 'default' }
)

if (
  import.meta.dev &&
  props.sizing === 'fixed' &&
  (props.adFormat === 'auto' || !props.fixedHeight)
) {
  console.warn('[AdBanner] sizing="fixed" requires an explicit format and height')
}

const route = useRoute()
const runtime = useAdSenseRuntime()
const { shouldServeAds } = useAdsPolicy()
const container = shallowRef<HTMLElement | null>(null)
const insRef = shallowRef<HTMLElement | null>(null)
const adKey = ref(0)
const isDesktop = ref(false)
const viewportKnown = ref(false)
let mq: MediaQueryList | null = null
let lastNavAt = 0
const shouldShow = computed(
  () =>
    shouldServeAds.value &&
    (!props.only || (viewportKnown.value && (props.only === 'desktop') === isDesktop.value))
)
const adStatus = ref('')
const elementHidden = ref(false)
const collapseReason = computed<AdCollapseReason>(() => {
  if (runtime.loader.value.phase === 'error') return 'loader-error'
  if (adStatus.value === 'unfilled') return 'unfilled'
  if (elementHidden.value) return 'element-hidden'
  return null
})

const proposedAttributes = computed(() => {
  const compact = props.variant === 'compact-mobile' && !isDesktop.value
  const fixedHeight = compact ? 150 : props.sizing === 'fixed' ? (props.fixedHeight ?? 0) : 0
  return {
    slot: props.adSlot ?? (isDesktop.value ? AD_SLOT_DESKTOP : AD_SLOT_MOBILE),
    format: compact && props.adFormat === 'auto' ? 'horizontal' : props.adFormat,
    fullWidth: compact || props.sizing === 'fixed' ? 'false' : props.fullWidthResponsive,
    style: compact
      ? 'display: inline-block; width: 100%; max-width: 336px; height: 150px;'
      : fixedHeight
        ? `display: inline-block; width: 100%; height: ${fixedHeight}px;`
        : 'display: block; width: 100%;',
    compact,
    fixedHeight,
  }
})
const lockedAttributes = shallowRef<typeof proposedAttributes.value | null>(null)
const attributes = computed(() => lockedAttributes.value ?? proposedAttributes.value)

function pageType(): AdPageType {
  const name = String(route.name ?? '')
  if (/^real-estate-.*buildingName/.test(name)) return 'building-detail'
  if (name === 'subscription-id') return 'subscription-detail'
  if (name === 'category-id') return 'facility-detail'
  if (name === 'guide-slug') return 'guide-detail'
  return 'other'
}
let instanceId = 0
function record(input: AdDebugInput, ins = insRef.value) {
  runtime.record({
    instanceId,
    pageType: pageType(),
    order: ins
      ? Array.from(document.querySelectorAll('.ad-banner ins.adsbygoogle')).indexOf(ins) + 1
      : 0,
    device: isDesktop.value ? 'desktop' : 'mobile',
    adSlot: ins?.getAttribute('data-ad-slot') ?? attributes.value.slot,
    width: container.value?.offsetWidth ?? 0,
    height: container.value?.offsetHeight ?? 0,
    status: adStatus.value,
    collapseReason: collapseReason.value,
    ...input,
  })
}
const request = useDeferredAdSenseRequest(
  container,
  () => shouldShow.value && !collapseReason.value,
  {
    element: insRef,
    sdkReady: () => runtime.loader.value.phase === 'ready',
    beforePush(ins) {
      lockedAttributes.value = {
        ...attributes.value,
        slot: ins.getAttribute('data-ad-slot')!,
        format: ins.getAttribute('data-ad-format') as typeof attributes.value.format,
        fullWidth: ins.getAttribute('data-full-width-responsive')!,
        style: ins.getAttribute('style')!,
      }
    },
    onEvent(kind, errorKind) {
      record({ kind, ...(errorKind ? { errorKind } : {}) })
    },
  }
)

let stopObserving = () => {}
watch(
  insRef,
  (ins) => {
    stopObserving()
    adStatus.value = ''
    elementHidden.value = false
    if (!ins) {
      lockedAttributes.value = null
      return
    }
    instanceId = ++nextInstanceId
    let active = true
    record({ kind: 'slot-mounted' }, ins)
    const read = () => {
      if (!active || ins !== insRef.value || !ins.isConnected) return
      const status = ins.dataset.adStatus ?? ''
      // Our own unfilled CSS must not be mistaken for an external blocker.
      const hidden = status !== 'unfilled' && getComputedStyle(ins).display === 'none'
      const statusChanged = status !== adStatus.value
      const hiddenChanged = hidden !== elementHidden.value
      adStatus.value = status
      elementHidden.value = hidden
      if (statusChanged) record({ kind: 'status-change' }, ins)
      if (hiddenChanged) record({ kind: hidden ? 'element-hidden' : 'element-shown' }, ins)
      request.reevaluate()
    }
    const mutation = new MutationObserver(read)
    mutation.observe(ins, {
      attributes: true,
      attributeFilter: ['data-ad-status', 'class', 'style'],
    })
    const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null
    resize?.observe(ins)
    // Resize also catches media-query styles when ResizeObserver is unavailable.
    window.addEventListener('resize', read)
    stopObserving = () => {
      active = false
      mutation.disconnect()
      resize?.disconnect()
      window.removeEventListener('resize', read)
      record({ kind: 'slot-disposed' }, ins)
    }
    read()
  },
  { flush: 'post' }
)

function applyViewport() {
  isDesktop.value = mq?.matches ?? false
  viewportKnown.value = true
}
onMounted(() => {
  mq = typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 768px)') : null
  applyViewport()
  mq?.addEventListener('change', applyViewport)
})
watch(
  () => route.path,
  () => {
    if (!shouldShow.value) return
    const now = performance.now()
    // Keep this element and its observers/waiters during rapid navigation.
    if (now - lastNavAt < MIN_NAV_INTERVAL_MS) return
    lastNavAt = now
    lockedAttributes.value = null
    adKey.value++
  },
  { flush: 'pre' }
)
onBeforeUnmount(() => {
  stopObserving()
  mq?.removeEventListener('change', applyViewport)
})
</script>

<style>
.ad-banner {
  --ad-min-height: 0px;
  position: relative;
  min-height: max(var(--ad-min-height), var(--ad-fixed-height, 0px));
}
.ad-banner--auto {
  --ad-min-height: 122px;
}
@media (max-width: 767px) {
  .ad-banner--auto {
    --ad-min-height: 302px;
  }
}
.ad-banner--horizontal {
  --ad-min-height: 112px;
}
.ad-banner--rectangle {
  --ad-min-height: 272px;
}
.ad-banner--compact-mobile {
  --ad-min-height: 170px;
  text-align: center;
}
/* Inline fixed ads must not add a text-baseline gap after hydration. */
.ad-banner ins.adsbygoogle {
  vertical-align: top;
}
.ad-banner--collapsed {
  height: 0 !important;
  min-height: 0 !important;
  margin-block: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  overflow: hidden;
}
.ad-banner ins.adsbygoogle[data-ad-status='unfilled'] {
  display: none !important;
}
</style>
