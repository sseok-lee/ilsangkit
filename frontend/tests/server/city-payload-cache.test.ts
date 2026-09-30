// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { loadOptions } from 'nitropack'
import { createRouter, toRouteMatcher } from 'radix3'
import { defu } from 'defu'

describe('city payload and query-dependent district cache boundaries', () => {
  let rulesFor: (path: string) => { cache?: false | { swr?: boolean; maxAge?: number } }
  beforeAll(async () => {
    vi.stubGlobal('defineNuxtConfig', (config: unknown) => config)
    const { default: config } = await import('../../nuxt.config')
    const normalized = await loadOptions({ routeRules: config.nitro!.routeRules })
    const matcher = toRouteMatcher(createRouter({ routes: normalized.routeRules }))
    rulesFor = path => defu({}, ...matcher.matchAll(path).reverse())
    vi.unstubAllGlobals()
  })

  it.each(['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent'])(
    '%s city payload remains renderable when district caching is disabled', (type) => {
      const city = `/real-estate/${type}/gyeongnam`
      expect(rulesFor(city).cache).toMatchObject({ swr: true, maxAge: 300 })
      expect(rulesFor(`${city}/_payload.json`).cache).toMatchObject({ swr: true, maxAge: 300 })
      expect(rulesFor(`${city}/changwon`).cache).toBe(false)
      expect(rulesFor(`${city}/changwon/성원`).cache).toBe(false)
      expect(rulesFor(`${city}/changwon/성원/신촌동-23-2`).cache).toBe(false)
    }
  )

  it('keeps changing guide counts in the same response as the HTML', () => {
    expect(rulesFor('/guide').cache).toBe(false)
    expect(rulesFor('/guide/aed-howto-example').cache).toBe(false)
  })
})
