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
    if (inGroup) out.push(line)
  }
  return out.join('\n')
}

describe('robots.txt crawl policy', () => {
  it('Google rendering assets are crawlable while non-image API endpoints stay blocked', () => {
    expect(robots).toContain('Allow: /_nuxt/')
    expect(robots).toContain('Allow: /api/images/')
    expect(robots).toContain('Disallow: /api/')
  })

  it('aed detail stays crawlable so Google can read page-level robots meta', () => {
    expect(robots).not.toMatch(/^Disallow:\s*\/aed\/$/m)
    expect(robots).not.toMatch(/^Disallow:\s*\/aed\/aed-/m)
  })

  it('keeps wifi detail crawlable for search engines so the noindex meta can be re-verified', () => {
    // wifi 상세(/wifi/wifi-)는 영구 noindex 다. 그런데 noindex 는 크롤해야만 확인되므로
    // robots.txt 로 크롤을 막으면 이미 수집된 사본이 색인에 영구 고착된다.
    // 실측(2026-07-28 네이버 진단): wifi 657건이 중복 title 로 남아 있고 마지막 크롤이 06-29,
    // 7월 크롤 0건 — 크롤 차단이 회수 경로를 없앤 상태였다. 검색엔진에는 크롤을 허용한다.
    expect(extractGroup(robots, 'Yeti')).not.toContain('Disallow: /wifi/wifi-')
    expect(extractGroup(robots, '*')).not.toContain('Disallow: /wifi/wifi-')
    // 카테고리 허브(/wifi)와 지역 wifi 도 계속 크롤 허용.
    expect(robots).not.toMatch(/^Disallow:\s*\/wifi\/$/m)
    expect(robots).not.toMatch(/^Disallow:\s*\/wifi$/m)
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

  it('applies the crawl-budget Disallow set to every AI crawler group (groups do not inherit from *)', () => {
    // robots.txt 그룹은 상속되지 않는다 — 자기 이름 그룹이 있는 봇은 User-agent: * 를 통째로 무시한다.
    // AI 봇 그룹에 Allow: / 만 두면 _payload.json·wifi 상세 같은 차단 대상이 그 봇에게만 열린다.
    const AI_CRAWLERS = ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot']
    const REQUIRED_DISALLOW = ['/api/', '/*_payload.json', '/admin', '/wifi/wifi-']
    for (const ua of AI_CRAWLERS) {
      const group = extractGroup(robots, ua)
      expect(group, `${ua} group must exist`).not.toBe('')
      for (const rule of REQUIRED_DISALLOW) {
        expect(group, `${ua} must disallow ${rule}`).toContain(`Disallow: ${rule}`)
      }
      // 의도는 유지: AI 검색 노출을 위해 본문은 계속 허용한다.
      expect(group, `${ua} must still allow the site body`).toContain('Allow: /')
    }
  })

  it('AI crawler groups keep image/asset rendering allowed', () => {
    for (const ua of ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot']) {
      const group = extractGroup(robots, ua)
      expect(group, `${ua} keeps api images allowed`).toContain('Allow: /api/images/')
    }
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
