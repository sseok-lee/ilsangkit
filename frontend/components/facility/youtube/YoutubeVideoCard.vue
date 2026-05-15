<template>
  <button
    type="button"
    class="group block w-full text-left rounded-xl overflow-hidden bg-white border border-slate-200 hover:shadow-md transition-shadow"
    @click="$emit('select', video.videoId)"
  >
    <div class="relative aspect-video bg-gray-100">
      <img
        :src="video.thumbnail"
        :alt="video.title"
        loading="lazy"
        decoding="async"
        class="w-full h-full object-cover"
      />
      <span class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
        <span class="material-symbols-outlined text-white text-[40px]">play_circle</span>
      </span>
    </div>
    <div class="p-3">
      <p class="text-sm font-semibold text-slate-900 line-clamp-2">{{ video.title }}</p>
      <p class="mt-1 text-xs text-slate-500 line-clamp-1">{{ video.channelTitle }}</p>
    </div>
  </button>
</template>

<script setup lang="ts">
import type { YoutubeVideo } from '~/types/youtube'

defineProps<{ video: YoutubeVideo }>()
defineEmits<{ (e: 'select', videoId: string): void }>()
</script>
