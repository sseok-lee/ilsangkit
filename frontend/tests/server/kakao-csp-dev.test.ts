// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

async function scriptSrcFor(nodeEnv: string): Promise<string[]> {
  vi.resetModules()
  vi.stubEnv('NODE_ENV', nodeEnv)
  vi.stubGlobal('defineNuxtConfig', (config: unknown) => config)
  const { default: config } = await import('../../nuxt.config')
  const csp = (config.nitro!.routeRules!['/**'] as { headers: Record<string, string> })
    .headers['Content-Security-Policy']
  const directive = csp.split(';').map(part => part.trim()).find(part => part.startsWith('script-src '))!
  return directive.split(/\s+/).slice(1)
}

describe('Kakao 지도 본체 스크립트 CSP — 로컬 개발 서버', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('nuxt dev(development)에서는 http 카카오 CDN 본체를 허용한다', async () => {
    expect(await scriptSrcFor('development')).toContain('http://*.kakaocdn.net')
  })

  it('운영 빌드(production)에서는 http 카카오 CDN 을 허용하지 않는다', async () => {
    const sources = await scriptSrcFor('production')
    expect(sources).toContain('https://*.kakaocdn.net')
    expect(sources).not.toContain('http://*.kakaocdn.net')
  })
})
