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

    <!-- Footer (Desktop only) -->
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import AppHeader from '~/components/common/AppHeader.vue'
import AppFooter from '~/components/common/AppFooter.vue'
import { useStructuredData } from '~/composables/useStructuredData'

const { setOrganizationSchema } = useStructuredData()
setOrganizationSchema()
</script>
