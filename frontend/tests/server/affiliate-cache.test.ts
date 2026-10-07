// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest'

type CacheRule = {
  urlPattern: RegExp | ((context: { url: URL }) => boolean)
  handler: string
}

describe('public affiliate selection service worker policy', () => {
  let rules: CacheRule[]

  beforeAll(async () => {
    vi.stubGlobal('defineNuxtConfig', (config: unknown) => config)
    try {
      const { default: config } = await import('../../nuxt.config')
      rules = config.pwa!.workbox!.runtimeCaching as CacheRule[]
    } finally {
      vi.unstubAllGlobals()
    }
  })

  function firstHandler(path: string) {
    const url = new URL(path, 'https://ilsangkit.co.kr')
    return rules.find(rule => rule.urlPattern instanceof RegExp
      ? rule.urlPattern.test(url.href)
      : rule.urlPattern({ url }))?.handler
  }

  it.each(['/api/affiliate-banners/random', '/api/affiliate-banners/random/', '/api/affiliate-banners/random?refresh=1'])(
    '%s never replays a cached selection after a network failure', path => {
      expect(firstHandler(path)).toBe('NetworkOnly')
    }
  )

  it('preserves unrelated API and static image caching', () => {
    expect(firstHandler('/api/meta/categories')).toBe('NetworkFirst')
    expect(firstHandler('/images/example.png')).toBe('CacheFirst')
  })
})
