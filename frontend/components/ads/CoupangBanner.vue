<template>
  <div class="w-full">
    <a
      :href="promoUrl"
      target="_blank"
      rel="nofollow sponsored noopener"
      referrerpolicy="unsafe-url"
      class="mx-auto block w-full max-w-[360px] overflow-hidden rounded-xl border border-slate-200 transition-shadow hover:shadow-md"
    >
      <!--
        외부 광고 이미지를 빌드 타임에 미리 webp로 변환해 /public/ads 에 정적 호스팅한다.
        Cafe24 운영 서버 CPU가 sharp(0.33+) prebuilt(x86-64-v2)를 미지원 → 런타임 IPX(NuxtImg)가 500.
        그래서 sharp 의존 없는 정적 <img>로 서빙한다. 배너 교체 시 webp 재생성 후 커밋(scripts/optimizeAdImage).
      -->
      <img
        :src="bannerSrc"
        alt="쿠팡 이벤트 배너 - 2026 여름맞이 숙박세일 페스타"
        width="1000"
        height="1000"
        loading="lazy"
        decoding="async"
        class="block h-auto w-full"
      />
    </a>
    <p v-if="disclosure ?? true" class="mt-2 text-center text-[11px] leading-relaxed text-slate-400">
      {{ COUPANG_DISCLOSURE }}
    </p>
  </div>
</template>

<script lang="ts">
// 쿠팡 파트너스 고지문(표시광고법 요건). 상세페이지 등 한 화면에 CoupangBanner가 2개(모바일/데스크톱
// 상호배타 배너) 들어가는 경우, 고지문은 페이지당 1회만 노출하면 되므로 disclosure=false로 끄고
// 별도 위치에 이 상수를 재사용해 단일 <p>를 둔다 (문자열 drift 방지를 위해 컴포넌트 밖에서 export).
// <script setup>은 export를 허용하지 않으므로 일반 <script> 블록에 둔다.
export const COUPANG_DISCLOSURE = '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.'
</script>

<script setup lang="ts">
withDefaults(defineProps<{ disclosure?: boolean }>(), {
  disclosure: true,
})

const promoUrl = 'https://link.coupang.com/a/e9vQESWMTc'
// 원본: 쿠팡 트래블 2026 여름맞이 숙박세일 페스타 배너 (Downloads/coupang.png, 800×800 PNG)
// → scripts/optimizeAdImage.mjs 로 webp 변환해 정적 호스팅 (349KB PNG → ~43KB webp)
const bannerSrc = '/ads/coupang-summer-lodging-festa.webp'
</script>
