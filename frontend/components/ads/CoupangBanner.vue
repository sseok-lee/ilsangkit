<template>
  <div class="w-full">
    <div class="flex justify-center">
      <iframe
        :src="iframeSrc"
        width="680"
        height="140"
        frameborder="0"
        scrolling="no"
        referrerpolicy="unsafe-url"
        loading="lazy"
        class="block max-w-full"
        title="쿠팡 파트너스 추천 상품"
      />
    </div>
    <p class="mt-2 text-center text-[11px] leading-relaxed text-slate-400">
      이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
    </p>
  </div>
</template>

<script setup lang="ts">
const params = new URLSearchParams({
  id: '985751',
  template: 'carousel',
  trackingCode: 'AF5459655',
  width: '680',
  height: '140',
  tsource: '',
})
const iframeSrc = `https://ads-partners.coupang.com/widgets.html?${params.toString()}`
</script>
