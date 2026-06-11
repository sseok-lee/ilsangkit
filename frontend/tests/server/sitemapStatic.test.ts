import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { H3Event } from 'h3'

// h3 getQuery를 stub: 전달된 event.path의 query string을 파싱해 객체로 반환
vi.mock('h3', () => ({
  getQuery: (event: { path?: string }) =>
    Object.fromEntries(new URLSearchParams((event.path || '').split('?')[1] || '')),
  setHeader: vi.fn(),
}))

import { resolveSitemapFile, isRegenRequest } from '../../server/utils/sitemapStatic'

const ev = (path: string) => ({ path }) as unknown as H3Event

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
    expect(isRegenRequest(ev('/sitemap.xml?__regen=secret123'))).toBe(true)
  })

  it('토큰 불일치 시 false', () => {
    process.env.SITEMAP_REGEN_TOKEN = 'secret123'
    expect(isRegenRequest(ev('/sitemap.xml?__regen=wrong'))).toBe(false)
  })

  it('토큰 env 미설정 시 항상 false(regen 비활성)', () => {
    delete process.env.SITEMAP_REGEN_TOKEN
    expect(isRegenRequest(ev('/sitemap.xml?__regen=anything'))).toBe(false)
  })

  it('__regen 파라미터 없으면 false', () => {
    process.env.SITEMAP_REGEN_TOKEN = 'secret123'
    expect(isRegenRequest(ev('/sitemap.xml'))).toBe(false)
  })
})
