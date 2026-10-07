// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { loadOptions } from 'nitropack'
import { createRouter, toRouteMatcher } from 'radix3'
import { defu } from 'defu'

const publicPaths = [
  '/toilet/csp-fixture',
  '/pharmacy/csp-fixture',
  '/real-estate/apt-sale/chungnam/cheonan-dongnam/초원그린타운',
  '/real-estate/apt-rent/gyeongnam/changwon/csp-fixture/주소',
]
const adminPaths = ['/admin', '/admin/affiliate-banners']

describe('Kakao CDN CSP contract', () => {
  let headersFor: (path: string) => Record<string, string>

  function policyFor(path: string): Map<string, string[]> {
    const value = headersFor(path)['content-security-policy']
    expect(value).toBeTruthy()
    const entries = value.split(';').map(part => part.trim()).filter(Boolean)
      .map((part): [string, string[]] => {
        const [name, ...sources] = part.split(/\s+/)
        return [name, sources]
      })
    return new Map(entries)
  }

  beforeAll(async () => {
    vi.stubGlobal('defineNuxtConfig', (config: unknown) => config)
    try {
      const { default: config } = await import('../../nuxt.config')
      const normalized = await loadOptions({ routeRules: config.nitro!.routeRules })
      const matcher = toRouteMatcher(createRouter({ routes: normalized.routeRules }))
      headersFor = (path) => {
        const rules = defu({}, ...matcher.matchAll(path).reverse()) as {
          headers?: Record<string, string>
        }
        return Object.fromEntries(Object.entries(rules.headers ?? {})
          .map(([name, value]) => [name.toLowerCase(), value]))
      }
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it.each([...publicPaths, ...adminPaths])('%s allows CDN scripts and connections', (path) => {
    const policy = policyFor(path)
    for (const directive of ['script-src', 'connect-src']) {
      const sources = policy.get(directive)
      expect(sources).toBeDefined()
      expect(sources).toContain('https://*.kakaocdn.net')
      expect(sources).toContain('https://*.kakao.com')
      expect(sources).toContain('https://*.daumcdn.net')
      for (const forbidden of ['*', 'https:', 'http://*.kakaocdn.net']) {
        expect(sources).not.toContain(forbidden)
      }
    }
  })

  it.each(publicPaths)('%s preserves the existing image permissions', (path) => {
    const images = policyFor(path).get('img-src')
    expect(images).toEqual(expect.arrayContaining([
      "'self'", 'data:', 'https://*.kakaocdn.net', 'https://*.daumcdn.net',
    ]))
    expect(images).not.toContain('https:')
  })

  it.each([...publicPaths, ...adminPaths])('%s keeps security enforcement', (path) => {
    const policy = policyFor(path)
    expect(policy.get('default-src')).toEqual(["'self'"])
    expect(policy.get('object-src')).toEqual(["'none'"])
    expect(policy.get('worker-src')).toEqual(["'self'", 'blob:'])
    expect(headersFor(path)['x-content-type-options']).toBe('nosniff')
    expect(headersFor(path)['x-frame-options']).toBe('DENY')
    expect(headersFor(path)['strict-transport-security'])
      .toBe('max-age=31536000; includeSubDomains; preload')
  })
})
