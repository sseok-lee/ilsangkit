<template>
  <NuxtLoadingIndicator />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from '~/utils/seoConstants'

// App-level setup
useHead({
  titleTemplate: (title) => title || `${SITE_NAME} - ${SITE_TAGLINE}`,
  meta: [
    { name: 'description', content: SITE_DESCRIPTION }
  ]
})
</script>

<style>
/* Global styles are in assets/css/main.css */
</style>
