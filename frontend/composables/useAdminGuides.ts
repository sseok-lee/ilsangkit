export type AdminGuideStatus = 'draft' | 'published'

interface RawGuide {
  id: string
  title: string
  slug: string
  summary: string
  category: string
  articleType: string
  thumbnailUrl: string | null
  keywords: string | null
  published: boolean
  publishedAt: string | null
  viewCount: number
  createdAt: string
  updatedAt: string
  content?: string
}

export interface AdminGuideSummary {
  id: string
  title: string
  slug: string
  summary: string
  category: string
  articleType: string
  thumbnailUrl: string | null
  keywords: string | null
  published: boolean
  status: AdminGuideStatus
  publishedAt: string | null
  viewCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminGuideDetail extends AdminGuideSummary {
  content: string
}

interface PaginatedAdminGuides {
  items: AdminGuideSummary[]
  total: number
  page: number
  totalPages: number
}

export interface AdminGuidePatch {
  title?: string
  summary?: string
  keywords?: string | null
  content?: string
}

function toSummary(g: RawGuide): AdminGuideSummary {
  return {
    id: g.id,
    title: g.title,
    slug: g.slug,
    summary: g.summary,
    category: g.category,
    articleType: g.articleType,
    thumbnailUrl: g.thumbnailUrl,
    keywords: g.keywords,
    published: g.published,
    status: g.published ? 'published' : 'draft',
    publishedAt: g.publishedAt,
    viewCount: g.viewCount,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  }
}

function toDetail(g: RawGuide): AdminGuideDetail {
  return { ...toSummary(g), content: g.content ?? '' }
}

export function useAdminGuides() {
  const apiBase = useApiBase()

  async function list(params: {
    status?: AdminGuideStatus
    category?: string
    page?: number
    limit?: number
  } = {}): Promise<PaginatedAdminGuides> {
    const query = new URLSearchParams()
    if (params.status) query.set('published', params.status === 'published' ? 'true' : 'false')
    if (params.category) query.set('category', params.category)
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))

    const qs = query.toString()
    const url = `${apiBase}/api/admin/guides${qs ? `?${qs}` : ''}`
    const res = await $fetch<{ success: boolean; data: { items: RawGuide[]; total: number; page: number; totalPages: number } }>(
      url,
      { credentials: 'include' }
    )
    return { ...res.data, items: res.data.items.map(toSummary) }
  }

  async function get(id: string): Promise<AdminGuideDetail> {
    const res = await $fetch<{ success: boolean; data: RawGuide }>(
      `${apiBase}/api/admin/guides/${id}`,
      { credentials: 'include' }
    )
    return toDetail(res.data)
  }

  async function update(id: string, patch: AdminGuidePatch): Promise<AdminGuideDetail> {
    const res = await $fetch<{ success: boolean; data: RawGuide }>(
      `${apiBase}/api/admin/guides/${id}`,
      { method: 'PATCH', body: patch, credentials: 'include' }
    )
    return toDetail(res.data)
  }

  async function publish(id: string): Promise<AdminGuideDetail> {
    const res = await $fetch<{ success: boolean; data: RawGuide }>(
      `${apiBase}/api/admin/guides/${id}/publish`,
      { method: 'POST', credentials: 'include' }
    )
    return toDetail(res.data)
  }

  async function unpublish(id: string): Promise<AdminGuideDetail> {
    const res = await $fetch<{ success: boolean; data: RawGuide }>(
      `${apiBase}/api/admin/guides/${id}/unpublish`,
      { method: 'POST', credentials: 'include' }
    )
    return toDetail(res.data)
  }

  async function reject(id: string): Promise<{ deleted: boolean }> {
    const res = await $fetch<{ success: boolean; data: { deleted: boolean } }>(
      `${apiBase}/api/admin/guides/${id}/reject`,
      { method: 'POST', credentials: 'include' }
    )
    return res.data
  }

  async function remove(id: string): Promise<{ deleted: boolean }> {
    const res = await $fetch<{ success: boolean; data: { deleted: boolean } }>(
      `${apiBase}/api/admin/guides/${id}`,
      { method: 'DELETE', credentials: 'include' }
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
  }
}
