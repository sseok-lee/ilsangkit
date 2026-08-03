<template>
  <div
    class="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-white rounded-t-2xl shadow-[0_-4px_16px_rgba(0,0,0,0.12)] transition-[height] duration-200"
    :style="{ height: expanded ? '75vh' : '38vh' }"
  >
    <button
      type="button"
      class="w-full flex items-center justify-center py-2 min-h-[44px]"
      :aria-expanded="expanded"
      aria-label="목록 펼치기"
      @click="expanded = !expanded"
    >
      <span class="block w-10 h-1 rounded-full bg-slate-300" />
    </button>
    <!--
      목록만 담는다. 하단 콘텐츠(유형 카드·설명·출처·AdBanner)를 여기 복제하면
      페이지 본문 렌더와 겹쳐 모바일 DOM 에 h2 2개·AdBanner 2개가 생긴다.
      모바일 사용자는 시트를 접거나(핸들) 페이지를 스크롤해 하단 콘텐츠에 도달한다.
    -->
    <div class="h-[calc(100%-2.75rem)] overflow-y-auto">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const expanded = ref(false)
</script>
