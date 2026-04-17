<template>
  <div v-if="!adError && !adUnfilled" class="ad-banner my-6">
    <ClientOnly>
      <div :key="adKey" ref="adContainer" class="w-full" style="min-height: 100px">
        <ins
          class="adsbygoogle"
          style="display: block; width: 100%"
          :data-ad-client="AD_CLIENT"
          :data-ad-slot="adSlot"
          :data-ad-format="adFormat"
          :data-full-width-responsive="fullWidthResponsive"
        />
      </div>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const AD_CLIENT = 'ca-pub-2088264360250020'

withDefaults(defineProps<{
  adSlot?: string
  adFormat?: string
  fullWidthResponsive?: string
}>(), {
  adSlot: '1878068382',
  adFormat: 'auto',
  fullWidthResponsive: 'true',
})

const adContainer = ref<HTMLElement | null>(null)
const adError = ref(false)
const adUnfilled = ref(false)
const adKey = ref(0)
const route = useRoute()
let timers: ReturnType<typeof setTimeout>[] = []

function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
}

function checkAdFilled() {
  if (!adContainer.value) return
  const ins = adContainer.value.querySelector('ins.adsbygoogle')
  if (!ins) return
  const status = ins.getAttribute('data-ad-status')
  if (status === 'unfilled') {
    adUnfilled.value = true
  }
}

function pushAd() {
  clearTimers()
  nextTick(() => {
    try {
      const adsbygoogle = (window as any).adsbygoogle || []
      adsbygoogle.push({})
      timers.push(setTimeout(checkAdFilled, 1500))
      timers.push(setTimeout(checkAdFilled, 3500))
    } catch {
      adError.value = true
    }
  })
}

onMounted(pushAd)

onUnmounted(clearTimers)

watch(() => route.fullPath, () => {
  adError.value = false
  adUnfilled.value = false
  adKey.value++
  pushAd()
})
</script>
