<template>
  <div ref="container" :class="['ad-banner', `ad-banner--${adFormat}`, 'my-3 w-full']">
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
import { onMounted, ref, watch } from 'vue'
import { useDeferredAdSenseRequest } from './useDeferredAdSenseRequest'

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
const container = ref<HTMLElement | null>(null)
const { scheduleAdRequest } = useDeferredAdSenseRequest(container)

onMounted(scheduleAdRequest)

watch(() => route.fullPath, () => {
  adKey.value++
  scheduleAdRequest()
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
</style>
