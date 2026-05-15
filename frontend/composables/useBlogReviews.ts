import { ref, readonly } from 'vue'
import type { NaverBlogPost } from '~/types/naverBlog'

export type BlogReviewKind = 'facility' | 'real-estate'

export function useBlogReviews() {
  const posts = ref<NaverBlogPost[]>([])
  const loading = ref(false)
  let lastKey = ''
  let inFlight: Promise<void> | null = null

  function urlFor(kind: BlogReviewKind, primary: string, secondary: string, apiBase: string): string {
    if (kind === 'facility') {
      return `${apiBase}/api/facilities/${primary}/${secondary}/naver-blog`
    }
    const [city, district, buildingName] = secondary.split('|')
    return `${apiBase}/api/real-estate/${primary}/${encodeURIComponent(city)}/${encodeURIComponent(district)}/${encodeURIComponent(buildingName)}/naver-blog`
  }

  async function fetchPosts(kind: BlogReviewKind, primary: string, secondary: string): Promise<void> {
    const key = `${kind}:${primary}:${secondary}`
    if (key === lastKey && inFlight) return inFlight
    lastKey = key

    const config = useRuntimeConfig()
    const apiBase = config.public.apiBase
    loading.value = true

    inFlight = (async () => {
      try {
        const res = await $fetch<{ success: boolean; data: { posts: NaverBlogPost[] } }>(
          urlFor(kind, primary, secondary, apiBase),
        )
        posts.value = res?.data?.posts ?? []
      } catch {
        posts.value = []
      } finally {
        loading.value = false
      }
    })()

    return inFlight
  }

  return {
    posts: readonly(posts),
    loading: readonly(loading),
    fetchPosts,
  }
}
