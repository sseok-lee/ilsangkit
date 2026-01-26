<template>
  <div class="min-h-screen flex flex-col">
    <header class="h-16 border-b border-gray-200">
      <div class="container h-full flex items-center justify-between">
        <NuxtLink to="/" class="text-xl font-bold text-primary-600">
          일상킷
        </NuxtLink>
        <nav class="flex gap-4">
          <NuxtLink to="/" class="text-gray-700 hover:text-primary-600 transition-colors">
            홈
          </NuxtLink>
        </nav>
      </div>
    </header>

    <main class="flex-1">
      <NuxtPage />
    </main>

    <footer class="py-8 bg-gray-50 border-t border-gray-200">
      <div class="container text-center text-sm text-gray-600">
        <p>&copy; 2024 일상킷. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
// App-level setup
</script>

<style>
/* Global styles are in assets/css/main.css */
</style>
