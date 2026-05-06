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
})
