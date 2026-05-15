import { ref, readonly } from 'vue'
import type { YoutubeVideo } from '~/types/youtube'

export function useFacilityYoutube() {
  const videos = ref<YoutubeVideo[]>([])
  const loading = ref(false)
  let lastKey = ''
  let inFlight: Promise<void> | null = null

  async function fetchVideos(category: string, id: string): Promise<void> {
    const key = `${category}:${id}`
    if (key === lastKey && inFlight) return inFlight
    lastKey = key

    const config = useRuntimeConfig()
    const apiBase = config.public.apiBase
    loading.value = true

    inFlight = (async () => {
      try {
        const res = await $fetch<{ success: boolean; data: { videos: YoutubeVideo[] } }>(
          `${apiBase}/api/facilities/${category}/${id}/youtube`,
        )
        videos.value = res?.data?.videos ?? []
      } catch {
        videos.value = []
      } finally {
        loading.value = false
      }
    })()

    return inFlight
  }

  return {
    videos: readonly(videos),
    loading: readonly(loading),
    fetchVideos,
  }
}
