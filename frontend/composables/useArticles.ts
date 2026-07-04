export type ArticleType = 'news' | 'howto' | 'listicle' | 'guide' | string

export interface ArticleSummary {
  id: string
  title: string
  slug: string
  summary: string
  category: string
  articleType: ArticleType
  thumbnailUrl: string | null
  keywords: string | null
  viewCount: number
  publishedAt: string | null
  createdAt: string
}

export interface ArticleDetail extends ArticleSummary {
  content: string
  sources: Array<{ title: string; url: string }> | null
  updatedAt: string
}

interface PaginatedArticles {
  items: ArticleSummary[]
  total: number
  page: number
  totalPages: number
}

export function useArticles() {
  const apiBase = useApiBase()

  async function fetchArticles(params: {
    page?: number
    limit?: number
    category?: string
    categories?: string[]
  } = {}): Promise<PaginatedArticles> {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.categories?.length) query.set('categories', params.categories.join(','))
    else if (params.category) query.set('category', params.category)

    const qs = query.toString()
    const url = `${apiBase}/api/articles${qs ? `?${qs}` : ''}`
    const res = await $fetch<{ success: boolean; data: PaginatedArticles }>(url)
    return res.data
  }

  async function fetchRecentArticles(limit = 4): Promise<ArticleSummary[]> {
    const res = await $fetch<{ success: boolean; data: ArticleSummary[] }>(
      `${apiBase}/api/articles/recent?limit=${limit}`
    )
    return res.data
  }

  async function fetchArticleBySlug(slug: string): Promise<ArticleDetail> {
    const res = await $fetch<{ success: boolean; data: ArticleDetail }>(
      `${apiBase}/api/articles/${slug}`
    )
    return res.data
  }

  return {
    fetchArticles,
    fetchRecentArticles,
    fetchArticleBySlug,
  }
}
