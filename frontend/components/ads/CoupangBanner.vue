<template>
  <div class="w-full">
    <a
      :href="promoUrl"
      target="_blank"
      rel="nofollow sponsored noopener"
      referrerpolicy="unsafe-url"
      class="mx-auto block w-full max-w-[360px] overflow-hidden rounded-xl border border-slate-200 transition-shadow hover:shadow-md"
    >
      <img
        :src="bannerSrc"
        alt="쿠팡 이벤트 배너 - 삼성전자 감사 페스티벌"
        width="1000"
        height="1000"
        loading="lazy"
        class="block h-auto w-full"
      />
    </a>
    <p class="mt-2 text-center text-[11px] leading-relaxed text-slate-400">
      이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
    </p>
  </div>
</template>

<script setup lang="ts">
const promoUrl = 'https://link.coupang.com/a/epur2JvKIS'
const bannerSrc =
  'https://image1.coupangcdn.com/image/affiliate/event/promotion/2026/06/08/bd1df149685f00d201079638982d356f.png'
</script>
