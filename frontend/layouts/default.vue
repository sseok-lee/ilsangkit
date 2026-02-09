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
  </div>
</template>

<script setup lang="ts">
import AppHeader from '~/components/common/AppHeader.vue'
import AppFooter from '~/components/common/AppFooter.vue'
import { useStructuredData } from '~/composables/useStructuredData'

const { setOrganizationSchema } = useStructuredData()
setOrganizationSchema()
</script>
