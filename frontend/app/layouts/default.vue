<template>
  <div class="min-h-screen flex flex-col">
    <!-- Header -->
    <AppHeader />

    <!-- Main Content Area -->
    <main class="flex-1">
      <NuxtPage />
    </main>

    <!-- Footer -->
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import AppHeader from '~/app/components/common/AppHeader.vue'
import AppFooter from '~/app/components/common/AppFooter.vue'
</script>
