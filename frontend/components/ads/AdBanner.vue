<template>
  <div v-if="!adError && !adUnfilled" class="ad-banner my-6">
    <ClientOnly>
      <div :key="adKey" ref="adContainer" class="w-full">
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
  nextTick(() => {
    try {
      const adsbygoogle = (window as any).adsbygoogle || []
      adsbygoogle.push({})
      setTimeout(checkAdFilled, 1500)
      setTimeout(checkAdFilled, 3500)
    } catch {
      adError.value = true
    }
  })
}

onMounted(pushAd)

watch(() => route.fullPath, () => {
  adError.value = false
  adUnfilled.value = false
  adKey.value++
  pushAd()
})
</script>
