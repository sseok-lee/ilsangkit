export type AdminArticleStatus = 'draft' | 'published' | 'rejected'

export interface AdminArticleSummary {
  id: string
  title: string
  slug: string
  summary: string
  category: string
  articleType: string
  thumbnailUrl: string | null
  keywords: string | null
  status: AdminArticleStatus
  publishedAt: string | null
  createdAt: string
  viewCount: number
  updatedAt: string
}

export interface AdminArticleDetail extends AdminArticleSummary {
  content: string
  sources: Array<{ title: string; url: string }> | null
}

interface PaginatedAdminArticles {
  items: AdminArticleSummary[]
  total: number
  page: number
  totalPages: number
}

export interface AdminArticlePatch {
  title?: string
  summary?: string
  keywords?: string | null
  content?: string
}

export interface AdminGenerateBody {
  count?: number
  category?: string
  track?: 'news' | 'policy'
}

export function useAdminArticles() {
  const apiBase = useApiBase()

  async function list(params: {
    status?: AdminArticleStatus
    category?: string
    page?: number
    limit?: number
  } = {}): Promise<PaginatedAdminArticles> {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    if (params.category) query.set('category', params.category)
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))

    const qs = query.toString()
    const url = `${apiBase}/api/admin/articles${qs ? `?${qs}` : ''}`
    const res = await $fetch<{ success: boolean; data: PaginatedAdminArticles }>(url, { credentials: 'include' })
    return res.data
  }

  async function get(id: string): Promise<AdminArticleDetail> {
    const res = await $fetch<{ success: boolean; data: AdminArticleDetail }>(
      `${apiBase}/api/admin/articles/${id}`,
      { credentials: 'include' }
    )
    return res.data
  }

  async function update(id: string, patch: AdminArticlePatch): Promise<AdminArticleDetail> {
    const res = await $fetch<{ success: boolean; data: AdminArticleDetail }>(
      `${apiBase}/api/admin/articles/${id}`,
      { method: 'PATCH', body: patch, credentials: 'include' }
    )
    return res.data
  }

  async function publish(id: string): Promise<AdminArticleDetail> {
    const res = await $fetch<{ success: boolean; data: AdminArticleDetail }>(
      `${apiBase}/api/admin/articles/${id}/publish`,
      { method: 'POST', credentials: 'include' }
    )
    return res.data
  }

  async function unpublish(id: string): Promise<AdminArticleDetail> {
    const res = await $fetch<{ success: boolean; data: AdminArticleDetail }>(
      `${apiBase}/api/admin/articles/${id}/unpublish`,
      { method: 'POST', credentials: 'include' }
    )
    return res.data
  }

  async function reject(id: string): Promise<AdminArticleDetail> {
    const res = await $fetch<{ success: boolean; data: AdminArticleDetail }>(
      `${apiBase}/api/admin/articles/${id}/reject`,
      { method: 'POST', credentials: 'include' }
    )
    return res.data
  }

  async function remove(id: string): Promise<{ deleted: boolean }> {
    const res = await $fetch<{ success: boolean; data: { deleted: boolean } }>(
      `${apiBase}/api/admin/articles/${id}`,
      { method: 'DELETE', credentials: 'include' }
    )
    return res.data
  }

  async function generate(body: AdminGenerateBody = {}): Promise<{ started: boolean; count: number; category: string | null }> {
    const res = await $fetch<{ success: boolean; data: { started: boolean; count: number; category: string | null } }>(
      `${apiBase}/api/admin/articles/generate`,
      { method: 'POST', body, credentials: 'include' }
    )
    return res.data
  }

  async function regenerate(id: string): Promise<{ started: boolean; count: number; category: string | null }> {
    const res = await $fetch<{ success: boolean; data: { started: boolean; count: number; category: string | null } }>(
      `${apiBase}/api/admin/articles/${id}/regenerate`,
      { method: 'POST', credentials: 'include' }
    )
    return res.data
  }

  return {
    list,
    get,
    update,
    publish,
    unpublish,
    reject,
    remove,
    generate,
    regenerate,
  }
}
