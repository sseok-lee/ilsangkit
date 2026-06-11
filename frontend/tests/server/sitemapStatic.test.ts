import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveSitemapFile, isRegenRequest } from '../../server/utils/sitemapStatic'

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
    expect(isRegenRequest({ path: '/sitemap.xml?__regen=secret123' })).toBe(true)
  })

  it('토큰 불일치 시 false', () => {
    process.env.SITEMAP_REGEN_TOKEN = 'secret123'
    expect(isRegenRequest({ path: '/sitemap.xml?__regen=wrong' })).toBe(false)
  })

  it('토큰 env 미설정 시 항상 false(regen 비활성)', () => {
    delete process.env.SITEMAP_REGEN_TOKEN
    expect(isRegenRequest({ path: '/sitemap.xml?__regen=anything' })).toBe(false)
  })

  it('__regen 파라미터 없으면 false', () => {
    process.env.SITEMAP_REGEN_TOKEN = 'secret123'
    expect(isRegenRequest({ path: '/sitemap.xml' })).toBe(false)
  })
})
