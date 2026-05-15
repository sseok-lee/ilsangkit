<template>
  <section
    v-if="hasResults || loading"
    ref="rootEl"
    data-testid="yt-section"
    class="mt-8"
  >
    <header class="mb-4 flex items-baseline justify-between">
      <h2 class="text-lg font-bold text-slate-900">관련 영상</h2>
      <p class="text-xs text-slate-500">YouTube 검색 결과 · 자동 수집</p>
    </header>

    <div v-if="loading" class="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div v-for="i in 6" :key="i" class="aspect-video rounded-xl bg-slate-100 animate-pulse" />
    </div>

    <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-3">
      <YoutubeVideoCard
        v-for="v in displayed"
        :key="v.videoId"
        :video="v"
        data-testid="yt-card"
        @select="onSelect"
      />
    </div>

    <YoutubeEmbedModal
      :open="modalOpen"
      :video-id="activeVideoId"
      @close="closeModal"
    />
  </section>
  <section v-else ref="rootEl" data-testid="yt-section-placeholder" class="hidden" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useFacilityYoutube } from '~/composables/useFacilityYoutube'
import type { FacilityCategory } from '~/types/facility'
import YoutubeVideoCard from './YoutubeVideoCard.vue'
import YoutubeEmbedModal from './YoutubeEmbedModal.vue'

const props = defineProps<{ category: FacilityCategory; facilityId: string }>()

const { videos, loading, fetchVideos } = useFacilityYoutube()
const rootEl = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const MIN_RESULTS = 2
const hasResults = computed(() => videos.value.length >= MIN_RESULTS)
const displayed = computed(() => videos.value.slice(0, 6))

const modalOpen = ref(false)
const activeVideoId = ref('')

function onSelect(id: string) {
  activeVideoId.value = id
  modalOpen.value = true
}
function closeModal() {
  modalOpen.value = false
  activeVideoId.value = ''
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') {
    void fetchVideos(props.category, props.facilityId)
    return
  }
  observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      void fetchVideos(props.category, props.facilityId)
      observer?.disconnect()
      observer = null
    }
  }, { rootMargin: '200px' })
  if (rootEl.value) observer.observe(rootEl.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>
