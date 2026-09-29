import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const root = process.cwd().endsWith('/frontend') ? process.cwd() : join(process.cwd(), 'frontend')
const src = readFileSync(resolve(root, 'nuxt.config.ts'), 'utf8')

function regexFromSource(patternSource: string): RegExp {
  const escaped = patternSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = src.match(new RegExp(`urlPattern:\\s*/(${escaped})/`))
  expect(match, `missing urlPattern /${patternSource}/`).not.toBeNull()
  return new RegExp(match![1])
}

function serializedWasteMatcher(): ({ url }: { url: URL }) => boolean {
  const start = src.indexOf('function isWasteBearingApiRequest')
  const end = src.indexOf('\n\nexport default defineNuxtConfig', start)
  expect(start, 'waste-bearing API predicate가 없다').toBeGreaterThan(-1)
  expect(end, 'waste-bearing API predicate 범위를 찾을 수 없다').toBeGreaterThan(start)

  const compiled = ts.transpileModule(src.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  }).outputText.trim()
  return vm.runInNewContext(`(${compiled})`, { URL })
}

function url(value: string): URL {
  return new URL(value, 'https://ilsangkit.co.kr')
}

describe('subscription list service worker caching policy', () => {
  it('matches only the subscription list endpoint', () => {
    const pattern = regexFromSource(String.raw`\/api\/subscription\/?(?:\?|$)`)

    expect(pattern.test('/api/subscription')).toBe(true)
    expect(pattern.test('/api/subscription?category=rent&page=1')).toBe(true)
    expect(pattern.test('/api/subscription/?category=sale')).toBe(true)
    expect(pattern.test('/api/subscription/90001')).toBe(false)
    expect(pattern.test('/api/subscription/upcoming')).toBe(false)
    expect(pattern.test('/api/subscription/90001/rental-price-stats')).toBe(false)
  })

  it('places subscription list NetworkOnly before generic API NetworkFirst', () => {
    const listPatternAt = src.indexOf(String.raw`/\/api\/subscription\/?(?:\?|$)/`)
    const listHandlerAt = src.indexOf("handler: 'NetworkOnly'", listPatternAt)
    const genericApiAt = src.indexOf("handler: 'NetworkFirst'")

    expect(listPatternAt, '청약 목록 NetworkOnly 규칙이 없다').toBeGreaterThan(-1)
    expect(listHandlerAt, '청약 목록 규칙이 NetworkOnly가 아니다').toBeGreaterThan(listPatternAt)
    expect(genericApiAt, '일반 API NetworkFirst 규칙이 없다').toBeGreaterThan(-1)
    expect(listHandlerAt).toBeLessThan(genericApiAt)
  })
})

describe('waste service worker caching policy', () => {
  it('places waste APIs NetworkOnly before generic API NetworkFirst', () => {
    const wastePatternAt = src.indexOf('urlPattern: isWasteBearingApiRequest')
    const predicateAt = src.indexOf('function isWasteBearingApiRequest')
    const wasteHandlerAt = src.indexOf("handler: 'NetworkOnly'", wastePatternAt)
    const genericApiAt = src.indexOf("handler: 'NetworkFirst'")

    expect(predicateAt, 'waste-bearing API predicate가 없다').toBeGreaterThan(-1)
    expect(wastePatternAt, 'waste API NetworkOnly 규칙이 없다').toBeGreaterThan(-1)
    expect(wasteHandlerAt, 'waste API 규칙이 NetworkOnly가 아니다').toBeGreaterThan(wastePatternAt)
    expect(wasteHandlerAt).toBeLessThan(genericApiAt)
  })

  it('serializes to a production-safe matcher for waste-bearing requests only', () => {
    const matcher = serializedWasteMatcher()

    expect(matcher({ url: url('/api/waste-areas?page=1') })).toBe(true)
    expect(matcher({ url: url('/api/waste-schedules?city=seoul') })).toBe(true)
    expect(matcher({ url: url('/api/facilities/browse?category=trash&city=seoul') })).toBe(true)
    expect(matcher({ url: url('/api/facilities/search?category=trash') })).toBe(true)
    expect(matcher({ url: url('/api/facilities/browse?city=seoul&district=gangnam') })).toBe(true)
    expect(matcher({ url: url('/api/facilities/search') })).toBe(true)
    expect(matcher({ url: url('/api/facilities/all') })).toBe(true)
    expect(matcher({ url: url('/api/facilities/region/seoul/gangnam') })).toBe(true)
    expect(matcher({ url: url('/api/facilities/region/seoul/gangnam/trash') })).toBe(true)
    expect(matcher({ url: url('/api/facilities/search?category=toilet') })).toBe(false)
    expect(matcher({ url: url('/api/facilities/browse?category=parking') })).toBe(false)
    expect(matcher({ url: url('/api/facilities/region/seoul/gangnam/toilet') })).toBe(false)
    expect(matcher({ url: url('/api/subscription?category=trash') })).toBe(false)
  })

  it('disables Nitro SSR caching for waste routes while preserving unrelated city route cache', () => {
    expect(src).toContain("'/trash': { swr: false, cache: false, headers: { 'cache-control': 'private, no-store' } }")
    expect(src).toContain("'/trash/**': { swr: false, cache: false, headers: { 'cache-control': 'private, no-store' } }")
    expect(src).toContain('const wasteRegionalNoCacheRules = Object.fromEntries(')
    expect(src).toContain('`/${city}/*/trash`')
    expect(src).toContain("'/seoul/**': { swr: 1800 }")
  })

  it('imports scoped old waste api-cache cleanup without removing unrelated API cache entries', () => {
    const cleanup = readFileSync(resolve(root, 'public/sw-waste-cache-cleanup.js'), 'utf8')
    expect(src).toContain("importScripts: ['/sw-waste-cache-cleanup.js']")
    expect(cleanup).toContain("caches.open('api-cache')")
    expect(cleanup).toContain('cache.delete(request)')
    expect(cleanup).toContain("category === null || category === '' || category === 'trash'")
    expect(cleanup).toContain('regionCategory === undefined')

    const listeners: Record<string, (event: { waitUntil: (promise: Promise<unknown>) => void }) => void> = {}
    const context = {
      URL,
      Promise,
      self: {
        location: { origin: 'https://ilsangkit.co.kr' },
        addEventListener: (type: string, listener: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void) => {
          listeners[type] = listener
        },
      },
      caches: { open: async () => ({ keys: async () => [], delete: async () => true }) },
    }
    vm.runInNewContext(cleanup, context)
    const matcher = (context.self as typeof context.self & { __ilsangkitIsWasteApiCacheUrl: (url: string) => boolean }).__ilsangkitIsWasteApiCacheUrl

    expect(matcher('https://ilsangkit.co.kr/api/waste-areas?page=1')).toBe(true)
    expect(matcher('https://ilsangkit.co.kr/api/waste-schedules?city=seoul')).toBe(true)
    expect(matcher('https://ilsangkit.co.kr/api/facilities/browse?category=trash&city=seoul')).toBe(true)
    expect(matcher('https://ilsangkit.co.kr/api/facilities/search?category=trash')).toBe(true)
    expect(matcher('https://ilsangkit.co.kr/api/facilities/browse?city=seoul&district=gangnam')).toBe(true)
    expect(matcher('https://ilsangkit.co.kr/api/facilities/search')).toBe(true)
    expect(matcher('https://ilsangkit.co.kr/api/facilities/all')).toBe(true)
    expect(matcher('https://ilsangkit.co.kr/api/facilities/region/seoul/gangnam')).toBe(true)
    expect(matcher('https://ilsangkit.co.kr/api/facilities/region/seoul/gangnam/trash')).toBe(true)
    expect(matcher('https://ilsangkit.co.kr/api/facilities/search?category=toilet')).toBe(false)
    expect(matcher('https://ilsangkit.co.kr/api/facilities/browse?category=parking')).toBe(false)
    expect(matcher('https://ilsangkit.co.kr/api/facilities/region/seoul/gangnam/toilet')).toBe(false)
    expect(matcher('https://ilsangkit.co.kr/api/subscription?category=trash')).toBe(false)
    expect(listeners.activate).toBeTypeOf('function')
  })
})
