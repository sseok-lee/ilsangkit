<template>
  <div class="ad-banner my-6 w-full">
    <ClientOnly>
      <ins
        :key="adKey"
        class="adsbygoogle"
        style="display: block; width: 100%"
        :data-ad-client="AD_CLIENT"
        :data-ad-slot="adSlot"
        :data-ad-format="adFormat"
        :data-full-width-responsive="fullWidthResponsive"
      />
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

const adKey = ref(0)
const route = useRoute()

function pushAd() {
  nextTick(() => {
    try {
      const adsbygoogle = (window as any).adsbygoogle || []
      adsbygoogle.push({})
    } catch {
      // adsbygoogle push 실패는 무시 (광고 차단기/네트워크 실패 시 자연 collapse)
    }
  })
}

onMounted(pushAd)

watch(() => route.fullPath, () => {
  adKey.value++
  pushAd()
})
</script>

<style>
/* AdSense가 status 판정 전에 인라인 height(예: 280~600px)을 걸어둬 빈 박스가 보이는
   문제를 막기 위해, 초기 상태(data-ad-status 미설정)에서는 높이 0으로 강제한다.
   width는 100% 유지 → AdSense가 컨테이너 폭을 측정해 광고 크기를 결정하는 데 지장 없음. */
.ad-banner ins.adsbygoogle:not([data-ad-status]) {
  height: 0 !important;
  min-height: 0 !important;
}

/* unfilled 확정 시 ins 자체를 제거한다. */
.ad-banner ins.adsbygoogle[data-ad-status='unfilled'] {
  display: none !important;
}

/* unfilled 확정 시 부모 컨테이너(.ad-banner)까지 collapse해 my-6 마진을 제거한다.
   (localhost·광고 차단기 환경에서 빈 박스가 남는 문제 해결) */
.ad-banner:has(ins.adsbygoogle[data-ad-status='unfilled']) {
  display: none !important;
}
</style>
