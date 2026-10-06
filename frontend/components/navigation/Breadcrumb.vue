<template>
  <nav aria-label="Breadcrumb" class="mb-6 overflow-x-auto">
    <ol class="flex flex-nowrap items-center space-x-1 text-sm whitespace-nowrap">
      <li
        v-for="(item, index) in items"
        :key="index"
        class="flex items-center"
        :class="item.current ? 'min-w-0' : 'shrink-0'"
      >
        <!-- Separator -->
        <span
          v-if="index > 0"
          class="mx-1 text-muted"
          aria-hidden="true"
        >
          /
        </span>

        <!-- Link for non-current items -->
        <NuxtLink
          v-if="!item.current"
          :to="item.href"
          class="text-muted hover:text-ink transition-colors"
        >
          {{ item.label }}
        </NuxtLink>

        <!-- Current page (no link) -->
        <span
          v-else
          aria-current="page"
          class="font-semibold text-ink truncate"
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
