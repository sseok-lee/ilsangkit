import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const robots = readFileSync(resolve(process.cwd(), 'public/robots.txt'), 'utf-8')

/**
 * 주어진 User-agent 의 규칙 블록만 잘라낸다.
 * robots.txt 그룹은 다음 User-agent 줄에서 끝난다(연속된 User-agent 줄은 같은 그룹을 공유).
 * 그룹이 없으면 빈 문자열.
 */
function extractGroup(txt: string, ua: string): string {
  const lines = txt.split('\n')
  const out: string[] = []
  let inGroup = false
  let inHeader = false
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    const m = /^User-agent:\s*(.+)$/i.exec(line)
    if (m) {
      const name = m[1].trim()
      if (inGroup && !inHeader) break // 다음 그룹 시작 → 종료
      if (name.toLowerCase() === ua.toLowerCase()) inGroup = true
      inHeader = true
      continue
    }
    inHeader = false
    // Sitemap 은 그룹 소속이 아닌 사이트 레벨 지시문이다(RFC 9309 "non-group record").
    // 파일 맨 끝에 있어서 걸러내지 않으면 마지막 그룹에 딸려 들어간다.
    if (/^Sitemap:/i.test(line)) continue
    if (inGroup) out.push(line)
  }
  return out.join('\n')
}

// These policies use literal path prefixes. Named groups replace the wildcard group.
function allowed(ua: string, path: string): boolean {
  const group = extractGroup(robots, ua) || extractGroup(robots, '*')
  const matches = group.split('\n').flatMap(line => {
    const match = /^(Allow|Disallow):\s*(.+)$/.exec(line)
    if (!match || !path.startsWith(match[2])) return []
    return [{ allow: match[1] === 'Allow', length: match[2].length }]
  }).sort((a, b) => b.length - a.length || Number(b.allow) - Number(a.allow))
  return matches[0]?.allow ?? true
}

const SEARCH_BOTS = ['Googlebot', 'Googlebot-Image', 'bingbot', 'Yeti', 'Applebot', 'OAI-SearchBot', 'Claude-SearchBot', 'ChatGPT-User', 'PerplexityBot']
const SOCIAL_BOTS = ['kakaotalk-scrap', 'facebookexternalhit', 'Twitterbot']
const BLOCKED_BOTS = ['GPTBot', 'ClaudeBot', 'Applebot-Extended', 'Google-Extended', 'CCBot', 'Bytespider', 'Amazonbot', 'Amzn-SearchBot']
const PUBLIC_PATHS = ['/', '/hospital/example', '/hospital/example/_payload.json', '/real-estate/apt-sale/seoul/gangnam/example/_payload.json?buildId=123', '/_payload.json?abc', '/_nuxt/app.js', '/api/images/example.jpg', '/og-map?lat=37.5&lng=127', '/og-image.png']
const PRIVATE_PATHS = ['/admin', '/admin/settings?x=1', '/api/real-estate/nearby?mode=sale', '/api/facilities/search']

describe('robots.txt crawl policy', () => {
  it.each([...SEARCH_BOTS, ...SOCIAL_BOTS])('%s can fetch public content and rendering resources', ua => {
    for (const path of PUBLIC_PATHS) expect(allowed(ua, path), `${ua}: ${path}`).toBe(true)
    for (const path of PRIVATE_PATHS) expect(allowed(ua, path), `${ua}: ${path}`).toBe(false)
  })

  it.each(BLOCKED_BOTS)('%s stays entirely blocked under the no-training and existing crawler policies', ua => {
    expect(extractGroup(robots, ua)).toBe('Disallow: /')
    for (const path of [...PUBLIC_PATHS, ...PRIVATE_PATHS]) expect(allowed(ua, path), `${ua}: ${path}`).toBe(false)
  })

  it.each(['Googlebot', 'bingbot', 'Yeti'])('%s can revisit noindex pages and follow pagination links', ua => {
    for (const path of ['/aed/aed-example', '/wifi/wifi-example', '/wifi', '/seoul/wifi', '/hospital?page=2', '/hospital?city=seoul&page=2']) {
      expect(allowed(ua, path), `${ua}: ${path}`).toBe(true)
    }
  })

  it.each(['ChatGPT-User', 'PerplexityBot'])('%s retains its existing wifi-detail crawl restriction', ua => {
    expect(allowed(ua, '/wifi/wifi-example')).toBe(false)
    expect(allowed(ua, '/wifi')).toBe(true)
  })

  it('does not explicitly block advertising crawlers', () => {
    // Advertising crawlers have special wildcard handling; do not infer their rules from *.
    for (const ua of ['Mediapartners-Google', 'AdsBot-Google']) expect(extractGroup(robots, ua)).toBe('')
  })

  it('publishes the canonical sitemap and keeps the requested comment-free format', () => {
    expect(robots.match(/^Sitemap: .+$/gm)).toEqual(['Sitemap: https://ilsangkit.co.kr/sitemap.xml'])
    expect(robots).not.toContain('#')
    // Keep this test matcher valid: policy paths use literal prefixes, not wildcard rules.
    expect(robots).not.toMatch(/^(Allow|Disallow):.*[*$]/m)
  })
})
