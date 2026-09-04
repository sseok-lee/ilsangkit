import { isValidBuildingName } from '../../utils/realEstateBuildingName'
// 고아 시설 id → 현행 id 301 매핑(7,535건, 370KB JSON)을 판정 규칙째로 재사용한다.
// 미들웨어가 이미 모듈 스코프에서 한 번 로드하므로 ESM 모듈 캐시를 공유해 추가 파싱이 없다.
// 규칙을 여기서 다시 구현하면 미들웨어와 어긋나는 순간 사이트맵이 301 URL 을 다시 흘린다.
import { resolveFacilityRedirect } from '../middleware/facility-redirect'
import { ssrFetch } from './ssrFetch'
import { rejectSitemapLoc, SITEMAP_LOC_ORIGIN, type SitemapLocRejectReason } from './sitemapPolicy'
import { escapeXml } from './xml'

export const SITE_URL = 'https://ilsangkit.co.kr'

export const MAX_URLS_PER_SITEMAP = 10_000

/**
 * changefreq / priority 는 의도적으로 없다.
 * Google 공식 문서: "Google ignores <priority> and <changefreq> values."
 * 크롤·색인에 아무 영향이 없으면서 URL 당 2줄씩 바이트만 차지하므로 방출하지 않는다.
 */
export interface SitemapUrl {
  loc: string
  lastmod?: string
  image?: {
    loc: string
    title?: string
    caption?: string
  }
}

interface SitemapIndexEntry {
  loc: string
  lastmod?: string
}

/** 게이트가 걸러낸 사유. sitemapPolicy 가 판정하지 못하는 두 가지를 덧붙인다. */
export type SitemapDropReason = SitemapLocRejectReason | 'facility-301' | 'duplicate'

/**
 * `<loc>` 로 내보내면 안 되는 URL 이면 사유를, 문제없으면 null 을 반환한다.
 *
 * 문자열 규칙(쿼리·빈 세그먼트·미인코딩 한글·og 엔드포인트·폐지 city slug)은 sitemapPolicy 가,
 * 데이터 기반 판정(고아 시설 301 매핑)은 facility-redirect 미들웨어가 맡는다.
 * 백엔드 왕복은 없다 — 66만 URL × 1 쿼리는 사이트맵 생성 자체를 죽인다.
 */
export function sitemapLocDropReason(loc: string): SitemapDropReason | null {
  const policyReason = rejectSitemapLoc(loc)
  if (policyReason) return policyReason
  // rejectSitemapLoc 이 origin 일치를 이미 보장하므로 slice 결과는 항상 '/...' 또는 ''.
  if (resolveFacilityRedirect(loc.slice(SITEMAP_LOC_ORIGIN.length))) return 'facility-301'
  return null
}

export interface SitemapFilterResult {
  urls: SitemapUrl[]
  /** 통째로 버려진 항목 수 */
  dropped: number
  /** 항목은 살리고 image:image 블록만 뗀 수 */
  imagesStripped: number
  reasons: Partial<Record<SitemapDropReason, number>>
  /** 로그용 표본 (최대 5건) */
  samples: string[]
}

/**
 * 사이트맵 방출 직전 하드 게이트.
 *
 * 조용히 쿼리를 떼거나 슬래시를 고치지 않고 **항목 자체를 버린다** — 쿼리 URL 을 만들어낸
 * 호출부는 버그가 있다는 뜻이고, 문자열만 손봐 살려두면 그 버그가 다음 배포까지 숨는다.
 * 버린 건수와 사유는 로그로 남겨 회귀를 눈에 보이게 한다.
 */
export function filterSitemapUrls(urls: SitemapUrl[]): SitemapFilterResult {
  const kept: SitemapUrl[] = []
  const reasons: Partial<Record<SitemapDropReason, number>> = {}
  const samples: string[] = []
  const seen = new Set<string>()
  let imagesStripped = 0

  for (const url of urls) {
    const reason = seen.has(url.loc) ? 'duplicate' : sitemapLocDropReason(url.loc)
    if (reason) {
      reasons[reason] = (reasons[reason] ?? 0) + 1
      if (samples.length < 5) samples.push(`${reason}: ${url.loc}`)
      continue
    }
    seen.add(url.loc)

    // image:loc 도 크롤러가 따라가는 URL 이다. 부적격이면 항목은 살리고 이미지만 뗀다
    // — 페이지 자체는 정상인데 이미지 하나 때문에 URL 을 잃을 이유가 없다.
    if (url.image && sitemapLocDropReason(url.image.loc)) {
      imagesStripped++
      kept.push({ loc: url.loc, ...(url.lastmod ? { lastmod: url.lastmod } : {}) })
      continue
    }
    kept.push(url)
  }

  return { urls: kept, dropped: urls.length - kept.length, imagesStripped, reasons, samples }
}

export function generateSitemapXml(rawUrls: SitemapUrl[]): string {
  const filtered = filterSitemapUrls(rawUrls)
  if (filtered.dropped > 0 || filtered.imagesStripped > 0) {
    console.warn(
      `[sitemap] loc 제외 ${filtered.dropped}/${rawUrls.length}, image 제거 ${filtered.imagesStripped}`,
      filtered.reasons,
      filtered.samples,
    )
  }
  const urls = filtered.urls
  const hasImages = urls.some((url) => url.image !== undefined)
  const imageNs = hasImages
    ? ` xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`
    : ''

  const urlElements = urls
    .map((url) => {
      const parts = [`    <loc>${escapeXml(url.loc)}</loc>`]
      if (url.lastmod) parts.push(`    <lastmod>${url.lastmod}</lastmod>`)
      if (url.image) {
        const imgParts = [`      <image:loc>${escapeXml(url.image.loc)}</image:loc>`]
        if (url.image.title) imgParts.push(`      <image:title>${escapeXml(url.image.title)}</image:title>`)
        if (url.image.caption) imgParts.push(`      <image:caption>${escapeXml(url.image.caption)}</image:caption>`)
        parts.push(`    <image:image>\n${imgParts.join('\n')}\n    </image:image>`)
      }
      return `  <url>\n${parts.join('\n')}\n  </url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNs}>
${urlElements}
</urlset>`
}

export function generateSitemapIndexXml(sitemaps: SitemapIndexEntry[]): string {
  // 인덱스도 같은 게이트를 통과해야 한다 — 여기서 새는 순간 크롤러는 자식 사이트맵 URL 을
  // 통째로 잃거나(오탈자) 쿼리 URL 을 크롤한다. 자식 loc 은 고아 시설 매핑과 무관하므로
  // 문자열 규칙만 본다.
  const entries = sitemaps
    .filter((s) => {
      const reason = rejectSitemapLoc(s.loc)
      if (reason) console.warn(`[sitemap] index loc 제외(${reason}): ${s.loc}`)
      return !reason
    })
    .map((s) => {
      const parts = [`    <loc>${escapeXml(s.loc)}</loc>`]
      if (s.lastmod) parts.push(`    <lastmod>${s.lastmod}</lastmod>`)
      return `  <sitemap>\n${parts.join('\n')}\n  </sitemap>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`
}

// KST(Asia/Seoul) 기준 YYYY-MM-DD 변환.
// DB는 UTC 저장이라 toISOString()을 그대로 split 하면 KST 새벽 시간대(00:00~08:59)는
// 어제 날짜로 표시되는 문제가 있어 KST로 변환 후 추출한다.
export function formatDateForSitemap(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

// 캐시: 카테고리별 ID 목록을 10분간 메모리에 보관
const cache = new Map<string, { data: unknown[]; expires: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10분

/** 청크마다 total 을 다시 받지 않도록 보관. 캐시 엔트리와 수명을 같이 한다. */
let realEstateTotalCache: number | null = null

/**
 * 사이트맵 집계 API 호출 예산.
 *
 * 사용자 요청이 아니라 배치(생성 스크립트)·크롤러 대면 폴백 경로다. 아무도 인터랙티브하게
 * 기다리지 않으므로 사용자 요청용 예산(ssrFetch 기본 5초)을 그대로 쓸 이유가 없다.
 *
 * 종전 25초는 가장 무거운 /api/sitemap/real-estate-buildings 실측(25.0초)과 사실상 동일해
 * 부하가 조금만 얹혀도 AbortError 가 났다. ssrFetch 의 isRetriable 은 AbortError 를 재시도
 * 대상에서 제외하므로, 한 번 타임아웃되면 상위 재시도까지 전부 같은 벽에 부딪힌다.
 * (2026-07-22~27 사이트맵 5일 정지 사고)
 *
 * 이 쿼리는 거래 테이블 약 660만 행을 훑으므로 데이터가 쌓일수록 느려진다 — 여유를 둔다.
 *
 * 60초 → 120초 상향 근거(프로덕션 실측): 콜드 쿼리는 가장 큰 블록(AptRent 3.1M행)만
 * 24.7초이고 6블록 UNION ALL 전체가 약 50~55초다. 60초는 여유가 10초도 안 된다.
 * 평상시에는 배포 워밍업이 backend 캐시를 선점하므로 이 예산까지 오지 않지만
 * (deploy.yml 의 "backend 집계 캐시 선점"), 워밍이 실패했을 때의 안전판으로 둔다.
 */
export const SITEMAP_FETCH_TIMEOUT_MS = 120_000

function getCached<T>(key: string): T[] | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    cache.delete(key)
    return null
  }
  return entry.data as T[]
}

function setCache(key: string, data: unknown[]): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL })
}

export async function fetchFacilityIds(
  category: string,
  limit?: number
): Promise<{ id: string; updatedAt: string }[]> {
  const cacheKey = `facility:${category}${limit !== undefined ? `:limit${limit}` : ''}`
  const cached = getCached<{ id: string; updatedAt: string }>(cacheKey)
  if (cached) return cached

  const path = limit !== undefined
    ? `/api/sitemap/facilities/${category}?limit=${limit}`
    : `/api/sitemap/facilities/${category}`

  try {
    const json = await ssrFetch<{ data?: { id: string; updatedAt: string }[] }>(path, {
      timeoutMs: SITEMAP_FETCH_TIMEOUT_MS,
    })
    const data = json.data ?? []
    if (data.length > 0) setCache(cacheKey, data)
    return data
  } catch (err) {
    console.error(`[sitemap] fetchFacilityIds(${category}) failed`, err)
    return []
  }
}

export interface SitemapWasteRegion {
  city: string
  district: string
  updatedAt: string
}

// 쓰레기 배출 구·군 집계 지역 목록. 개별 /trash/[id] 대신 집계 URL 사이트맵 생성에 사용.
// 응답 형태: { success, data: { regions: [{ city, district, updatedAt }] } }
export async function fetchWasteScheduleRegions(): Promise<SitemapWasteRegion[]> {
  const cacheKey = 'waste-schedule-regions'
  const cached = getCached<SitemapWasteRegion>(cacheKey)
  if (cached) return cached

  try {
    const json = await ssrFetch<{ data?: { regions?: SitemapWasteRegion[] } }>(
      '/api/sitemap/waste-schedule-regions',
      { timeoutMs: SITEMAP_FETCH_TIMEOUT_MS },
    )
    const data = json.data?.regions ?? []
    if (data.length > 0) setCache(cacheKey, data)
    return data
  } catch (err) {
    console.error('[sitemap] fetchWasteScheduleRegions failed', err)
    return []
  }
}

export interface SitemapRealEstateBuilding {
  realEstateType: 'apt-sale' | 'apt-rent' | 'villa-sale' | 'villa-rent' | 'offitel-sale' | 'offitel-rent'
  city: string
  district: string
  buildingName: string
  bjdCode: string
  // 건물별 가장 최근 실거래월('YYYY-MM-DD'). 백엔드 미배포 시점 대비 optional — 없으면 weekStart 폴백.
  lastmod?: string
}

export interface RealEstateBuildingsPage {
  items: SitemapRealEstateBuilding[]
  total: number
}

/**
 * 부동산 건물을 사이트맵 청크 단위로 가져온다.
 *
 * 종전에는 356,461행(50.8MB)을 통째로 받아 프론트에서 slice 했다. 그 한 번의 응답이
 * 백엔드 메모리를 197MB → 679MB 로 밀어올려(+275MB) PM2 max_memory_restart(500MB)를
 * 넘겼고, 사이트맵 생성 중 백엔드가 재시작되면서 자식 fetch 가 끊겨 파일이 이월됐다.
 *
 * total 은 청크 수 계산용이며 서버가 함께 돌려준다.
 */
export async function fetchRealEstateBuildings(page = 1): Promise<RealEstateBuildingsPage> {
  const cacheKey = `real-estate-buildings:${page}`
  const cached = getCached<SitemapRealEstateBuilding>(cacheKey)
  const cachedTotal = realEstateTotalCache
  if (cached && cachedTotal != null) return { items: cached, total: cachedTotal }

  try {
    const json = await ssrFetch<{ data?: SitemapRealEstateBuilding[]; total?: number }>(
      `/api/sitemap/real-estate-buildings?page=${page}&limit=${MAX_URLS_PER_SITEMAP}`,
      { timeoutMs: SITEMAP_FETCH_TIMEOUT_MS },
    )
    const raw = json.data ?? []
    // 서버가 이미 같은 규칙으로 거른다(backend sitemapService). 규칙이 어긋나는 경우를 위한 안전망.
    const items = raw.filter((item) => isValidBuildingName(item.buildingName))
    const total = json.total ?? 0
    if (items.length > 0) {
      setCache(cacheKey, items)
      realEstateTotalCache = total
    }
    return { items, total }
  } catch (err) {
    console.error('[sitemap] fetchRealEstateBuildings failed', err)
    return { items: [], total: 0 }
  }
}

export function getWeekStartDate(): string {
  // KST 기준 이번 주 월요일을 YYYY-MM-DD로 반환.
  const now = new Date()
  const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const day = kstNow.getDay()
  const diff = kstNow.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(kstNow)
  monday.setDate(diff)
  return monday.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

export interface SitemapRealEstateHub {
  realEstateType: 'apt-sale' | 'apt-rent' | 'villa-sale' | 'villa-rent' | 'offitel-sale' | 'offitel-rent'
  city: string
  district: string
}

export async function fetchRealEstateCityDistrictHubs(): Promise<SitemapRealEstateHub[]> {
  const cacheKey = 'real-estate-hubs'
  const cached = getCached<SitemapRealEstateHub>(cacheKey)
  if (cached) return cached

  try {
    const json = await ssrFetch<{ data?: SitemapRealEstateHub[] }>(
      '/api/sitemap/real-estate-hubs',
      { timeoutMs: SITEMAP_FETCH_TIMEOUT_MS },
    )
    const data = json.data ?? []
    if (data.length > 0) setCache(cacheKey, data)
    return data
  } catch (err) {
    console.error('[sitemap] fetchRealEstateCityDistrictHubs failed', err)
    return []
  }
}

export async function fetchRegionCategories(): Promise<
  Array<{ city: string; district: string; category: string }>
> {
  const cacheKey = 'region-categories'
  const cached = getCached<{ city: string; district: string; category: string }>(cacheKey)
  if (cached) return cached

  try {
    const json = await ssrFetch<{
      data?: Array<{ city: string; district: string; category: string }>
    }>('/api/sitemap/region-categories', { timeoutMs: SITEMAP_FETCH_TIMEOUT_MS })
    const data = json.data ?? []
    if (data.length > 0) setCache(cacheKey, data)
    return data
  } catch (err) {
    console.error('[sitemap] fetchRegionCategories failed', err)
    return []
  }
}

export interface SitemapPageCounts {
  facilities: Array<{ category: string; count: number; maxUpdatedAt: string | null }>
  waste: { count: number; maxUpdatedAt: string | null }
  subscriptions: { count: number; maxUpdatedAt: string | null }
  realEstateBuildings: { count: number; maxUpdatedAt: string | null }
}

export async function fetchSitemapPageCounts(): Promise<SitemapPageCounts | null> {
  try {
    const json = await ssrFetch<{ data?: SitemapPageCounts }>('/api/sitemap/page-counts', {
      timeoutMs: SITEMAP_FETCH_TIMEOUT_MS,
    })
    return json.data ?? null
  } catch (err) {
    console.error('[sitemap] fetchSitemapPageCounts failed', err)
    return null
  }
}

export async function fetchSubwaySlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const cacheKey = 'subway-slugs'
  const cached = getCached<{ slug: string; updatedAt: string }>(cacheKey)
  if (cached) return cached

  try {
    // grouped=true → nameSlug 단위 distinct 응답. 환승역 중복 방지.
    const json = await ssrFetch<{
      data?: { items?: Array<{ nameSlug: string; updatedAt: string }> }
    }>('/api/subway/stations?limit=5000&grouped=true', { timeoutMs: SITEMAP_FETCH_TIMEOUT_MS })
    const items = json?.data?.items ?? []
    const data = items.map((s) => ({
      slug: s.nameSlug,
      updatedAt: s.updatedAt,
    }))
    if (data.length > 0) setCache(cacheKey, data)
    return data
  } catch (err) {
    console.error('[sitemap] fetchSubwaySlugs failed', err)
    return []
  }
}

export interface LandSitemapData {
  cities: Array<{ city: string; district: string }>
  indexableDongs: Array<{ city: string; district: string; dongName: string }>
}

export async function fetchLandSitemap(): Promise<LandSitemapData> {
  try {
    const json = await ssrFetch<{ data?: LandSitemapData }>(
      '/api/real-estate/land/sitemap',
      { timeoutMs: SITEMAP_FETCH_TIMEOUT_MS },
    )
    return json.data ?? { cities: [], indexableDongs: [] }
  } catch (err) {
    console.error('[sitemap] fetchLandSitemap failed', err)
    return { cities: [], indexableDongs: [] }
  }
}

export interface AuctionSitemapData {
  /**
   * 백엔드 getSitemapEntries 가 `where: { isIndexable: true }` 로 이미 거른 행들이다.
   * select 는 city/district/bjdCode/usageGroup 만 담으므로 isIndexable 필드는 오지 않는다 —
   * 종전 타입에 `isIndexable?: boolean` 이 남아 있어서 호출부가 그걸 재검사했고,
   * 모든 행이 undefined 라 공매 지역 URL 이 전량 탈락했다. 필드를 지워 재검사를 컴파일 에러로 만든다.
   */
  regions: Array<{ city: string; district: string; bjdCode: string; usageGroup: string }>
  items: string[]
}

export async function fetchAuctionSitemap(): Promise<AuctionSitemapData> {
  try {
    const json = await ssrFetch<{ data?: AuctionSitemapData }>(
      '/api/auction/sitemap',
      { timeoutMs: SITEMAP_FETCH_TIMEOUT_MS },
    )
    return json.data ?? { regions: [], items: [] }
  } catch (err) {
    console.error('[sitemap] fetchAuctionSitemap failed', err)
    return { regions: [], items: [] }
  }
}

export async function fetchSubscriptionIds(): Promise<{ id: number; updatedAt: string }[]> {
  const cacheKey = 'subscriptions'
  const cached = getCached<{ id: number; updatedAt: string }>(cacheKey)
  if (cached) return cached

  try {
    const json = await ssrFetch<{ data?: { id: number; updatedAt: string }[] }>(
      '/api/sitemap/subscriptions',
      { timeoutMs: SITEMAP_FETCH_TIMEOUT_MS },
    )
    const data = json.data ?? []
    if (data.length > 0) setCache(cacheKey, data)
    return data
  } catch (err) {
    console.error('[sitemap] fetchSubscriptionIds failed', err)
    return []
  }
}
