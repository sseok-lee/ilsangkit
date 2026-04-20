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
/* 광고가 채워지지 않으면 AdSense가 data-ad-status="unfilled"을 설정한다.
   이 때 ins는 style로 height:280px가 강제로 걸리므로 명시적으로 숨겨 공간을 회수한다. */
.ad-banner ins.adsbygoogle[data-ad-status='unfilled'] {
  display: none !important;
}
</style>
