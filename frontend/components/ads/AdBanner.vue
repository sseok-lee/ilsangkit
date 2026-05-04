<template>
  <div :class="['ad-banner', `ad-banner--${adFormat}`, 'my-3 w-full']">
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
/* CLS 방지: 광고 슬롯 형식별로 예약 공간(min-height) 확보.
   AdSense 가 status 판정 전에는 ins 를 height:0 으로 두지만 부모 .ad-banner 에
   min-height 를 걸어 레이아웃을 잡아둔다. 채워지면 ins 의 iframe 이 그 공간을
   채우고, unfilled 면 부모 자체를 display:none 으로 collapse 하므로 빈 박스도
   남지 않는다. */
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

/* status 판정 전에는 ins 를 0 으로 — 부모 min-height 가 공간을 잡고 있으므로
   여기서는 빈 박스를 보이지 않게만 하면 된다. */
.ad-banner ins.adsbygoogle:not([data-ad-status]) {
  height: 0 !important;
  min-height: 0 !important;
}

/* unfilled 확정 시 ins 와 부모 컨테이너 모두 제거해 예약 공간을 회수한다.
   (localhost · 광고 차단기 환경에서 빈 박스 잔존 방지 + CLS 의도적 허용:
   광고 채움 여부가 결정된 후의 collapse 는 사용자 경험상 자연스러움) */
.ad-banner ins.adsbygoogle[data-ad-status='unfilled'] {
  display: none !important;
}

.ad-banner:has(ins.adsbygoogle[data-ad-status='unfilled']) {
  display: none !important;
  min-height: 0 !important;
}
</style>
