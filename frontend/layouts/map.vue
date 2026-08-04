<template>
  <!--
    지도 전용 레이아웃. default 레이아웃과 다른 점은 두 가지다.
    1) 루트가 h-dvh overflow-hidden — 페이지 스크롤이 구조적으로 0이다. h-screen(100vh)이
       아니라 h-dvh 를 쓴다 — iOS Safari/Chrome Android 에서 100vh 는 툴바가 접혔을 때의
       large viewport 라 툴바가 보이는 상태에서 갱신되지 않는다(explorer 내부는 이미 dvh).
    2) TrustLine·AppFooter 를 렌더하지 않는다. 둘이 남으면 지도 아래로 약 410px 의
       스크롤이 생긴다. 푸터는 지도 사이드바 목록 하단으로 옮겼다(설계문서 7).
  -->
  <div class="h-dvh overflow-hidden flex flex-col">
    <!-- 본문 바로가기(스킵 링크): 키보드 포커스 시에만 노출 -->
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-white focus:shadow-lg"
    >본문 바로가기</a>

    <!-- wide: 헤더 폭 제한을 풀어 아래 지도·사이드바와 좌우 경계를 맞춘다 -->
    <AppHeader :wide="true" />

    <!-- min-h-0 이 없으면 내부 오버플로가 부모를 밀어내 overflow-hidden 이 무력해진다 -->
    <main id="main" tabindex="-1" class="flex-1 min-h-0">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import AppHeader from '~/components/common/AppHeader.vue'
import { useStructuredData } from '~/composables/useStructuredData'

// default 레이아웃과 동일하게 Organization 스키마를 심는다.
const { setOrganizationSchema } = useStructuredData()
setOrganizationSchema()
</script>
