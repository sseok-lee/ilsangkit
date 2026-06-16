import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const robots = readFileSync(resolve(process.cwd(), 'public/robots.txt'), 'utf-8')

describe('robots.txt crawl policy', () => {
  it('Google rendering assets are crawlable while non-image API endpoints stay blocked', () => {
    expect(robots).toContain('Allow: /_nuxt/')
    expect(robots).toContain('Allow: /api/images/')
    expect(robots).toContain('Disallow: /api/')
  })

  it('index policy pages are crawlable so Google can read page-level robots meta', () => {
    expect(robots).not.toMatch(/^Disallow:\s*\/aed\/$/m)
    expect(robots).not.toMatch(/^Disallow:\s*\/wifi\/$/m)
  })

  it('blocks Naver Yeti from crawling query pagination URLs', () => {
    expect(robots).toMatch(/User-agent:\s*Yeti[\s\S]*Disallow:\s*\/\*\?page=/)
    expect(robots).toMatch(/User-agent:\s*Yeti[\s\S]*Disallow:\s*\/\*&page=/)
  })

  it('blocks Nuxt _payload.json from crawlers to reclaim crawl budget', () => {
    // payload URLs carry a ?<buildId> query, so no $ anchor — it would miss the query string.
    expect(robots).toContain('Disallow: /*_payload.json')
    expect(robots).not.toContain('Disallow: /*_payload.json$')
    // applied to the default (Googlebot) group and to Naver Yeti — robots groups do not inherit.
    expect(robots).toMatch(/User-agent:\s*\*[\s\S]*Disallow:\s*\/\*_payload\.json/)
    expect(robots).toMatch(/User-agent:\s*Yeti[\s\S]*Disallow:\s*\/\*_payload\.json/)
  })

  it('allows Google-Extended (AI search visibility) and blocks training-only scrapers', () => {
    // Google-Extended is intentionally allowed — its rule must not contradict the surrounding comment.
    expect(robots).toMatch(/User-agent:\s*Google-Extended\s+Allow:\s*\//)
    expect(robots).not.toMatch(/User-agent:\s*Google-Extended\s+Disallow:\s*\//)
    // training-only scrapers stay blocked
    expect(robots).toMatch(/User-agent:\s*CCBot\s+Disallow:\s*\//)
    expect(robots).toMatch(/User-agent:\s*Bytespider\s+Disallow:\s*\//)
  })
})
