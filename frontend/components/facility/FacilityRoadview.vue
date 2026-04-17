<template>
  <ClientOnly>
    <div class="relative w-full h-[200px] md:h-[240px] rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
      <!-- Loading -->
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>

      <!-- Unavailable -->
      <div v-else-if="!available" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-500">
        <span class="material-symbols-outlined text-[36px] mb-2">visibility_off</span>
        <p class="text-sm font-medium">이 위치의 로드뷰를 지원하지 않습니다</p>
      </div>

      <!-- Roadview container -->
      <div ref="roadviewContainer" class="w-full h-full" :class="{ 'invisible': loading || !available }"></div>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { useKakaoMap } from '~/composables/useKakaoMap'

const props = defineProps<{
  lat: number
  lng: number
}>()

const { initRoadview } = useKakaoMap()

const roadviewContainer = ref<HTMLElement | null>(null)
const loading = ref(true)
const available = ref(false)

// <ClientOnly> delays rendering, so ref is null in onMounted.
// Use watch to detect when the container becomes available.
const stopWatch = watch(roadviewContainer, async (container) => {
  if (!container) return
  stopWatch()

  const timeout = setTimeout(() => {
    if (loading.value) {
      available.value = false
      loading.value = false
    }
  }, 8000)

  try {
    await initRoadview(container, props.lat, props.lng, (isAvailable) => {
      clearTimeout(timeout)
      available.value = isAvailable
      loading.value = false
    })
  } catch {
    clearTimeout(timeout)
    available.value = false
    loading.value = false
  }
})
</script>
