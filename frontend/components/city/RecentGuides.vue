<template>
  <div v-if="guides.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
    <NuxtLink
      v-for="guide in guides"
      :key="guide.id"
      :to="`/guide/${guide.slug}`"
      class="group bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      <div class="aspect-video bg-slate-100 overflow-hidden">
        <img
          v-if="guide.thumbnailUrl"
          :src="`${publicApiBase}${guide.thumbnailUrl}`"
          :alt="guide.title"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          width="400"
          height="225"
        />
        <div v-else class="w-full h-full flex items-center justify-center">
          <span class="material-symbols-outlined text-[36px] text-slate-300">article</span>
        </div>
      </div>
      <div class="p-3">
        <h3 class="text-sm font-bold text-slate-900 line-clamp-2 group-hover:text-primary transition-colors">
          {{ guide.title }}
        </h3>
        <p class="text-xs text-slate-500 mt-1 line-clamp-1">
          {{ guide.summary }}
        </p>
      </div>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGuides } from '~/composables/useGuides'
import type { GuideSummary } from '~/composables/useGuides'

const config = useRuntimeConfig()
// Image src URLs must use the public base (not loopback) so browsers can load them.
// eslint-disable-next-line no-restricted-syntax
const publicApiBase = config.public.apiBase
const { fetchRecentGuides } = useGuides()

const guides = ref<GuideSummary[]>([])

onMounted(async () => {
  try {
    guides.value = await fetchRecentGuides(4)
  } catch {
    // silently fail
  }
})
</script>
