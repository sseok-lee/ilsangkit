<template>
  <div class="min-h-screen flex flex-col">
    <!-- 본문 바로가기(스킵 링크): 키보드 포커스 시에만 노출 -->
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-white focus:shadow-lg"
    >본문 바로가기</a>

    <!-- Header -->
    <AppHeader />

    <!-- Main Content Area -->
    <main id="main" tabindex="-1" class="flex-1">
      <slot />
    </main>

    <!-- 데이터 출처 카드(DataSourceSection 풀카드)가 있는 페이지에선 전역 TrustLine 억제(출처 정보 중복 방지) -->
    <TrustLine v-if="route.path !== '/' && !hasSourceCard" />
    <!-- Footer (Desktop only) -->
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppHeader from '~/components/common/AppHeader.vue'
import AppFooter from '~/components/common/AppFooter.vue'
import TrustLine from '~/components/common/TrustLine.vue'
import { useStructuredData } from '~/composables/useStructuredData'

const route = useRoute()

// 페이지가 자체 데이터 출처 카드를 렌더하는지는 route.meta 로 판정한다.
//
// ⚠️ 예전엔 provide/inject 카운터로 DataSourceSection 이 스스로 등록하게 했는데,
//    페이지 setup 이 async(`await useAsyncData`)면 Suspense 가 자식 렌더를 미루는 사이
//    레이아웃 ssrRender 가 아래 v-if 를 먼저 평가해 버려 SSR 에선 억제가 안 됐다.
//    (동기 setup 페이지에서만 우연히 동작 — 26개 중 24개가 async 라 사실상 전부 깨져 있었다)
//    그 결과 비렌더 크롤러가 보는 raw HTML 에 출처 안내가 중복 노출됐다. 이슈 #766.
//
//    route.meta 는 렌더 이전에 확정되므로 SSR/CSR 모두 같은 결과가 나온다.
//    meta 선언 누락은 tests/layouts/trustLineSourceCardMeta.test.ts 가 CI 에서 잡는다.
const hasSourceCard = computed(() => route.meta.hasSourceCard === true)

const { setOrganizationSchema } = useStructuredData()
setOrganizationSchema()
</script>
