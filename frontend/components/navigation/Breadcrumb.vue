<template>
  <nav aria-label="Breadcrumb" class="mb-6 overflow-x-auto">
    <ol class="flex flex-nowrap items-center space-x-1 text-sm whitespace-nowrap">
      <li
        v-for="(item, index) in items"
        :key="index"
        class="flex items-center shrink-0"
      >
        <!-- Separator -->
        <span
          v-if="index > 0"
          class="mx-1 text-slate-500"
          aria-hidden="true"
        >
          /
        </span>

        <!-- Link for non-current items -->
        <NuxtLink
          v-if="!item.current"
          :to="item.href"
          class="text-slate-600 hover:text-slate-900 transition-colors"
        >
          {{ item.label }}
        </NuxtLink>

        <!-- Current page (no link) -->
        <span
          v-else
          aria-current="page"
          class="font-semibold text-slate-900"
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
