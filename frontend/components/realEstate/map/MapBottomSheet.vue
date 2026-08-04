<template>
  <div
    class="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-white rounded-t-2xl shadow-[0_-4px_16px_rgba(0,0,0,0.12)] transition-[top] duration-200"
    :class="expanded ? 'top-[25dvh]' : 'top-[62dvh]'"
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
      목록(MapSidebar)만 담는다. 페이지에 더 이상 본문 스크롤이 없으므로(layouts/map.vue가
      h-dvh overflow-hidden) 하단 콘텐츠는 이 시트 안에만 존재한다 — 페이지를 스크롤해
      도달하는 별도의 하단 영역은 없다. 푸터(공공누리·저작권 고지 포함)는 MapSidebar가
      show-footer 로 목록 맨 아래에 렌더한다: 모바일 사용자는 이 시트 내부를 스크롤해
      목록을 다 내려가면 푸터에 닿는다.

      h-[calc(...)] 대신 top/bottom 인셋을 쓴다: 이 div도 슬롯 안 광고(AdBanner)의 DOM
      조상이라 AdSense 스크립트가 여기에도 height:auto!important 를 주입할 수 있다.
      퍼센트/calc 높이는 그 즉시 무력화되지만, top+bottom 인셋은 부모(fixed 시트)와
      동일한 원리로 height 값과 무관하게 박스를 확정한다.
    -->
    <div class="absolute inset-x-0 top-11 bottom-0 overflow-y-auto">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const expanded = ref(false)
</script>
