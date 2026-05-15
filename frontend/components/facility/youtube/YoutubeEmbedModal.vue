<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        data-testid="yt-modal-backdrop"
        class="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4"
        @click.self="$emit('close')"
        @keydown.esc="$emit('close')"
      >
        <div class="relative w-full max-w-3xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
          <button
            data-testid="yt-modal-close"
            type="button"
            class="absolute -top-12 right-0 size-10 flex items-center justify-center rounded-full bg-white/90 text-slate-900 shadow"
            aria-label="닫기"
            @click="$emit('close')"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
          <iframe
            :src="`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`"
            class="w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowfullscreen
            referrerpolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{ open: boolean; videoId: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()

function handleKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}

onMounted(() => { if (import.meta.client) window.addEventListener('keydown', handleKey) })
onUnmounted(() => { if (import.meta.client) window.removeEventListener('keydown', handleKey) })

watch(() => props.open, (v) => {
  if (!import.meta.client) return
  document.body.style.overflow = v ? 'hidden' : ''
})
</script>
