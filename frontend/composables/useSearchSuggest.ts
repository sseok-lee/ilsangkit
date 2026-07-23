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
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
      if (!Array.isArray(raw)) return []
      // 과거(트림 가드 도입 이전)에 저장된 빈 문자열·공백·비문자열 항목을 걸러낸다.
      // 이것을 걸러내지 않으면 "최근 검색"에 텍스트 없는 유령 행(시계 아이콘만)이 렌더된다.
      // 트림·중복 제거·상한(RECENT_MAX)까지 적용해 addRecent 와 동일한 불변식을 로드 시에도 보장한다.
      const seen = new Set<string>()
      const clean: string[] = []
      for (const x of raw) {
        if (typeof x !== 'string') continue
        const k = x.trim()
        if (!k || seen.has(k)) continue
        seen.add(k)
        clean.push(k)
        if (clean.length >= RECENT_MAX) break
      }
      return clean
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

  function suggest(q: string, scope?: string) {
    if (debounceTimer) clearTimeout(debounceTimer)
    const query = q.trim()
    if (!query) {
      items.value = []
      return
    }
    debounceTimer = setTimeout(async () => {
      try {
        const res = await $fetch<{ success: boolean; data: { items: SuggestItem[] } }>('/api/search/suggest', {
          params: { q: query, ...(scope ? { scope } : {}) },
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
