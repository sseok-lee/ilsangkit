<template>
  <div class="min-h-screen flex flex-col">
    <!-- Header -->
    <AppHeader />

    <!-- Main Content Area -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- Footer (Desktop only) -->
    <AppFooter />

    <!-- Mobile Anchor Ad (sticky bottom) -->
    <AnchorAdBanner />
  </div>
</template>

<script setup lang="ts">
import AppHeader from '~/components/common/AppHeader.vue'
import AppFooter from '~/components/common/AppFooter.vue'
import AnchorAdBanner from '~/components/ads/AnchorAdBanner.vue'
import { useStructuredData } from '~/composables/useStructuredData'

const { setOrganizationSchema } = useStructuredData()
setOrganizationSchema()
</script>
