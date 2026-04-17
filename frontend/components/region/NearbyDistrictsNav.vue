<template>
  <nav
    v-if="districts.length > 0"
    class="bg-white rounded-xl p-4 shadow-sm border border-slate-200"
    :aria-label="`주변 지역 ${categoryLabel}`"
  >
    <h2 class="text-slate-900 text-base font-bold mb-3">
      주변 지역 {{ categoryLabel }}
    </h2>
    <ul class="flex flex-wrap gap-2">
      <li v-for="d in districts" :key="d.slug">
        <NuxtLink
          :to="`/${citySlug}/${d.slug}/${category}`"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-700 hover:border-primary/40 hover:text-primary transition-colors"
        >
          <span class="font-medium">{{ d.district }}</span>
          <span class="text-xs text-slate-500">{{ d.count.toLocaleString() }}곳</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
interface District {
  slug: string
  district: string
  count: number
}

interface Props {
  citySlug: string
  category: string
  categoryLabel: string
  districts: District[]
}

defineProps<Props>()
</script>
