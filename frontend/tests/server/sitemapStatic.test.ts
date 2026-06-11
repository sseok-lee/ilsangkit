import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// h3 getHeader를 stub: 전달된 event.headers에서 헤더 값을 읽는다
vi.mock('h3', () => ({
  getHeader: (event: { headers?: Record<string, string> }, name: string) => event.headers?.[name.toLowerCase()],
  setHeader: vi.fn(),
}))

import { resolveSitemapFile, isRegenRequest } from '../../server/utils/sitemapStatic'

const ev = (headers: Record<string, string> = {}) => ({ headers }) as any

describe('resolveSitemapFile', () => {
  const DIR = '/srv/sitemaps'

  it('인덱스 경로를 파일로 매핑', () => {
    expect(resolveSitemapFile('/sitemap.xml', DIR)).toBe('/srv/sitemaps/sitemap.xml')
  })

  it('자식 경로를 서브디렉토리 파일로 매핑', () => {
    expect(resolveSitemapFile('/sitemap/toilet.xml', DIR)).toBe('/srv/sitemaps/sitemap/toilet.xml')
  })

  it('query string을 제거하고 매핑', () => {
    expect(resolveSitemapFile('/sitemap/toilet.xml?__regen=abc', DIR)).toBe('/srv/sitemaps/sitemap/toilet.xml')
  })

  it('.xml이 아니면 null', () => {
    expect(resolveSitemapFile('/sitemap/toilet', DIR)).toBeNull()
    expect(resolveSitemapFile('/robots.txt', DIR)).toBeNull()
  })

  it('경로 탈출(../) 시도는 null', () => {
    expect(resolveSitemapFile('/sitemap/../../etc/passwd.xml', DIR)).toBeNull()
    expect(resolveSitemapFile('/sitemap/%2e%2e/secret.xml', DIR)).toBeNull()
  })
})

describe('isRegenRequest', () => {
  const ENV = process.env
  beforeEach(() => { process.env = { ...ENV } })
  afterEach(() => { process.env = ENV })

  it('토큰 일치 시 true', () => {
    process.env.SITEMAP_REGEN_TOKEN = 'secret123'
    expect(isRegenRequest(ev({ 'x-sitemap-regen-token': 'secret123' }))).toBe(true)
  })

  it('토큰 불일치 시 false', () => {
    process.env.SITEMAP_REGEN_TOKEN = 'secret123'
    expect(isRegenRequest(ev({ 'x-sitemap-regen-token': 'wrong' }))).toBe(false)
  })

  it('토큰 env 미설정 시 항상 false(regen 비활성)', () => {
    delete process.env.SITEMAP_REGEN_TOKEN
    expect(isRegenRequest(ev({ 'x-sitemap-regen-token': 'anything' }))).toBe(false)
  })

  it('헤더 없으면 false', () => {
    process.env.SITEMAP_REGEN_TOKEN = 'secret123'
    expect(isRegenRequest(ev({}))).toBe(false)
  })
})
