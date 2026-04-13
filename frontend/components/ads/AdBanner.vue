<template>
  <div v-if="!adError" v-show="adLoaded" class="ad-banner my-6">
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
const adLoaded = ref(false)
const adKey = ref(0)
const route = useRoute()

function checkAdFilled() {
  if (!adContainer.value) return
  const ins = adContainer.value.querySelector('ins.adsbygoogle')
  if (ins && ins.getAttribute('data-ad-status') === 'filled') {
    adLoaded.value = true
    return
  }
  // AdSense가 iframe을 삽입했으면 로드 성공
  if (ins && ins.querySelector('iframe')) {
    adLoaded.value = true
    return
  }
  if (ins && ins.getAttribute('data-ad-status') === 'unfilled') {
    adLoaded.value = false
  }
}

function pushAd() {
  nextTick(() => {
    try {
      const adsbygoogle = (window as any).adsbygoogle || []
      adsbygoogle.push({})
      // 광고 로드 확인을 위해 지연 체크
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
  adLoaded.value = false
  adKey.value++
  pushAd()
})
</script>
