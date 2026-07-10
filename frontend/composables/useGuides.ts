export type GuideArticleType = 'news' | 'howto' | 'listicle' | 'guide'

export interface GuideSummary {
  id: string
  title: string
  slug: string
  summary: string
  category: string
  articleType: GuideArticleType
  thumbnailUrl: string | null
  keywords: string | null
  viewCount: number
  publishedAt: string | null
  createdAt: string
}

export interface GuideDetail extends GuideSummary {
  content: string
  published: boolean
  updatedAt: string
}

interface PaginatedGuides {
  items: GuideSummary[]
  total: number
  page: number
  totalPages: number
}

export function useGuides() {
  const apiBase = useApiBase()

  async function fetchGuides(params: {
    page?: number
    limit?: number
    category?: string
    categories?: string[]
  } = {}): Promise<PaginatedGuides> {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.categories?.length) query.set('categories', params.categories.join(','))
    else if (params.category) query.set('category', params.category)

    const qs = query.toString()
    const url = `${apiBase}/api/guides${qs ? `?${qs}` : ''}`
    const res = await $fetch<{ success: boolean; data: PaginatedGuides }>(url)
    return res.data
  }

  async function fetchRecentGuides(limit = 4): Promise<GuideSummary[]> {
    const res = await $fetch<{ success: boolean; data: GuideSummary[] }>(
      `${apiBase}/api/guides/recent?limit=${limit}`
    )
    return res.data
  }

  async function fetchGuideBySlug(slug: string): Promise<GuideDetail> {
    const res = await $fetch<{ success: boolean; data: GuideDetail }>(
      `${apiBase}/api/guides/${slug}`
    )
    return res.data
  }

  return {
    fetchGuides,
    fetchRecentGuides,
    fetchGuideBySlug,
  }
}
