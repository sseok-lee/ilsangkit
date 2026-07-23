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
import { ref, computed, provide } from 'vue'
import AppHeader from '~/components/common/AppHeader.vue'
import AppFooter from '~/components/common/AppFooter.vue'
import TrustLine from '~/components/common/TrustLine.vue'
import { useStructuredData } from '~/composables/useStructuredData'

const route = useRoute()

// DataSourceSection 풀카드가 페이지에 렌더되면 카운트가 오르고, 전역 TrustLine을 숨긴다.
// TrustLine이 <slot/> 뒤에 있어 SSR 렌더 시점에 이미 set 되므로 하이드레이션 불일치 없음.
const sourceCardCount = ref(0)
const hasSourceCard = computed(() => sourceCardCount.value > 0)
provide('sourceCardRegistry', sourceCardCount)

const { setOrganizationSchema } = useStructuredData()
setOrganizationSchema()
</script>
