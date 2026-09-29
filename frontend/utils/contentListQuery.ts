export const CONTENT_TOPICS = [
  { key: '', label: '전체' },
  { key: 'real-estate', label: '부동산', categories: ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent'] },
  { key: 'subscription', label: '청약', categories: ['subscription', 'sale', 'rent'] },
  { key: 'health', label: '병원·약국', categories: ['hospital', 'pharmacy', 'aed'] },
  { key: 'parking', label: '주차·충전', categories: ['parking', 'ev-charger'] },
  { key: 'env', label: '쓰레기배출', categories: ['trash', 'clothes'] },
] as const

export type ContentTopic = typeof CONTENT_TOPICS[number]['key']
export interface ContentListFilters { topic: ContentTopic; page: number }

function firstValue(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' || typeof first === 'number' ? String(first).trim() : ''
}

export function normalizeContentListQuery(query: Record<string, unknown>): ContentListFilters {
  const topic = CONTENT_TOPICS.find(item => item.key === firstValue(query.topic))?.key ?? ''
  const rawPage = firstValue(query.page)
  const page = /^\d+$/.test(rawPage) ? Number(rawPage) : 1
  return { topic, page: Number.isSafeInteger(page) && page > 0 ? page : 1 }
}

export function contentListQuery(filters: ContentListFilters): Record<string, string> {
  const { topic, page } = normalizeContentListQuery({ ...filters })
  return { ...(topic ? { topic } : {}), ...(page > 1 ? { page: String(page) } : {}) }
}

export function contentListRequest(filters: ContentListFilters): { page: number; limit: 12; categories?: string[] } {
  const normalized = normalizeContentListQuery({ ...filters })
  const topic = CONTENT_TOPICS.find(item => item.key === normalized.topic)
  return {
    page: normalized.page,
    limit: 12,
    ...(topic && 'categories' in topic ? { categories: [...topic.categories] } : {}),
  }
}

export function contentListHref(kind: 'guide' | 'article', filters: ContentListFilters): string {
  const query = new URLSearchParams(contentListQuery(filters)).toString()
  return `/${kind}${query ? `?${query}` : ''}`
}
