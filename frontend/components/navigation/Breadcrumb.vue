<template>
  <nav aria-label="Breadcrumb" class="mb-6">
    <ol class="flex items-center space-x-2 text-sm">
      <li
        v-for="(item, index) in items"
        :key="index"
        class="flex items-center"
      >
        <!-- Separator -->
        <span
          v-if="index > 0"
          class="mx-2 text-gray-400"
          aria-hidden="true"
        >
          /
        </span>

        <!-- Link for non-current items -->
        <NuxtLink
          v-if="!item.current"
          :to="item.href"
          class="text-gray-600 hover:text-gray-900 transition-colors"
        >
          {{ item.label }}
        </NuxtLink>

        <!-- Current page (no link) -->
        <span
          v-else
          aria-current="page"
          class="font-semibold text-gray-900"
        >
          {{ item.label }}
        </span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
interface BreadcrumbItem {
  label: string;
  href: string;
  current: boolean;
}

defineProps<{
  items: BreadcrumbItem[];
}>();
</script>
