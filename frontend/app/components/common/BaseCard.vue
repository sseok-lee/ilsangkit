<template>
  <div class="bg-white rounded-lg shadow-md p-6">
    <!-- Header Slot -->
    <div v-if="$slots.header" class="mb-4">
      <slot name="header" />
    </div>

    <!-- Title/Subtitle -->
    <div v-if="title || subtitle" class="mb-4">
      <h3 v-if="title" class="text-xl font-bold text-gray-900 mb-1">
        {{ title }}
      </h3>
      <p v-if="subtitle" class="text-sm text-gray-600">
        {{ subtitle }}
      </p>
    </div>

    <!-- Default Slot -->
    <div>
      <slot />
    </div>

    <!-- Footer Slot -->
    <div v-if="$slots.footer" class="mt-4">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  subtitle?: string
}

defineProps<Props>()
</script>
