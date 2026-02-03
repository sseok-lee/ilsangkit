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

    <!-- Bottom Navigation (Mobile only) -->
    <BottomNavigation />
  </div>
</template>

<script setup lang="ts">
import AppHeader from '~/components/common/AppHeader.vue'
import AppFooter from '~/components/common/AppFooter.vue'
import BottomNavigation from '~/components/common/BottomNavigation.vue'
</script>
