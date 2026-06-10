import { ref, readonly } from 'vue'

export interface SuggestItem {
  type: 'region' | 'category' | 'building'
  label: string
  sublabel?: string
  city?: string
  district?: string
  category?: string
  buildingName?: string
  bjdCode?: string
  reType?: string
}

const RECENT_KEY = 'ilsangkit:recentSearches'
const SID_KEY = 'ilsangkit:sid'
const RECENT_MAX = 8

export function useSearchSuggest() {
  const items = ref<SuggestItem[]>([])
  const popular = ref<string[]>([])
  const recent = ref<string[]>(loadRecent())
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function loadRecent(): string[] {
    if (typeof localStorage === 'undefined') return []
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    } catch {
      return []
    }
  }

  function persistRecent() {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.value))
  }

  function addRecent(keyword: string) {
    const k = keyword.trim()
    if (!k) return
    recent.value = [k, ...recent.value.filter((x) => x !== k)].slice(0, RECENT_MAX)
    persistRecent()
  }

  function removeRecent(keyword: string) {
    recent.value = recent.value.filter((x) => x !== keyword)
    persistRecent()
  }

  function clearRecent() {
    recent.value = []
    persistRecent()
  }

  function getSessionId(): string {
    if (typeof localStorage === 'undefined') return ''
    let id = localStorage.getItem(SID_KEY)
    if (!id) {
      id = makeSessionId()
      localStorage.setItem(SID_KEY, id)
    }
    return id
  }

  function suggest(q: string) {
    if (debounceTimer) clearTimeout(debounceTimer)
    const query = q.trim()
    if (!query) {
      items.value = []
      return
    }
    debounceTimer = setTimeout(async () => {
      try {
        const res = await $fetch<{ success: boolean; data: { items: SuggestItem[] } }>('/api/search/suggest', {
          params: { q: query },
        })
        items.value = res?.data?.items ?? []
      } catch {
        items.value = []
      }
    }, 200)
  }

  async function loadPopular() {
    try {
      const res = await $fetch<{ success: boolean; data: { items: Array<{ keyword: string }> } }>('/api/search/popular')
      popular.value = (res?.data?.items ?? []).map((x) => x.keyword)
    } catch {
      popular.value = []
    }
  }

  function logSearch(payload: {
    keyword: string
    resultCount: number
    category?: string
    city?: string
    district?: string
  }) {
    if (typeof localStorage === 'undefined') return
    $fetch('/api/search/log', {
      method: 'POST',
      body: { ...payload, sessionId: getSessionId() },
    }).catch(() => undefined)
  }

  return {
    items: readonly(items),
    popular: readonly(popular),
    recent: readonly(recent),
    suggest,
    loadPopular,
    logSearch,
    addRecent,
    removeRecent,
    clearRecent,
    getSessionId,
  }
}

function makeSessionId(): string {
  const c = globalThis.crypto
  if (c?.randomUUID) {
    return c.randomUUID().replace(/-/g, '').slice(0, 32).padEnd(32, '0')
  }
  if (c?.getRandomValues) {
    const bytes = c.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  return `${Date.now()}`.padEnd(32, '0').slice(0, 32)
}
